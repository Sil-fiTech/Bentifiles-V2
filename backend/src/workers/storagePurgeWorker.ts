import 'dotenv/config';
import './storagePurgeEnv';

import prisma from '../prisma';
import { notifyErrorEventAsync } from '../services/discordAlertService';
import { assertStorageKeysConfigured } from '../services/storage/envelopeCrypto';
import { runStoragePurgeCycle } from '../services/storagePurgeService';
import { logError, logInfo, logWarn } from '../utils/logger';

const DEFAULT_POLL_MS = 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

let isStopping = false;
let wake: (() => void) | null = null;

const requestStop = (signal: string) => {
    if (isStopping) process.exit(1);
    isStopping = true;
    logInfo('Storage purge worker received shutdown signal', { signal });
    wake?.();
};
process.on('SIGTERM', () => requestStop('SIGTERM'));
process.on('SIGINT', () => requestStop('SIGINT'));

const sleep = (ms: number) => new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => { clearTimeout(timer); resolve(); };
});

// O pooler derruba conexões ociosas entre ciclos de 1h: reconecta se precisar.
const ensureHealthyConnection = async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
        logWarn('Storage purge worker reconnecting', { error: error instanceof Error ? error.message : String(error) });
        await prisma.$disconnect().catch(() => undefined);
        await prisma.$connect();
    }
};

const run = async () => {
    assertStorageKeysConfigured();
    const mode = (process.env.STORAGE_PURGE_WORKER_MODE || 'once').toLowerCase();
    const pollMs = Number(process.env.STORAGE_PURGE_WORKER_POLL_MS) || DEFAULT_POLL_MS;
    let consecutiveFailures = 0;

    await prisma.$connect();

    while (!isStopping) {
        try {
            await ensureHealthyConnection();
            await runStoragePurgeCycle();
            consecutiveFailures = 0;
        } catch (error) {
            consecutiveFailures += 1;
            logError('Storage purge cycle failed', error, { consecutiveFailures });
            if (mode !== 'loop' || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) throw error;
        }
        if (mode !== 'loop' || isStopping) break;
        await sleep(pollMs);
    }
};

run()
    .then(async () => {
        await prisma.$disconnect();
        process.exit(0);
    })
    .catch(async (error) => {
        logError('Storage purge worker fatal error', error);
        await notifyErrorEventAsync('Storage purge worker fatal error', error);
        await prisma.$disconnect();
        process.exit(1);
    });
