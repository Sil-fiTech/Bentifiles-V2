import crypto from 'crypto';
import dotenv from 'dotenv';

import prisma from '../prisma';
import { deleteObject, getObject, putObject } from '../services/r2Service';
import { assertStorageKeysConfigured, decryptBuffer, encryptBuffer, encryptField } from '../services/storage/envelopeCrypto';
import { logError, logInfo } from '../utils/logger';

dotenv.config();

const BATCH_SIZE = 50;

const migrateOne = async (file: { id: string; storageRef: string; originalName: string }) => {
    const original = await getObject(file.storageRef);
    const blob = encryptBuffer(original);
    const newRef = crypto.randomUUID();

    await putObject(newRef, blob.ciphertext);

    // Confere o que foi gravado antes de apagar o original.
    const roundTrip = decryptBuffer(await getObject(newRef), blob);
    if (!roundTrip.equals(original)) {
        await deleteObject(newRef);
        throw new Error('Verificacao de ida e volta falhou');
    }

    await prisma.file.update({
        where: { id: file.id },
        data: {
            filename: newRef,
            storageRef: newRef,
            encryptedDek: blob.encryptedDek,
            iv: blob.iv,
            authTag: blob.authTag,
            keyVersion: blob.keyVersion,
            originalName: file.originalName.startsWith('enc:v') ? file.originalName : encryptField(file.originalName),
        },
    });

    await deleteObject(file.storageRef);
};

const run = async () => {
    assertStorageKeysConfigured();
    const failedIds = new Set<string>();
    let migrated = 0;

    while (true) {
        const batch = await prisma.file.findMany({
            where: { storageProvider: 'R2', encryptedDek: null, purgedAt: null, id: { notIn: [...failedIds] } },
            select: { id: true, storageRef: true, originalName: true },
            take: BATCH_SIZE,
        });
        if (batch.length === 0) break;

        for (const file of batch) {
            try {
                await migrateOne(file);
                migrated += 1;
            } catch (error) {
                failedIds.add(file.id);
                logError('Storage migration failed for file', error, { fileId: file.id });
            }
        }
        logInfo('Storage migration progress', { migrated, failed: failedIds.size });
    }

    logInfo('Storage migration finished', { migrated, failed: failedIds.size, failedIds: [...failedIds] });
    if (failedIds.size > 0) process.exitCode = 1;
};

run()
    .catch((error) => {
        logError('Storage migration fatal error', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
