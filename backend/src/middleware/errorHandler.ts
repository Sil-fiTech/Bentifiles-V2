import { ErrorRequestHandler } from 'express';

import { notifyErrorEvent } from '../services/discordAlertService';
import { logError } from '../utils/logger';

export const handleUnhandledErrors: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }

    logError('Unhandled HTTP error', error, {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        userId: (req as { user?: { userId?: string } }).user?.userId,
    });

    notifyErrorEvent('Erro HTTP nao tratado', error, [
        ['Request ID', req.requestId],
        ['Metodo', req.method],
        ['Path', req.originalUrl],
        ['User ID', (req as { user?: { userId?: string } }).user?.userId],
    ]);

    res.status(500).json({ message: 'Erro interno do servidor' });
};
