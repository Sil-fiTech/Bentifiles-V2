import axios from 'axios';
import crypto from 'crypto';

import { StorageError } from './types';

export const DRIVE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];
const STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const OAUTH_TIMEOUT_MS = 15_000;

export interface OAuthStatePayload {
    userId: string;
    subscriptionId: string | null;
    returnPath: string;
    nonceHash: string;
}

const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} nao configurada`);
    return value;
};

const sign = (body: string) =>
    crypto.createHmac('sha256', requireEnv('OAUTH_STATE_SECRET')).update(body).digest('base64url');

export const signState = (payload: OAuthStatePayload, now: Date = new Date()): string => {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: now.getTime() + STATE_TTL_MS })).toString('base64url');
    return `${body}.${sign(body)}`;
};

export const verifyState = (state: string, now: Date = new Date()): OAuthStatePayload => {
    const [body, signature] = state.split('.');
    if (!body || !signature) throw new Error('Estado OAuth inválido');
    const expected = Buffer.from(sign(body));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
        throw new Error('Estado OAuth inválido');
    }
    let parsed: any;
    try {
        parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
        throw new Error('Estado OAuth inválido');
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('Estado OAuth inválido');
    const { exp, ...payload } = parsed;
    if (typeof exp !== 'number' || exp < now.getTime()) throw new Error('Estado OAuth expirado');
    if (typeof payload.nonceHash !== 'string' || !payload.nonceHash) throw new Error('Estado OAuth inválido');
    return payload as OAuthStatePayload;
};

export const buildConsentUrl = (state: string): string => {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', requireEnv('GOOGLE_DRIVE_CLIENT_ID'));
    url.searchParams.set('redirect_uri', requireEnv('GOOGLE_DRIVE_REDIRECT_URI'));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', DRIVE_SCOPES.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
};

const tokenRequest = (params: Record<string, string>) =>
    axios.post(TOKEN_URL, new URLSearchParams({
        client_id: requireEnv('GOOGLE_DRIVE_CLIENT_ID'),
        client_secret: requireEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
        ...params,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: OAUTH_TIMEOUT_MS });

export const exchangeCode = async (code: string) => {
    const { data } = await tokenRequest({
        code,
        grant_type: 'authorization_code',
        redirect_uri: requireEnv('GOOGLE_DRIVE_REDIRECT_URI'),
    });
    if (!data.refresh_token) throw new Error('Google nao devolveu refresh token');

    const userInfo = await axios.get(USERINFO_URL, {
        headers: { Authorization: `Bearer ${data.access_token}` },
        timeout: OAUTH_TIMEOUT_MS,
    });

    return {
        refreshToken: data.refresh_token as string,
        accessToken: data.access_token as string,
        expiresIn: Number(data.expires_in),
        email: userInfo.data.email as string,
        scope: typeof data.scope === 'string' ? data.scope : '',
    };
};

export const refreshAccessToken = async (refreshToken: string) => {
    try {
        const { data } = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
        return { accessToken: data.access_token as string, expiresIn: Number(data.expires_in) };
    } catch (error: any) {
        if (error?.response?.data?.error === 'invalid_grant') {
            throw new StorageError('AUTH_REVOKED', 'Acesso ao Google Drive revogado');
        }
        throw new StorageError('UNAVAILABLE', 'Google indisponivel ao renovar o token');
    }
};

export const revokeToken = async (token: string): Promise<void> => {
    await axios.post(REVOKE_URL, new URLSearchParams({ token }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: OAUTH_TIMEOUT_MS,
    }).catch(() => undefined);
};
