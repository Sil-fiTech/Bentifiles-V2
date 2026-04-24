import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

import { handleUnhandledErrors } from './middleware/errorHandler';
import { attachRequestContext, logHttpRequests } from './middleware/observability';
import prisma from './prisma';
import authRoutes from './routes/authRoutes';
import billingRoutes from './routes/billingRoutes';
import documentRoutes from './routes/documentRoutes';
import fileRoutes from './routes/fileRoutes';
import projectRoutes from './routes/projectRoutes';
import stripeWebhookRoutes from './routes/stripeWebhookRoutes';
import templateRoutes from './routes/templateRoutes';
import usersRoutes from './routes/usersRoutes';
import { notifyErrorEventAsync } from './services/discordAlertService';
import { logError, logInfo } from './utils/logger';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const startedAt = Date.now();

app.use(helmet());

app.use(cors({
    origin: ['https://bentifiles.com', 'https://www.bentifiles.com', 'http://localhost:3000', 'http://localhost:3001'],
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    credentials: true,
}));

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(attachRequestContext);
app.use(logHttpRequests);

// Register Stripe webhooks before express.json() to preserve raw body for signature verification.
app.use('/webhooks', stripeWebhookRoutes);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/billing', billingRoutes);

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'backend',
        version: process.env.npm_package_version || '1.0.0',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        timestamp: new Date().toISOString(),
    });
});

app.use(handleUnhandledErrors);

app.listen(port, '0.0.0.0', () => {
    logInfo('Backend server started', { port });
});

prisma.$connect().then(() => {
    logInfo('Database connection established');
}).catch((error: unknown) => {
    logError('Failed to connect to database', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logError('Unhandled promise rejection', reason);
    void notifyErrorEventAsync('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
    logError('Uncaught exception', error);
    void notifyErrorEventAsync('Uncaught exception', error).finally(() => {
        process.exit(1);
    });
});

// Keep-alive to prevent silent exit in some environments.
setInterval(() => { }, 1000 * 60 * 60);
