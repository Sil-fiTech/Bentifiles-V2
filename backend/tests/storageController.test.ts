// backend/tests/storageController.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  subscription: { findFirst: vi.fn() },
  storageConnection: { findUnique: vi.fn() },
}));
vi.mock('../src/prisma', () => ({ default: prismaMock }));
const getOfficeSeatAccessForUser = vi.hoisted(() => vi.fn());
vi.mock('../src/services/officeSubscriptionService', () => ({ getOfficeSeatAccessForUser }));
const signState = vi.hoisted(() => vi.fn(() => 'signed'));
const getAccessToken = vi.hoisted(() => vi.fn());
vi.mock('../src/services/storage/googleOAuth', () => ({
  signState,
  verifyState: vi.fn(),
  buildConsentUrl: (s: string) => `https://google.test/auth?state=${s}`,
  exchangeCode: vi.fn(),
  revokeToken: vi.fn(),
}));
vi.mock('../src/services/storage/googleDriveDriver', () => ({ getAccessToken, createDriveFolder: vi.fn() }));
vi.mock('../src/utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

import { getPickerToken, resolveManageScope, startGoogleConnect } from '../src/controllers/storageController';
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
