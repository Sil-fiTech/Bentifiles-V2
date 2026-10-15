import prisma from '../../prisma';
import { logError, logWarn } from '../../utils/logger';
import { createGoogleDriveDriver } from './googleDriveDriver';
import { r2EncryptedDriver } from './r2EncryptedDriver';
import { clearConnectionFailure, recordConnectionFailure, resolveConnectionForProject } from './storageConnectionService';
import { PutInput, StorageDriver, StorageError, StoredFileRef, StoredObject } from './types';

const driverFor = async (file: StoredFileRef): Promise<StorageDriver> => {
    if (file.storageProvider !== 'GDRIVE') return r2EncryptedDriver;

    const connection = file.storageConnectionId
        ? await prisma.storageConnection.findUnique({ where: { id: file.storageConnectionId } })
        : null;
    if (!connection || connection.status !== 'ACTIVE') {
        throw new StorageError('DISCONNECTED', 'Google Drive desconectado');
    }
    return createGoogleDriveDriver(connection);
};

export const storeFile = async (input: PutInput): Promise<StoredObject> => {
    const connection = await resolveConnectionForProject(input.projectId);
    if (!connection) return r2EncryptedDriver.put(input);

    try {
        const stored = await createGoogleDriveDriver(connection).put(input);
        await clearConnectionFailure(connection);
        return stored;
    } catch (error) {
        if (error instanceof StorageError) {
            logWarn('Drive upload failed, falling back to R2', { connectionId: connection.id, code: error.code });
            await recordConnectionFailure(connection, error).catch((e) => logError('Failed to record Drive failure', e));
        } else {
            logError('Unexpected Drive upload error, falling back to R2', error, { connectionId: connection.id });
        }
        return r2EncryptedDriver.put(input);
    }
};

export const readFile = async (file: StoredFileRef): Promise<Buffer> => (await driverFor(file)).get(file);

export const deleteStoredFile = async (file: StoredFileRef): Promise<void> => (await driverFor(file)).delete(file);

export const renameStoredFile = async (file: StoredFileRef, name: string): Promise<void> => {
    const driver = await driverFor(file);
    if (driver.rename) await driver.rename(file, name);
};
