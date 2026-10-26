import 'dotenv/config';
import crypto from 'crypto';

import prisma from '../prisma';
import { deleteObject, getObject, putObject } from '../services/r2Service';
import { assertStorageKeysConfigured, decryptBuffer, encryptBuffer, encryptField } from '../services/storage/envelopeCrypto';
import { logError, logInfo } from '../utils/logger';

const BATCH_SIZE = 50;

type MigrateResult = { status: 'migrated'; cleanupPendingRef?: string } | { status: 'skipped' };

const migrateOne = async (file: { id: string; storageRef: string; originalName: string }): Promise<MigrateResult> => {
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

    logInfo('Storage migration: updating file row', { fileId: file.id, oldRef: file.storageRef, newRef });

    const updated = await prisma.file.updateMany({
        where: { id: file.id, storageRef: file.storageRef, encryptedDek: null, purgedAt: null },
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

    if (updated.count === 0) {
        try {
            await deleteObject(newRef);
        } catch (error) {
            logError('Storage migration: failed to remove orphan new object', error, { fileId: file.id, newRef });
        }
        logInfo('Storage migration: file changed concurrently, skipped', { fileId: file.id });
        return { status: 'skipped' };
    }

    try {
        await deleteObject(file.storageRef);
    } catch (error) {
        logError('Storage migration: old object cleanup pending', error, { fileId: file.id, oldRef: file.storageRef });
        return { status: 'migrated', cleanupPendingRef: file.storageRef };
    }
    return { status: 'migrated' };
};

const run = async () => {
    assertStorageKeysConfigured();
    const failedIds = new Set<string>();
    const skippedIds = new Set<string>();
    const cleanupPending: { fileId: string; oldRef: string }[] = [];
    let migrated = 0;

    while (true) {
        const batch = await prisma.file.findMany({
            where: { storageProvider: 'R2', encryptedDek: null, purgedAt: null, id: { notIn: [...failedIds, ...skippedIds] } },
            select: { id: true, storageRef: true, originalName: true },
            take: BATCH_SIZE,
        });
        if (batch.length === 0) break;

        for (const file of batch) {
            try {
                const result = await migrateOne(file);
                if (result.status === 'migrated') {
                    migrated += 1;
                    if (result.cleanupPendingRef) cleanupPending.push({ fileId: file.id, oldRef: result.cleanupPendingRef });
                } else {
                    skippedIds.add(file.id);
                }
            } catch (error) {
                failedIds.add(file.id);
                logError('Storage migration failed for file', error, { fileId: file.id });
            }
        }
        logInfo('Storage migration progress', { migrated, failed: failedIds.size });
    }

    logInfo('Storage migration finished', { migrated, failed: failedIds.size, failedIds: [...failedIds], skipped: skippedIds.size, cleanupPending });
    if (failedIds.size > 0) process.exitCode = 1;
};

run()
    .catch((error) => {
        logError('Storage migration fatal error', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
