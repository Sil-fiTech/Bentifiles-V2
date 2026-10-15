import crypto from 'crypto';

import { deleteObject, getObject, putObject } from '../r2Service';
import { decryptBuffer, encryptBuffer } from './envelopeCrypto';
import { StorageDriver, StorageError, StoredFileRef } from './types';

const isMissingObject = (error: unknown) =>
    error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound');

export const r2EncryptedDriver: StorageDriver = {
    async put({ buffer }) {
        const blob = encryptBuffer(buffer);
        const storageRef = crypto.randomUUID();
        await putObject(storageRef, blob.ciphertext);

        return {
            storageProvider: 'R2',
            storageRef,
            encryptedDek: blob.encryptedDek,
            iv: blob.iv,
            authTag: blob.authTag,
            keyVersion: blob.keyVersion,
            storageConnectionId: null,
        };
    },

    async get(file: StoredFileRef) {
        if (file.purgedAt) throw new StorageError('PURGED', 'Arquivo expirado');

        let raw: Buffer;
        try {
            raw = await getObject(file.storageRef);
        } catch (error) {
            if (isMissingObject(error)) throw new StorageError('NOT_FOUND', 'Arquivo nao encontrado');
            throw error;
        }

        // Arquivos gravados antes da migração não têm DEK e estão em texto puro.
        if (!file.encryptedDek || !file.iv || !file.authTag || file.keyVersion === null) return raw;

        return decryptBuffer(raw, {
            encryptedDek: file.encryptedDek,
            iv: file.iv,
            authTag: file.authTag,
            keyVersion: file.keyVersion,
        });
    },

    async delete(file: StoredFileRef) {
        await deleteObject(file.storageRef);
    },
};
