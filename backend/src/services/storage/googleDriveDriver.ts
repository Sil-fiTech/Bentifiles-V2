// backend/src/services/storage/googleDriveDriver.ts
import type { StorageConnection } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';

import prisma from '../../prisma';
import { decryptField } from './envelopeCrypto';
import { refreshAccessToken } from './googleOAuth';
import { PutInput, StorageDriver, StorageError, StoredFileRef } from './types';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const PERMISSION_REASONS = ['insufficientPermissions', 'forbidden', 'appNotAuthorizedToFile'];
const RATE_LIMIT_REASONS = ['userRateLimitExceeded', 'rateLimitExceeded'];
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const API_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

type DriveConnection = Pick<StorageConnection, 'id' | 'encryptedRefreshToken' | 'rootFolderId' | 'sharedDriveId'>;

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export const getAccessToken = async (connection: DriveConnection): Promise<string> => {
    const cacheKey = `${connection.id}:${connection.encryptedRefreshToken}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

    const { accessToken, expiresIn } = await refreshAccessToken(decryptField(connection.encryptedRefreshToken));
    tokenCache.set(cacheKey, { token: accessToken, expiresAt: Date.now() + expiresIn * 1000 });
    return accessToken;
};

const mapDriveError = (error: any): StorageError | null => {
    if (error instanceof StorageError) return error;
    const status = error?.response?.status;
    const reasons: string[] = (error?.response?.data?.error?.errors ?? []).map((e: any) => e.reason);
    if (status === 404) return new StorageError('NOT_FOUND', 'Arquivo removido do Google Drive');
    if (status === 403 && reasons.includes('storageQuotaExceeded')) return new StorageError('QUOTA', 'Google Drive sem espaço');
    if (status === 401) return new StorageError('UNAVAILABLE', 'Google Drive indisponível');
    if (status === 403 && reasons.some((r) => PERMISSION_REASONS.includes(r))) {
        return new StorageError('AUTH_REVOKED', 'Acesso ao Google Drive revogado');
    }
    return null;
};

const isRetryable = (error: any) => {
    const status = error?.response?.status;
    if (status === 403) {
        const reasons: string[] = (error?.response?.data?.error?.errors ?? []).map((e: any) => e.reason);
        return reasons.some((r) => RATE_LIMIT_REASONS.includes(r));
    }
    return status === undefined || status === 429 || status >= 500;
};

const invalidateToken = (accessToken: string) => {
    for (const [id, entry] of tokenCache) {
        if (entry.token === accessToken) tokenCache.delete(id);
    }
};

const withRetry = async <T>(fn: () => Promise<T>, accessToken?: string): Promise<T> => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            if ((error as any)?.response?.status === 401 && accessToken) invalidateToken(accessToken);
            const mapped = mapDriveError(error);
            if (mapped) throw mapped;
            if (!isRetryable(error) || attempt >= MAX_ATTEMPTS) {
                throw new StorageError('UNAVAILABLE', 'Google Drive indisponível');
            }
            await new Promise((resolve) => setTimeout(resolve, BASE_BACKOFF_MS * 2 ** (attempt - 1)));
        }
    }
};

export const createDriveFolder = async (accessToken: string, name: string, parentId: string | null): Promise<string> => {
    const { data } = await withRetry(() => axios.post(
        `${API}?supportsAllDrives=true&fields=id`,
        { name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) },
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: API_TIMEOUT_MS },
    ), accessToken);
    return data.id as string;
};

const folderInFlight = new Map<string, Promise<string>>();

const createProjectFolder = async (connection: DriveConnection, accessToken: string, projectId: string): Promise<string> => {
    const existing = await prisma.storageFolder.findUnique({
        where: { connectionId_projectId: { connectionId: connection.id, projectId } },
    });
    if (existing) return existing.folderId;

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
    const folderId = await createDriveFolder(accessToken, project?.name ?? projectId, connection.rootFolderId);
    try {
        await prisma.storageFolder.create({ data: { connectionId: connection.id, projectId, folderId } });
    } catch (error: any) {
        if (error?.code !== 'P2002') throw error;
        const winner = await prisma.storageFolder.findUnique({
            where: { connectionId_projectId: { connectionId: connection.id, projectId } },
        });
        if (winner) return winner.folderId;
        throw error;
    }
    return folderId;
};

const ensureProjectFolder = (connection: DriveConnection, accessToken: string, projectId: string): Promise<string> => {
    const key = `${connection.id}:${projectId}`;
    const pending = folderInFlight.get(key);
    if (pending) return pending;
    const promise = createProjectFolder(connection, accessToken, projectId).finally(() => folderInFlight.delete(key));
    folderInFlight.set(key, promise);
    return promise;
};

const buildMultipart = (metadata: object, buffer: Buffer, mimetype: string) => {
    const boundary = `bentifiles-${crypto.randomUUID()}`;
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Type: ${mimetype}\r\n\r\n`),
        buffer,
        Buffer.from(`\r\n--${boundary}--`),
    ]);
    return { body, contentType: `multipart/related; boundary=${boundary}` };
};

export const createGoogleDriveDriver = (connection: DriveConnection): StorageDriver => ({
    async put({ buffer, mimetype, projectId, displayName }: PutInput) {
        const accessToken = await getAccessToken(connection);
        const folderId = await ensureProjectFolder(connection, accessToken, projectId);
        const { body, contentType } = buildMultipart({ name: displayName, parents: [folderId] }, buffer, mimetype);

        const { data } = await withRetry(() => axios.post(
            `${UPLOAD_API}?uploadType=multipart&supportsAllDrives=true&fields=id`,
            body,
            { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType }, maxBodyLength: Infinity, timeout: UPLOAD_TIMEOUT_MS },
        ), accessToken);

        return {
            storageProvider: 'GDRIVE',
            storageRef: data.id as string,
            encryptedDek: null,
            iv: null,
            authTag: null,
            keyVersion: null,
            storageConnectionId: connection.id,
        };
    },

    async get(file: StoredFileRef) {
        const accessToken = await getAccessToken(connection);
        const { data } = await withRetry(() => axios.get(
            `${API}/${encodeURIComponent(file.storageRef)}?alt=media&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${accessToken}` }, responseType: 'arraybuffer', timeout: API_TIMEOUT_MS },
        ), accessToken);
        return Buffer.from(data);
    },

    async delete() {
        // Arquivos no Drive pertencem ao cliente: nunca apagamos.
    },

    async rename(file: StoredFileRef, name: string) {
        const accessToken = await getAccessToken(connection);
        await withRetry(() => axios.patch(
            `${API}/${encodeURIComponent(file.storageRef)}?supportsAllDrives=true`,
            { name },
            { headers: { Authorization: `Bearer ${accessToken}` }, timeout: API_TIMEOUT_MS },
        ), accessToken);
    },
});
