import { decryptField } from './envelopeCrypto';

type HiddenKeys = 'filename' | 'encryptedDek' | 'iv' | 'authTag' | 'keyVersion' | 'storageRef';

export const serializeFile = <T extends { originalName: string }>(file: T): Omit<T, HiddenKeys> => {
    const { encryptedDek, iv, authTag, keyVersion, storageRef, ...rest } = file as T & Record<HiddenKeys, unknown>;
    return { ...rest, originalName: decryptField(file.originalName) } as Omit<T, HiddenKeys>;
};
