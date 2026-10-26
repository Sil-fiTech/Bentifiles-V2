import type { File, StorageProvider } from '@prisma/client';

export type StorageErrorCode = 'NOT_FOUND' | 'PURGED' | 'DISCONNECTED' | 'AUTH_REVOKED' | 'QUOTA' | 'UNAVAILABLE';

export class StorageError extends Error {
    constructor(public readonly code: StorageErrorCode, message: string) {
        super(message);
        this.name = 'StorageError';
    }
}

export type StoredFileRef = Pick<File, 'storageProvider' | 'storageRef' | 'encryptedDek' | 'iv' | 'authTag' | 'keyVersion' | 'purgedAt'> & {
    storageConnectionId?: string | null;
};

export interface StoredObject {
    storageProvider: StorageProvider;
    storageRef: string;
    encryptedDek: string | null;
    iv: string | null;
    authTag: string | null;
    keyVersion: number | null;
    storageConnectionId: string | null;
}

export interface PutInput {
    buffer: Buffer;
    mimetype: string;
    projectId: string;
    displayName: string;
}

export interface StorageDriver {
    put(input: PutInput): Promise<StoredObject>;
    get(file: StoredFileRef): Promise<Buffer>;
    delete(file: StoredFileRef): Promise<void>;
    rename?(file: StoredFileRef, name: string): Promise<void>;
}
