import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const FIELD_PREFIX = 'enc:v';

export interface EncryptionMeta {
    iv: string;
    authTag: string;
    encryptedDek: string;
    keyVersion: number;
}

export interface EncryptedBlob extends EncryptionMeta {
    ciphertext: Buffer;
}

export const getCurrentKeyVersion = (): number => {
    const raw = process.env.STORAGE_MASTER_KEY_CURRENT;
    const version = Number(raw);
    if (!raw || !Number.isInteger(version) || version < 1) {
        throw new Error('STORAGE_MASTER_KEY_CURRENT deve ser um inteiro >= 1');
    }
    return version;
};

const loadKek = (version: number): Buffer => {
    const name = `STORAGE_MASTER_KEY_V${version}`;
    const raw = process.env[name];
    if (!raw) throw new Error(`${name} nao configurada`);
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_LENGTH) throw new Error(`${name} deve ter 32 bytes em base64`);
    return key;
};

export const assertStorageKeysConfigured = (): void => {
    loadKek(getCurrentKeyVersion());
};

// iv | tag | ciphertext, usado para a DEK e para campos curtos.
const seal = (key: Buffer, plaintext: Buffer): Buffer => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
};

const open = (key: Buffer, packed: Buffer): Buffer => {
    const iv = packed.subarray(0, IV_LENGTH);
    const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const encryptBuffer = (plaintext: Buffer): EncryptedBlob => {
    const keyVersion = getCurrentKeyVersion();
    const dek = crypto.randomBytes(KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return {
        ciphertext,
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        encryptedDek: seal(loadKek(keyVersion), dek).toString('base64'),
        keyVersion,
    };
};

export const decryptBuffer = (ciphertext: Buffer, meta: EncryptionMeta): Buffer => {
    const dek = open(loadKek(meta.keyVersion), Buffer.from(meta.encryptedDek, 'base64'));
    const decipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(meta.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(meta.authTag, 'base64'));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const encryptField = (value: string): string => {
    const version = getCurrentKeyVersion();
    const packed = seal(loadKek(version), Buffer.from(value, 'utf8'));
    return `${FIELD_PREFIX}${version}:${packed.toString('base64')}`;
};

export const decryptField = (value: string): string => {
    // Linhas anteriores à migração ainda guardam texto puro.
    if (!value.startsWith(FIELD_PREFIX)) return value;
    const separator = value.indexOf(':', FIELD_PREFIX.length);
    const version = Number(value.slice(FIELD_PREFIX.length, separator));
    const packed = Buffer.from(value.slice(separator + 1), 'base64');
    return open(loadKek(version), packed).toString('utf8');
};
