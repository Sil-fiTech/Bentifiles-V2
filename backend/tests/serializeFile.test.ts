import crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { encryptField } from '../src/services/storage/envelopeCrypto';
import { storageErrorToHttp } from '../src/services/storage/httpErrors';
import { serializeFile } from '../src/services/storage/serializeFile';
import { StorageError } from '../src/services/storage/types';

beforeEach(() => {
  process.env.STORAGE_MASTER_KEY_V1 = crypto.randomBytes(32).toString('base64');
  process.env.STORAGE_MASTER_KEY_CURRENT = '1';
});

describe('serializeFile', () => {
  it('decifra o nome e esconde os campos de criptografia', () => {
    const out = serializeFile({
      id: 'f1', originalName: encryptField('CNH.png'), filename: 'uuid', storageRef: 'uuid', encryptedDek: 'x', iv: 'y', authTag: 'z', keyVersion: 1, purgedAt: null,
    });
    expect(out).toEqual({ id: 'f1', originalName: 'CNH.png', purgedAt: null });
  });

  it('aceita nome legado em texto puro', () => {
    expect(serializeFile({ originalName: 'antigo.pdf' }).originalName).toBe('antigo.pdf');
  });
});

describe('storageErrorToHttp', () => {
  it('mapeia PURGED para 410', () => {
    expect(storageErrorToHttp(new StorageError('PURGED', 'x'))).toEqual({ status: 410, message: 'Arquivo expirado: o projeto foi arquivado há mais de 7 dias.' });
  });
  it('mapeia NOT_FOUND para 404', () => {
    expect(storageErrorToHttp(new StorageError('NOT_FOUND', 'x'))?.status).toBe(404);
  });
  it('mapeia NOT_FOUND de arquivo no Drive para 410', () => {
    expect(storageErrorToHttp(new StorageError('NOT_FOUND', 'x'), 'GDRIVE')).toEqual({ status: 410, message: 'Arquivo removido do Google Drive' });
  });
  it('mantém 404 para NOT_FOUND no R2', () => {
    expect(storageErrorToHttp(new StorageError('NOT_FOUND', 'x'), 'R2')?.status).toBe(404);
  });
  it('mapeia DISCONNECTED para 409', () => {
    expect(storageErrorToHttp(new StorageError('DISCONNECTED', 'x'))?.status).toBe(409);
  });
  it('ignora erros que não são de storage', () => {
    expect(storageErrorToHttp(new Error('boom'))).toBeNull();
  });
});
