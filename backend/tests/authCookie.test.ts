import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthCookieOptions } from '../src/utils/authCookie';

afterEach(() => vi.unstubAllEnvs());

describe('getAuthCookieOptions', () => {
  it('em produção: secure e sameSite none (front e API em domínios distintos)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getAuthCookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none', path: '/' });
  });

  it('fora de produção: não-secure e sameSite lax', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(getAuthCookieOptions()).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax' });
  });

  it('expira em 24h', () => {
    expect(getAuthCookieOptions().maxAge).toBe(24 * 60 * 60 * 1000);
  });
});
