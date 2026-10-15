import crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertStorageKeysConfigured,
  decryptBuffer,
  decryptField,
  encryptBuffer,
  encryptField,
} from '../src/services/storage/envelopeCrypto';

const key = () => crypto.randomBytes(32).toString('base64');

beforeEach(() => {
  process.env.STORAGE_MASTER_KEY_V1 = key();
  delete process.env.STORAGE_MASTER_KEY_V2;
  process.env.STORAGE_MASTER_KEY_CURRENT = '1';
});

describe('encryptBuffer / decryptBuffer', () => {
  it('devolve o conteúdo original', () => {
    const plain = Buffer.from('%PDF-1.7 documento');
    const blob = encryptBuffer(plain);
    expect(blob.ciphertext.equals(plain)).toBe(false);
    expect(blob.keyVersion).toBe(1);
    expect(decryptBuffer(blob.ciphertext, blob).equals(plain)).toBe(true);
  });

  it('usa IV e DEK diferentes a cada chamada', () => {
    const a = encryptBuffer(Buffer.from('x'));
    const b = encryptBuffer(Buffer.from('x'));
    expect(a.iv).not.toBe(b.iv);
    expect(a.encryptedDek).not.toBe(b.encryptedDek);
  });

  it('falha se o ciphertext for adulterado', () => {
    const blob = encryptBuffer(Buffer.from('conteudo'));
    const tampered = Buffer.from(blob.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => decryptBuffer(tampered, blob)).toThrow();
  });

  it('falha se a tag for trocada', () => {
    const blob = encryptBuffer(Buffer.from('conteudo'));
    const other = encryptBuffer(Buffer.from('conteudo'));
    expect(() => decryptBuffer(blob.ciphertext, { ...blob, authTag: other.authTag })).toThrow();
  });

  it('falha se a tag for truncada', () => {
    const blob = encryptBuffer(Buffer.from('conteudo'));
    const short = Buffer.from(blob.authTag, 'base64').subarray(0, 4).toString('base64');
    expect(() => decryptBuffer(blob.ciphertext, { ...blob, authTag: short })).toThrow();
  });

  it('falha com a KEK errada', () => {
    const blob = encryptBuffer(Buffer.from('conteudo'));
    process.env.STORAGE_MASTER_KEY_V1 = key();
    expect(() => decryptBuffer(blob.ciphertext, blob)).toThrow();
  });

  it('decifra com a versão de KEK registrada, mesmo após rotação', () => {
    const blob = encryptBuffer(Buffer.from('antigo'));
    process.env.STORAGE_MASTER_KEY_V2 = key();
    process.env.STORAGE_MASTER_KEY_CURRENT = '2';
    expect(encryptBuffer(Buffer.from('novo')).keyVersion).toBe(2);
    expect(decryptBuffer(blob.ciphertext, blob).toString()).toBe('antigo');
  });
});

describe('encryptField / decryptField', () => {
  it('faz ida e volta com acentos e emoji', () => {
    const name = 'Certidão de nascimento 👶 — João.pdf';
    const enc = encryptField(name);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain('Certid');
    expect(decryptField(enc)).toBe(name);
  });

  it.each(['enc:v1', 'enc:v1abc', 'enc:vabc:AAAA', 'enc:v0:AAAA', 'enc:v:AAAA'])(
    'rejeita campo malformado %s',
    (bad) => {
      expect(() => decryptField(bad)).toThrow(/malformado/);
    },
  );

  it('devolve texto legado sem prefixo como está', () => {
    expect(decryptField('rg-frente.jpg')).toBe('rg-frente.jpg');
  });
});

describe('assertStorageKeysConfigured', () => {
  it('passa com uma chave de 32 bytes', () => {
    expect(() => assertStorageKeysConfigured()).not.toThrow();
  });

  it('falha sem a chave atual', () => {
    delete process.env.STORAGE_MASTER_KEY_V1;
    expect(() => assertStorageKeysConfigured()).toThrow(/STORAGE_MASTER_KEY_V1/);
  });

  it('falha com chave de tamanho errado', () => {
    process.env.STORAGE_MASTER_KEY_V1 = crypto.randomBytes(16).toString('base64');
    expect(() => assertStorageKeysConfigured()).toThrow(/32 bytes/);
  });

  it('falha com versão atual inválida', () => {
    process.env.STORAGE_MASTER_KEY_CURRENT = 'abc';
    expect(() => assertStorageKeysConfigured()).toThrow(/STORAGE_MASTER_KEY_CURRENT/);
  });
});
