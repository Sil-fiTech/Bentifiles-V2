// backend/tests/storageController.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  subscription: { findFirst: vi.fn() },
  storageConnection: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  storageFolder: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../src/prisma', () => ({ default: prismaMock }));
const getOfficeSeatAccessForUser = vi.hoisted(() => vi.fn());
vi.mock('../src/services/officeSubscriptionService', () => ({ getOfficeSeatAccessForUser }));
const signState = vi.hoisted(() => vi.fn(() => 'signed'));
const verifyState = vi.hoisted(() => vi.fn());
const exchangeCode = vi.hoisted(() => vi.fn());
const revokeToken = vi.hoisted(() => vi.fn());
const decryptField = vi.hoisted(() => vi.fn());
const getAccessToken = vi.hoisted(() => vi.fn());
vi.mock('../src/services/storage/googleOAuth', () => ({
  signState,
  verifyState,
  buildConsentUrl: (s: string) => `https://google.test/auth?state=${s}`,
  exchangeCode,
  revokeToken,
}));
vi.mock('../src/services/storage/envelopeCrypto', () => ({ encryptField: (v: string) => `enc:${v}`, decryptField }));
vi.mock('../src/services/storage/googleDriveDriver', () => ({ getAccessToken, createDriveFolder: vi.fn() }));
vi.mock('../src/utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

import { disconnect, getPickerToken, googleCallback, resolveManageScope, startGoogleConnect } from '../src/controllers/storageController';
import { StorageError } from '../src/services/storage/types';

const makeRes = () => {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe('resolveManageScope', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns OFFICE scope for the owner of an OFFICE subscription', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ id: 'sub1' });
    expect(await resolveManageScope('u1')).toEqual({ kind: 'OFFICE', subscriptionId: 'sub1' });
  });

  it('returns null for an Office seat that is not the owner', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    getOfficeSeatAccessForUser.mockResolvedValue({ subscriptionId: 'sub1' });
    expect(await resolveManageScope('u2')).toBeNull();
  });

  it('returns USER scope for an individual user', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    getOfficeSeatAccessForUser.mockResolvedValue(null);
    expect(await resolveManageScope('u3')).toEqual({ kind: 'USER', userId: 'u3' });
  });
});

describe('startGoogleConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    getOfficeSeatAccessForUser.mockResolvedValue(null);
  });

  it('falls back to /profile when returnPath is outside the allow-list', async () => {
    const res = makeRes();
    await startGoogleConnect({ user: { userId: 'u1' }, query: { returnPath: 'https://evil.com' } } as any, res);
    expect(signState).toHaveBeenCalledWith({ userId: 'u1', subscriptionId: null, returnPath: '/profile' });
  });

  it('keeps an allowed returnPath', async () => {
    const res = makeRes();
    await startGoogleConnect({ user: { userId: 'u1' }, query: { returnPath: '/subscription' } } as any, res);
    expect(signState).toHaveBeenCalledWith({ userId: 'u1', subscriptionId: null, returnPath: '/subscription' });
  });

  it('responds 403 for non-owner Office seats', async () => {
    getOfficeSeatAccessForUser.mockResolvedValue({ subscriptionId: 'sub1' });
    const res = makeRes();
    await startGoogleConnect({ user: { userId: 'u2' }, query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('getPickerToken', () => {
  it('maps StorageError to an HTTP status instead of throwing', async () => {
    vi.clearAllMocks();
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    getOfficeSeatAccessForUser.mockResolvedValue(null);
    prismaMock.storageConnection.findUnique.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
    getAccessToken.mockRejectedValue(new StorageError('AUTH_REVOKED', 'revoked'));
    const res = makeRes();
    await getPickerToken({ user: { userId: 'u1' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('googleCallback', () => {
  const makeCallbackRes = () => ({ redirect: vi.fn() }) as any;
  const call = (res: any) => googleCallback({ query: { code: 'c', state: 's' } } as any, res);
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    verifyState.mockReturnValue({ userId: 'u1', subscriptionId: null, returnPath: '/subscription' });
    exchangeCode.mockResolvedValue({ email: 'new@x.com', refreshToken: 'rt' });
  });

  it('redirects with storage=error and writes nothing on invalid state', async () => {
    verifyState.mockImplementation(() => { throw new Error('bad state'); });
    const res = makeCallbackRes();
    await call(res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringMatching(/\/profile\?storage=error$/));
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('falls back to /profile when the state returnPath is not allowed', async () => {
    verifyState.mockReturnValue({ userId: 'u1', subscriptionId: null, returnPath: 'https://evil.com' });
    prismaMock.storageConnection.findUnique.mockResolvedValue(null);
    prismaMock.storageConnection.upsert.mockResolvedValue({ id: 'c1' });
    const res = makeCallbackRes();
    await call(res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringMatching(/\/profile\?storage=connected$/));
  });

  it('upserts and clears folders when the account email is the same', async () => {
    prismaMock.storageConnection.findUnique.mockResolvedValue({ id: 'c1', googleAccountEmail: 'new@x.com' });
    prismaMock.storageConnection.upsert.mockResolvedValue({ id: 'c1' });
    const res = makeCallbackRes();
    await call(res);
    expect(prismaMock.storageConnection.upsert).toHaveBeenCalled();
    expect(prismaMock.storageConnection.create).not.toHaveBeenCalled();
    expect(prismaMock.storageFolder.deleteMany).toHaveBeenCalledWith({ where: { connectionId: 'c1' } });
    expect(res.redirect).toHaveBeenCalledWith(expect.stringMatching(/\/subscription\?storage=connected$/));
  });

  it('detaches the old row and creates a new one when the account email differs', async () => {
    prismaMock.storageConnection.findUnique.mockResolvedValue({ id: 'old', googleAccountEmail: 'old@x.com' });
    prismaMock.storageConnection.create.mockResolvedValue({ id: 'new' });
    const res = makeCallbackRes();
    await call(res);
    expect(prismaMock.storageConnection.update).toHaveBeenCalledWith({
      where: { id: 'old' },
      data: { subscriptionId: null, userId: null, status: 'REVOKED' },
    });
    expect(prismaMock.storageConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', googleAccountEmail: 'new@x.com', status: 'ACTIVE' }),
    });
    expect(prismaMock.storageConnection.upsert).not.toHaveBeenCalled();
    expect(prismaMock.storageFolder.deleteMany).toHaveBeenCalledWith({ where: { connectionId: 'new' } });
  });
});

describe('disconnect', () => {
  it('still marks the row REVOKED and succeeds when decrypt throws', async () => {
    vi.clearAllMocks();
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    getOfficeSeatAccessForUser.mockResolvedValue(null);
    prismaMock.storageConnection.findUnique.mockResolvedValue({ id: 'c1', encryptedRefreshToken: 'x' });
    decryptField.mockImplementation(() => { throw new Error('bad ciphertext'); });
    const res = makeRes();
    await disconnect({ user: { userId: 'u1' } } as any, res);
    expect(prismaMock.storageConnection.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'REVOKED', lastError: null },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
