import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logInfo } from '../utils/logger';

export const attachRequestContext = (req: Request, res: Response, next: NextFunction) => {
    req.requestId = req.header('x-request-id') || crypto.randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
};

export const logHttpRequests = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

        logInfo('HTTP request completed', {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
    });

    next();
};
