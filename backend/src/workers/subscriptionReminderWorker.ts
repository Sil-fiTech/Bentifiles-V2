import dotenv from 'dotenv';

import prisma from '../prisma';
import { notifyErrorEventAsync } from '../services/discordAlertService';
import { runSubscriptionReminderWorkerCycle } from '../services/subscriptionReminderService';
import { logError, logInfo, logWarn } from '../utils/logger';

dotenv.config();

const DEFAULT_POLL_MS = 60 * 1000;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Garante que a conexao do pool esteja viva antes de rodar um ciclo.
 *
 * O worker roda em modo `loop` com gaps ociosos (default 60s) entre ciclos. O
 * pooler do Supabase (porta 6543, modo transaction) derruba conexoes ociosas,
 * entao a unica conexao do pool costuma estar morta quando o proximo ciclo
 * comeca. Um `SELECT 1` forca a deteccao e, se falhar, reconectamos.
 */
const ensureHealthyConnection = async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return;
    } catch (error) {
        logWarn('Subscription reminder worker connection unhealthy, reconnecting', {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    try {
        await prisma.$disconnect();
    } catch {
        // ignore: ja pode estar desconectado
    }

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
};

const run = async () => {
    const mode = (process.env.SUBSCRIPTION_REMINDER_WORKER_MODE || 'once').toLowerCase();
    const pollMs = Number(process.env.SUBSCRIPTION_REMINDER_WORKER_POLL_MS) || DEFAULT_POLL_MS;
    const maxConsecutiveFailures =
        Number(process.env.SUBSCRIPTION_REMINDER_MAX_CONSECUTIVE_FAILURES) || DEFAULT_MAX_CONSECUTIVE_FAILURES;
    const batchSize = Number(process.env.SUBSCRIPTION_REMINDER_BATCH_SIZE) || undefined;
    const leaseMs = Number(process.env.SUBSCRIPTION_REMINDER_LEASE_MS) || undefined;
    const maxAttempts = Number(process.env.SUBSCRIPTION_REMINDER_MAX_ATTEMPTS) || undefined;
    const workerId = process.env.SUBSCRIPTION_REMINDER_WORKER_ID || undefined;

    const cycleOptions: {
        batchSize?: number;
        leaseMs?: number;
        maxAttempts?: number;
        workerId?: string;
    } = {};

    if (batchSize !== undefined) {
        cycleOptions.batchSize = batchSize;
    }
    if (leaseMs !== undefined) {
        cycleOptions.leaseMs = leaseMs;
    }
    if (maxAttempts !== undefined) {
        cycleOptions.maxAttempts = maxAttempts;
    }
    if (workerId !== undefined) {
        cycleOptions.workerId = workerId;
    }

    await prisma.$connect();
    logInfo('Subscription reminder worker connected to database', { mode, workerId });

    let consecutiveFailures = 0;

    try {
        do {
            try {
                await ensureHealthyConnection();

                const summary = await runSubscriptionReminderWorkerCycle(cycleOptions);

                consecutiveFailures = 0;

                logInfo('Subscription reminder worker cycle finished', {
                    mode,
                    workerId,
                    summary,
                });
            } catch (cycleError) {
                consecutiveFailures += 1;

                logError('Subscription reminder worker cycle failed', cycleError, {
                    mode,
                    workerId,
                    consecutiveFailures,
                    maxConsecutiveFailures,
                });

                // Em modo `once` nao ha proximo poll para recuperar; propaga.
                // Em modo `loop`, so desiste depois de N falhas consecutivas —
                // falhas transitorias de conexao com o pooler nao devem matar o
                // processo (nem disparar alerta no Discord) a cada ocorrencia.
                if (mode !== 'loop' || consecutiveFailures >= maxConsecutiveFailures) {
                    throw cycleError;
                }

                // Forca reconexao limpa no proximo ciclo.
                try {
                    await prisma.$disconnect();
                } catch {
                    // ignore
                }
            }

            if (mode !== 'loop') {
                break;
            }

            await sleep(pollMs);
        } while (true);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(async (error) => {
    logError('Subscription reminder worker fatal error', error);
    await notifyErrorEventAsync('Subscription reminder worker fatal error', error);
    await prisma.$disconnect();
    process.exit(1);
});
