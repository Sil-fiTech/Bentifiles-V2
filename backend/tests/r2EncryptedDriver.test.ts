import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, Buffer>());
const r2 = vi.hoisted(() => ({
  putObject: vi.fn(async (key: string, body: Buffer) => { store.set(key, body); }),
  getObject: vi.fn(async (key: string) => {
    const value = store.get(key);
    if (!value) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return value;
  }),
  deleteObject: vi.fn(async (key: string) => { store.delete(key); }),
}));
vi.mock('../src/services/r2Service', () => r2);

import { r2EncryptedDriver } from '../src/services/storage/r2EncryptedDriver';
import { StorageError } from '../src/services/storage/types';

const input = { buffer: Buffer.from('%PDF conteudo'), mimetype: 'application/pdf', projectId: 'p1', displayName: 'rg.pdf' };

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  process.env.STORAGE_MASTER_KEY_V1 = crypto.randomBytes(32).toString('base64');
  process.env.STORAGE_MASTER_KEY_CURRENT = '1';
});

describe('r2EncryptedDriver', () => {
  it('grava cifrado, com chave UUID sem extensão', async () => {
    const stored = await r2EncryptedDriver.put(input);
    expect(stored.storageProvider).toBe('R2');
    expect(stored.storageRef).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.storageConnectionId).toBeNull();
    const raw = store.get(stored.storageRef)!;
    expect(raw.includes(Buffer.from('%PDF'))).toBe(false);
  });

  it('lê e decifra o que gravou', async () => {
    const stored = await r2EncryptedDriver.put(input);
    const back = await r2EncryptedDriver.get({ ...stored, purgedAt: null });
    expect(back.toString()).toBe('%PDF conteudo');
  });

  it('lê arquivo legado (sem DEK) como está', async () => {
    store.set('legacy.pdf', Buffer.from('aberto'));
    const back = await r2EncryptedDriver.get({
      storageProvider: 'R2', storageRef: 'legacy.pdf', encryptedDek: null, iv: null, authTag: null, keyVersion: null, purgedAt: null,
    });
    expect(back.toString()).toBe('aberto');
  });

  it('recusa arquivo expurgado com PURGED', async () => {
    await expect(r2EncryptedDriver.get({
      storageProvider: 'R2', storageRef: 'x', encryptedDek: null, iv: null, authTag: null, keyVersion: null, purgedAt: new Date(),
    })).rejects.toMatchObject({ code: 'PURGED' });
  });

  it('traduz objeto ausente para NOT_FOUND', async () => {
    const error = await r2EncryptedDriver.get({
      storageProvider: 'R2', storageRef: 'sumiu', encryptedDek: null, iv: null, authTag: null, keyVersion: null, purgedAt: null,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('apaga o objeto', async () => {
    const stored = await r2EncryptedDriver.put(input);
    await r2EncryptedDriver.delete({ ...stored, purgedAt: null });
    expect(store.has(stored.storageRef)).toBe(false);
  });
});
