import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { logError, logInfo } from '../utils/logger';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
    };
    projectId?: string;
    projectRole?: 'ADMIN' | 'USER';
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token nao fornecido' });
    }

    if (!process.env.JWT_SECRET) {
        logError('JWT secret is not configured', undefined, {
            requestId: req.requestId,
            path: req.path,
        });
        return res.status(500).json({ message: 'Erro interno do servidor (configuracao de seguranca ausente)' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            logInfo('Token verification failed', {
                requestId: req.requestId,
                path: req.path,
                reason: err.message,
            });
            return res.status(403).json({ message: 'Token invalido ou expirado' });
        }

        const authenticatedUserId =
            decoded && typeof decoded === 'object'
                ? (decoded as { userId?: string }).userId || 'unknown'
                : 'unknown';

        logInfo('User authenticated', {
            requestId: req.requestId,
            path: req.path,
            userId: authenticatedUserId,
        });

        req.user = decoded as { userId: string };
        next();
    });
};
