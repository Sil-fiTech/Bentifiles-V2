import crypto from 'crypto';
import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma';
import { getOfficeSeatAccessForUser } from '../services/officeSubscriptionService';
import { decryptField, encryptField } from '../services/storage/envelopeCrypto';
import { createDriveFolder, getAccessToken } from '../services/storage/googleDriveDriver';
import { buildConsentUrl, exchangeCode, revokeToken, signState, verifyState } from '../services/storage/googleOAuth';
import { storageErrorToHttp } from '../services/storage/httpErrors';
import { getAuthCookieOptions } from '../utils/authCookie';
import { logError } from '../utils/logger';

type ManageScope = { kind: 'OFFICE'; subscriptionId: string } | { kind: 'USER'; userId: string } | null;

const ALLOWED_RETURN_PATHS = new Set(['/profile', '/subscription']);
const NONCE_COOKIE = 'gdrive_oauth_nonce';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const nonceCookieOptions = () => ({ ...getAuthCookieOptions(), maxAge: 10 * 60 * 1000, path: '/api/storage/google' });
const sha256Hex = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const nonceMatches = (cookieNonce: unknown, nonceHash: string): boolean => {
    if (typeof cookieNonce !== 'string' || !cookieNonce) return false;
    const expected = Buffer.from(nonceHash);
    const received = Buffer.from(sha256Hex(cookieNonce));
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

export const resolveManageScope = async (userId: string): Promise<ManageScope> => {
    const office = await prisma.subscription.findFirst({ where: { ownerId: userId, plan: 'OFFICE' }, select: { id: true } });
    if (office) return { kind: 'OFFICE', subscriptionId: office.id };

    const seat = await getOfficeSeatAccessForUser(userId);
    if (seat) return null; // vaga do escritório: quem conecta é o dono

    return { kind: 'USER', userId };
};

const whereForScope = (scope: NonNullable<ManageScope>) =>
    scope.kind === 'OFFICE' ? { subscriptionId: scope.subscriptionId } : { userId: scope.userId };

const findConnection = (scope: NonNullable<ManageScope>) =>
    prisma.storageConnection.findUnique({ where: whereForScope(scope) });

const publicConnection = (connection: Awaited<ReturnType<typeof findConnection>>) => connection && {
    googleAccountEmail: connection.googleAccountEmail,
    status: connection.status,
    rootFolderId: connection.rootFolderId,
    sharedDriveId: connection.sharedDriveId,
    lastError: connection.lastError,
};

const frontendUrl = () => {
    const url = process.env.FRONTEND_URL || 'http://localhost:3000';
    return url.startsWith('http') ? url : `https://${url}`;
};

export const getConnection = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const scope = await resolveManageScope(userId);
    if (!scope) return res.json({ canManage: false, scope: null, connection: null });
    res.json({ canManage: true, scope: scope.kind, connection: publicConnection(await findConnection(scope)) });
};

export const startGoogleConnect = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const scope = await resolveManageScope(userId);
    if (!scope) return res.status(403).json({ message: 'Apenas o dono da assinatura do escritório pode conectar o Drive.' });

    const requested = typeof req.query.returnPath === 'string' ? req.query.returnPath : '/profile';
    const returnPath = ALLOWED_RETURN_PATHS.has(requested) ? requested : '/profile';
    // Amarra o callback ao navegador que iniciou o fluxo (evita login CSRF / troca de conta).
    const nonce = crypto.randomBytes(32).toString('hex');
    res.cookie(NONCE_COOKIE, nonce, nonceCookieOptions());
    const state = signState({
        userId,
        subscriptionId: scope.kind === 'OFFICE' ? scope.subscriptionId : null,
        returnPath,
        nonceHash: sha256Hex(nonce),
    });
    res.json({ url: buildConsentUrl(state) });
};

export const googleCallback = async (req: AuthRequest, res: Response) => {
    let returnPath = '/profile';
    const cookieNonce = req.cookies?.[NONCE_COOKIE];
    res.clearCookie(NONCE_COOKIE, nonceCookieOptions());
    try {
        const { code, state } = req.query;
        if (typeof code !== 'string' || typeof state !== 'string') throw new Error('Parametros ausentes');
        const payload = verifyState(state);
        returnPath = ALLOWED_RETURN_PATHS.has(payload.returnPath) ? payload.returnPath : '/profile';
        if (!nonceMatches(cookieNonce, payload.nonceHash)) throw new Error('Nonce OAuth ausente ou divergente');

        const tokens = await exchangeCode(code);
        if (!tokens.scope.split(' ').includes(DRIVE_FILE_SCOPE)) throw new Error('Escopo drive.file nao concedido');
        const ownerWhere = payload.subscriptionId ? { subscriptionId: payload.subscriptionId } : { userId: payload.userId };
        const data = {
            provider: 'GDRIVE' as const,
            connectedByUserId: payload.userId,
            googleAccountEmail: tokens.email,
            encryptedRefreshToken: encryptField(tokens.refreshToken),
            rootFolderId: null,
            sharedDriveId: null,
            status: 'ACTIVE' as const,
            lastError: null,
        };

        const detached = await prisma.$transaction(async (tx) => {
            const existing = await tx.storageConnection.findUnique({ where: ownerWhere });
            let connection;
            let detachedRow: typeof existing = null;
            if (existing && existing.googleAccountEmail !== tokens.email) {
                detachedRow = existing;
                // Outra conta Google: preserva a linha antiga (arquivos antigos resolvem para DISCONNECTED/409).
                await tx.storageConnection.update({
                    where: { id: existing.id },
                    data: { subscriptionId: null, userId: null, status: 'REVOKED' },
                });
                connection = await tx.storageConnection.create({ data: { ...ownerWhere, ...data } });
            } else {
                connection = await tx.storageConnection.upsert({
                    where: ownerWhere,
                    create: { ...ownerWhere, ...data },
                    update: data,
                });
            }
            // Pastas de projeto antigas pertenciam ao Drive anterior.
            await tx.storageFolder.deleteMany({ where: { connectionId: connection.id } });
            return detachedRow;
        });

        if (detached) {
            // Melhor esforço: a conta Google anterior não deve manter um refresh token válido.
            try {
                await revokeToken(decryptField(detached.encryptedRefreshToken));
            } catch (error) {
                logError('Failed to revoke previous Google account token', error);
            }
        }

        res.redirect(`${frontendUrl()}${returnPath}?storage=connected`);
    } catch (error) {
        logError('Google Drive connect callback failed', error);
        res.redirect(`${frontendUrl()}${returnPath}?storage=error`);
    }
};

export const getPickerToken = async (req: AuthRequest, res: Response) => {
    const scope = await resolveManageScope(req.user!.userId);
    const connection = scope && await findConnection(scope);
    if (!connection || connection.status !== 'ACTIVE') return res.status(404).json({ message: 'Drive não conectado' });
    try {
        res.json({ accessToken: await getAccessToken(connection) });
    } catch (error) {
        const mapped = storageErrorToHttp(error);
        if (!mapped) throw error;
        res.status(mapped.status).json({ message: mapped.message });
    }
};

export const setFolder = async (req: AuthRequest, res: Response) => {
    try {
        const scope = await resolveManageScope(req.user!.userId);
        const connection = scope && await findConnection(scope);
        if (!connection || connection.status !== 'ACTIVE') return res.status(404).json({ message: 'Drive não conectado' });

        const { mode, folderId, sharedDriveId } = req.body ?? {};
        let rootFolderId: string;
        let resolvedSharedDrive: string | null = null;

        if (mode === 'create') {
            rootFolderId = await createDriveFolder(await getAccessToken(connection), 'BentiFiles', null);
        } else if (mode === 'picked' && typeof folderId === 'string' && folderId) {
            rootFolderId = folderId;
            resolvedSharedDrive = typeof sharedDriveId === 'string' && sharedDriveId ? sharedDriveId : null;
        } else {
            return res.status(400).json({ message: 'Escolha uma pasta válida' });
        }

        const updated = await prisma.storageConnection.update({
            where: { id: connection.id },
            data: { rootFolderId, sharedDriveId: resolvedSharedDrive },
        });
        await prisma.storageFolder.deleteMany({ where: { connectionId: connection.id } });
        res.json({ connection: publicConnection(updated) });
    } catch (error) {
        logError('Failed to set Drive folder', error);
        const mapped = storageErrorToHttp(error);
        if (mapped) return res.status(mapped.status).json({ message: mapped.message });
        res.status(502).json({ message: 'Não foi possível acessar a pasta no Google Drive' });
    }
};

export const disconnect = async (req: AuthRequest, res: Response) => {
    const scope = await resolveManageScope(req.user!.userId);
    const connection = scope && await findConnection(scope);
    if (!connection) return res.status(404).json({ message: 'Drive não conectado' });

    try {
        await revokeToken(decryptField(connection.encryptedRefreshToken));
    } catch (error) {
        logError('Failed to revoke Google token on disconnect', error);
    }
    await prisma.storageConnection.update({ where: { id: connection.id }, data: { status: 'REVOKED', lastError: null } });
    res.json({ success: true });
};
