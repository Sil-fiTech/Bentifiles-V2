// backend/tests/storageRouting.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  storageConnection: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));
vi.mock('../src/prisma', () => ({ default: prismaMock }));
const getOfficeSeatAccessForUser = vi.hoisted(() => vi.fn());
vi.mock('../src/services/officeSubscriptionService', () => ({ getOfficeSeatAccessForUser }));
const sendStorageConnectionAlertEmail = vi.hoisted(() => vi.fn());
vi.mock('../src/services/emailService', () => ({ sendStorageConnectionAlertEmail }));
const drivePut = vi.hoisted(() => vi.fn());
const driveGet = vi.hoisted(() => vi.fn());
vi.mock('../src/services/storage/googleDriveDriver', () => ({
  createGoogleDriveDriver: () => ({ put: drivePut, get: driveGet, delete: vi.fn() }),
}));
const r2Put = vi.hoisted(() => vi.fn());
vi.mock('../src/services/storage/r2EncryptedDriver', () => ({ r2EncryptedDriver: { put: r2Put, get: vi.fn(), delete: vi.fn() } }));
vi.mock('../src/utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

import { readFile, storeFile } from '../src/services/storage';
import { resolveConnectionForProject } from '../src/services/storage/storageConnectionService';
import { StorageError } from '../src/services/storage/types';

const officeConn = { id: 'office', status: 'ACTIVE', rootFolderId: 'r1', lastError: null, connectedByUserId: 'owner' };
const ownConn = { id: 'own', status: 'ACTIVE', rootFolderId: 'r2', lastError: null, connectedByUserId: 'creator' };
const input = { buffer: Buffer.from('x'), mimetype: 'application/pdf', projectId: 'p1', displayName: 'rg.pdf' };
const r2Result = { storageProvider: 'R2', storageRef: 'uuid', storageConnectionId: null };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findUnique.mockResolvedValue({ createdByUserId: 'creator' });
  prismaMock.user.findUnique.mockResolvedValue({ email: 'owner@x.com', name: 'Dona' });
  r2Put.mockResolvedValue(r2Result);
});

describe('resolveConnectionForProject', () => {
  it('prefere o Drive do escritório', async () => {
    getOfficeSeatAccessForUser.mockResolvedValue({ subscriptionId: 's1' });
    prismaMock.storageConnection.findUnique.mockImplementation(({ where }: any) => (where.subscriptionId ? officeConn : ownConn));
    await expect(resolveConnectionForProject('p1')).resolves.toBe(officeConn);
  });

  it('usa o Drive do criador quando o escritório não conectou', async () => {
    getOfficeSeatAccessForUser.mockResolvedValue({ subscriptionId: 's1' });
    prismaMock.storageConnection.findUnique.mockImplementation(({ where }: any) => (where.subscriptionId ? null : ownConn));
    await expect(resolveConnectionForProject('p1')).resolves.toBe(ownConn);
  });

  it('ignora conexão revogada ou sem pasta escolhida', async () => {
    getOfficeSeatAccessForUser.mockResolvedValue(null);
    prismaMock.storageConnection.findUnique.mockResolvedValue({ ...ownConn, rootFolderId: null });
    await expect(resolveConnectionForProject('p1')).resolves.toBeNull();
    prismaMock.storageConnection.findUnique.mockResolvedValue({ ...ownConn, status: 'REVOKED' });
    await expect(resolveConnectionForProject('p1')).resolves.toBeNull();
  });
});

describe('storeFile', () => {
  beforeEach(() => {
    getOfficeSeatAccessForUser.mockResolvedValue(null);
    prismaMock.storageConnection.findUnique.mockResolvedValue(ownConn);
  });

  it('grava no Drive quando há conexão', async () => {
    drivePut.mockResolvedValue({ storageProvider: 'GDRIVE', storageRef: 'd1', storageConnectionId: 'own' });
    await expect(storeFile(input)).resolves.toMatchObject({ storageProvider: 'GDRIVE' });
    expect(r2Put).not.toHaveBeenCalled();
  });

  it('cai para o R2 e revoga a conexão quando o token foi revogado', async () => {
    drivePut.mockRejectedValue(new StorageError('AUTH_REVOKED', 'x'));
    await expect(storeFile(input)).resolves.toBe(r2Result);
    expect(prismaMock.storageConnection.update).toHaveBeenCalledWith({ where: { id: 'own' }, data: { status: 'REVOKED', lastError: 'AUTH_REVOKED' } });
    expect(sendStorageConnectionAlertEmail).toHaveBeenCalledWith({ email: 'owner@x.com', name: 'Dona', reason: 'AUTH_REVOKED' });
  });

  it('com Drive cheio, avisa só na primeira vez', async () => {
    drivePut.mockRejectedValue(new StorageError('QUOTA', 'x'));
    await storeFile(input);
    prismaMock.storageConnection.findUnique.mockResolvedValue({ ...ownConn, lastError: 'QUOTA' });
    await storeFile(input);
    expect(sendStorageConnectionAlertEmail).toHaveBeenCalledTimes(1);
    expect(r2Put).toHaveBeenCalledTimes(2);
  });

  it('erro inesperado do Drive também cai para o R2', async () => {
    drivePut.mockRejectedValue(new Error('bug'));
    await expect(storeFile(input)).resolves.toBe(r2Result);
  });
});

describe('readFile (Drive)', () => {
  const ref = { storageProvider: 'GDRIVE' as const, storageRef: 'd1', encryptedDek: null, iv: null, authTag: null, keyVersion: null, purgedAt: null, storageConnectionId: 'own' };

  it('responde DISCONNECTED se a conexão foi removida ou revogada', async () => {
    prismaMock.storageConnection.findUnique.mockResolvedValue(null);
    await expect(readFile(ref)).rejects.toMatchObject({ code: 'DISCONNECTED' });
    prismaMock.storageConnection.findUnique.mockResolvedValue({ ...ownConn, status: 'REVOKED' });
    await expect(readFile(ref)).rejects.toMatchObject({ code: 'DISCONNECTED' });
  });

  it('lê pelo driver do Drive quando ativa', async () => {
    prismaMock.storageConnection.findUnique.mockResolvedValue(ownConn);
    driveGet.mockResolvedValue(Buffer.from('ok'));
    await expect(readFile(ref)).resolves.toEqual(Buffer.from('ok'));
  });
});
