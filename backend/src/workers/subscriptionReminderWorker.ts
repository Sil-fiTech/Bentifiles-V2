import dotenv from 'dotenv';
dotenv.config();

import prisma from '../prisma';
import { runSubscriptionReminderWorkerCycle } from '../services/subscriptionReminderService';

const DEFAULT_POLL_MS = 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
    const mode = (process.env.SUBSCRIPTION_REMINDER_WORKER_MODE || 'once').toLowerCase();
    const pollMs = Number(process.env.SUBSCRIPTION_REMINDER_WORKER_POLL_MS) || DEFAULT_POLL_MS;
    const batchSize = Number(process.env.SUBSCRIPTION_REMINDER_BATCH_SIZE) || undefined;
    const leaseMs = Number(process.env.SUBSCRIPTION_REMINDER_LEASE_MS) || undefined;
    const maxAttempts = Number(process.env.SUBSCRIPTION_REMINDER_MAX_ATTEMPTS) || undefined;
    const workerId = process.env.SUBSCRIPTION_REMINDER_WORKER_ID || undefined;

    await prisma.$connect();
    console.log(`[Reminder Worker] Connected to database in mode=${mode}`);

    try {
        do {
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

            const summary = await runSubscriptionReminderWorkerCycle(cycleOptions);

            console.log('[Reminder Worker] Cycle summary:', summary);

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
    console.error('[Reminder Worker] Fatal error', error);
    await prisma.$disconnect();
    process.exit(1);
});
