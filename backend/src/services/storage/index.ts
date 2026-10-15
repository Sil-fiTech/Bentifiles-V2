import { r2EncryptedDriver } from './r2EncryptedDriver';
import { PutInput, StorageDriver, StoredFileRef, StoredObject } from './types';

const driverFor = (_file: StoredFileRef): StorageDriver => {
    return r2EncryptedDriver;
};

export const storeFile = async (input: PutInput): Promise<StoredObject> => r2EncryptedDriver.put(input);

export const readFile = async (file: StoredFileRef): Promise<Buffer> => driverFor(file).get(file);

export const deleteStoredFile = async (file: StoredFileRef): Promise<void> => driverFor(file).delete(file);

export const renameStoredFile = async (file: StoredFileRef, name: string): Promise<void> => {
    const driver = driverFor(file);
    if (driver.rename) await driver.rename(file, name);
};
