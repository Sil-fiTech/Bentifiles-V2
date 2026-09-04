import dotenv from 'dotenv';

import prisma from '../prisma';
import { notifyErrorEventAsync } from '../services/discordAlertService';
import { runSubscriptionReminderWorkerCycle } from '../services/subscriptionReminderService';
import { logError, logInfo, logWarn } from '../utils/logger';

dotenv.config();

const DEFAULT_POLL_MS = 60 * 1000;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
const DEFAULT_MAX_BACKOFF_MS = 15 * 60 * 1000;
const DEFAULT_CONNECT_MAX_ATTEMPTS = 10;
const CONNECT_BASE_BACKOFF_MS = 1000;

let isStopping = false;
let stopResolve: (() => void) | null = null;
const stopping = new Promise<void>((resolve) => {
    stopResolve = resolve;
});

const FORCE_EXIT_MS = 8 * 1000;

const requestStop = (signal: string) => {
    if (isStopping) {
        // Segundo sinal: o operador quer sair agora.
        logWarn('Subscription reminder worker forced shutdown', { signal });
        process.exit(1);
        return;
    }
    isStopping = true;
    logInfo('Subscription reminder worker received shutdown signal', { signal });
    stopResolve?.();

    // Rede de seguranca: se um ciclo em andamento travar (ex.: SMTP pendurado),
    // nao seguramos o SIGTERM do Docker ate o SIGKILL. `.unref()` deixa o processo
    // sair normalmente antes disso se o shutdown limpo terminar a tempo.
    setTimeout(() => {
        logWarn('Subscription reminder worker shutdown timed out, forcing exit', { signal });
        process.exit(1);
    }, FORCE_EXIT_MS).unref();
};

process.on('SIGTERM', () => requestStop('SIGTERM'));
process.on('SIGINT', () => requestStop('SIGINT'));

// Resolve apos `ms`, ou imediatamente se um sinal de shutdown chegar antes.
const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        void stopping.then(() => {
            clearTimeout(timer);
            resolve();
        });
    });

// Backoff exponencial: baseMs, 2*baseMs, 4*baseMs, ... limitado a maxMs.
const backoffFor = (failureCount: number, baseMs: number, maxMs: number) =>
    Math.min(baseMs * 2 ** Math.max(0, failureCount - 1), maxMs);

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

/**
 * Conecta no boot com retry/backoff. Em `loop` insiste ate conseguir (ou ate um
 * sinal de shutdown); em `once` desiste depois de N tentativas e propaga o erro
 * para o scheduler ver o exit != 0. Sem isto, um banco fora do ar no start cai
 * direto em crash loop do container.
 */
const connectWithRetry = async (params: {
    mode: string;
    workerId: string | undefined;
    maxAttempts: number;
    maxBackoffMs: number;
}) => {
    const isLoop = params.mode === 'loop';
    let attempt = 0;

    while (!isStopping) {
        attempt += 1;

        try {
            await prisma.$connect();
            await prisma.$queryRaw`SELECT 1`;
            logInfo('Subscription reminder worker connected to database', {
                mode: params.mode,
                workerId: params.workerId,
                attempt,
            });
            return;
        } catch (error) {
            logError('Subscription reminder worker failed to connect to database', error, {
                attempt,
                maxAttempts: isLoop ? 'infinite' : params.maxAttempts,
            });

            if (!isLoop && attempt >= params.maxAttempts) {
                throw error;
            }

            await sleep(backoffFor(attempt, CONNECT_BASE_BACKOFF_MS, params.maxBackoffMs));
        }
    }
};

const run = async () => {
    const mode = (process.env.SUBSCRIPTION_REMINDER_WORKER_MODE || 'once').toLowerCase();
    const pollMs = Number(process.env.SUBSCRIPTION_REMINDER_WORKER_POLL_MS) || DEFAULT_POLL_MS;
    const maxConsecutiveFailures =
        Number(process.env.SUBSCRIPTION_REMINDER_MAX_CONSECUTIVE_FAILURES) || DEFAULT_MAX_CONSECUTIVE_FAILURES;
    const maxBackoffMs =
        Number(process.env.SUBSCRIPTION_REMINDER_WORKER_MAX_BACKOFF_MS) || DEFAULT_MAX_BACKOFF_MS;
    const connectMaxAttempts =
        Number(process.env.SUBSCRIPTION_REMINDER_WORKER_CONNECT_MAX_ATTEMPTS) || DEFAULT_CONNECT_MAX_ATTEMPTS;
    const batchSize = Number(process.env.SUBSCRIPTION_REMINDER_BATCH_SIZE) || undefined;
    const leaseMs = Number(process.env.SUBSCRIPTION_REMINDER_LEASE_MS) || undefined;
    const maxAttempts = Number(process.env.SUBSCRIPTION_REMINDER_MAX_ATTEMPTS) || undefined;
    const workerId = process.env.SUBSCRIPTION_REMINDER_WORKER_ID || undefined;

    const isLoop = mode === 'loop';

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

    await connectWithRetry({ mode, workerId, maxAttempts: connectMaxAttempts, maxBackoffMs });

    let consecutiveFailures = 0;

    try {
        while (!isStopping) {
            try {
                await ensureHealthyConnection();

                const summary = await runSubscriptionReminderWorkerCycle(cycleOptions);

                if (consecutiveFailures > 0) {
                    logInfo('Subscription reminder worker recovered', {
                        mode,
                        workerId,
                        afterConsecutiveFailures: consecutiveFailures,
                    });
                }
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
                if (!isLoop || consecutiveFailures >= maxConsecutiveFailures) {
                    throw cycleError;
                }

                // Forca reconexao limpa no proximo ciclo.
                try {
                    await prisma.$disconnect();
                } catch {
                    // ignore
                }

                // Backoff crescente antes de tentar de novo, para nao martelar um
                // pooler que ja esta sofrendo.
                await sleep(backoffFor(consecutiveFailures, pollMs, maxBackoffMs));
                continue;
            }

            if (!isLoop) {
                break;
            }

            await sleep(pollMs);
        }
    } finally {
        await prisma.$disconnect();
    }
};

run()
    .then(() => {
        process.exit(0);
    })
    .catch(async (error) => {
        logError('Subscription reminder worker fatal error', error);
        await notifyErrorEventAsync('Subscription reminder worker fatal error', error);
        await prisma.$disconnect();
        process.exit(1);
    });
