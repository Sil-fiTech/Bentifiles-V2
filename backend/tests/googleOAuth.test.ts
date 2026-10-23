import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('axios', () => ({ default: axiosMock }));

import { buildConsentUrl, exchangeCode, refreshAccessToken, signState, verifyState } from '../src/services/storage/googleOAuth';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OAUTH_STATE_SECRET = 'segredo-de-teste';
  process.env.GOOGLE_DRIVE_CLIENT_ID = 'cid';
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'csecret';
  process.env.GOOGLE_DRIVE_REDIRECT_URI = 'https://api.test/api/storage/google/callback';
});

const payload = { userId: 'u1', subscriptionId: 's1', returnPath: '/subscription', nonceHash: 'a'.repeat(64) };
const t0 = new Date('2026-10-20T10:00:00Z');

describe('state', () => {
  it('faz ida e volta', () => {
    expect(verifyState(signState(payload, t0), t0)).toEqual(payload);
  });
  it('recusa state adulterado', () => {
    const state = signState(payload, t0);
    const [body, sig] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, userId: 'u2', exp: t0.getTime() + 60000 })).toString('base64url');
    expect(() => verifyState(`${forged}.${sig}`, t0)).toThrow('Estado OAuth inválido');
    expect(body).toBeTruthy();
  });
  it('recusa state com mais de 10 minutos', () => {
    const state = signState(payload, t0);
    expect(() => verifyState(state, new Date(t0.getTime() + 11 * 60 * 1000))).toThrow('Estado OAuth expirado');
  });
  it('recusa corpo assinado que não é JSON', () => {
    const body = Buffer.from('nao-e-json').toString('base64url');
    const sig = crypto.createHmac('sha256', 'segredo-de-teste').update(body).digest('base64url');
    expect(() => verifyState(`${body}.${sig}`, t0)).toThrow('Estado OAuth inválido');
  });
  it('recusa state assinado sem nonceHash', () => {
    const { nonceHash: _omit, ...semNonce } = payload;
    const state = signState(semNonce as any, t0);
    expect(() => verifyState(state, t0)).toThrow('Estado OAuth inválido');
  });
});

describe('buildConsentUrl', () => {
  it('pede drive.file, offline e consentimento', () => {
    const url = new URL(buildConsentUrl('abc'));
    expect(url.searchParams.get('scope')).toBe('openid email https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('abc');
  });
});

describe('exchangeCode', () => {
  it('devolve tokens e email', async () => {
    const scope = 'openid email https://www.googleapis.com/auth/drive.file';
    axiosMock.post.mockResolvedValue({ data: { refresh_token: 'r', access_token: 'a', expires_in: 3599, scope } });
    axiosMock.get.mockResolvedValue({ data: { email: 'escritorio@x.com' } });
    await expect(exchangeCode('code')).resolves.toEqual({ refreshToken: 'r', accessToken: 'a', expiresIn: 3599, email: 'escritorio@x.com', scope });
    expect(axiosMock.post.mock.calls[0]![2]).toMatchObject({ timeout: 15_000 });
    expect(axiosMock.get.mock.calls[0]![1]).toMatchObject({ timeout: 15_000 });
  });
  it('falha se o Google não mandar refresh token', async () => {
    axiosMock.post.mockResolvedValue({ data: { access_token: 'a', expires_in: 3599 } });
    await expect(exchangeCode('code')).rejects.toThrow(/refresh token/);
  });
});

describe('refreshAccessToken', () => {
  it('traduz invalid_grant em AUTH_REVOKED', async () => {
    axiosMock.post.mockRejectedValue({ response: { status: 400, data: { error: 'invalid_grant' } } });
    await expect(refreshAccessToken('r')).rejects.toMatchObject({ code: 'AUTH_REVOKED' });
  });
  it('traduz falha de rede em UNAVAILABLE', async () => {
    axiosMock.post.mockRejectedValue(new Error('ECONNRESET'));
    await expect(refreshAccessToken('r')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
