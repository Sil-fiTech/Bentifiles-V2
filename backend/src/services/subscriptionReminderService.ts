import prisma from '../prisma';
import {
    SubscriptionReminderStatus,
    SubscriptionReminderType,
    SubscriptionStatus,
    User,
} from '@prisma/client';
import { sendEndingReminderEmail } from './emailService';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

type EligibleUser = Pick<
    User,
    | 'id'
    | 'email'
    | 'name'
    | 'subscriptionStatus'
    | 'subscriptionTrialEndsAt'
    | 'subscriptionCurrentPeriodEnd'
    | 'subscriptionCancelAtPeriodEnd'
>;

type ReminderDefinition = {
    reminderType: SubscriptionReminderType;
    reminderWindow: 1 | 2;
    targetDate: Date;
    scheduledFor: Date;
};

const getNow = () => new Date();

const getWorkerId = () => {
    const configured = process.env.SUBSCRIPTION_REMINDER_WORKER_ID?.trim();
    if (configured) {
        return configured;
    }

    return `worker-${process.pid}`;
};

const isTrialEligible = (user: EligibleUser, targetDate: Date) =>
    user.subscriptionStatus === SubscriptionStatus.TRIALING &&
    user.subscriptionTrialEndsAt?.getTime() === targetDate.getTime();

const isSubscriptionEligible = (user: EligibleUser, targetDate: Date) =>
    user.subscriptionCancelAtPeriodEnd &&
    user.subscriptionCurrentPeriodEnd?.getTime() === targetDate.getTime() &&
    user.subscriptionStatus !== SubscriptionStatus.CANCELED &&
    user.subscriptionStatus !== SubscriptionStatus.NONE;

const buildReminderDefinitions = (user: EligibleUser): ReminderDefinition[] => {
    const reminders: ReminderDefinition[] = [];

    if (user.subscriptionStatus === SubscriptionStatus.TRIALING && user.subscriptionTrialEndsAt) {
        for (const windowDays of [2, 1] as const) {
            reminders.push({
                reminderType: SubscriptionReminderType.TRIAL_ENDING,
                reminderWindow: windowDays,
                targetDate: user.subscriptionTrialEndsAt,
                scheduledFor: new Date(user.subscriptionTrialEndsAt.getTime() - windowDays * ONE_DAY_MS),
            });
        }
    }

    if (
        user.subscriptionCancelAtPeriodEnd &&
        user.subscriptionCurrentPeriodEnd &&
        user.subscriptionStatus !== SubscriptionStatus.CANCELED &&
        user.subscriptionStatus !== SubscriptionStatus.NONE
    ) {
        for (const windowDays of [2, 1] as const) {
            reminders.push({
                reminderType: SubscriptionReminderType.SUBSCRIPTION_ENDING,
                reminderWindow: windowDays,
                targetDate: user.subscriptionCurrentPeriodEnd,
                scheduledFor: new Date(user.subscriptionCurrentPeriodEnd.getTime() - windowDays * ONE_DAY_MS),
            });
        }
    }

    return reminders;
};

const isDispatchStillEligible = (dispatch: {
    reminderType: SubscriptionReminderType;
    targetDate: Date;
    user: EligibleUser;
}) => {
    if (dispatch.reminderType === SubscriptionReminderType.TRIAL_ENDING) {
        return isTrialEligible(dispatch.user, dispatch.targetDate);
    }

    return isSubscriptionEligible(dispatch.user, dispatch.targetDate);
};

export const syncReminderDispatchesForUser = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            subscriptionStatus: true,
            subscriptionTrialEndsAt: true,
            subscriptionCurrentPeriodEnd: true,
            subscriptionCancelAtPeriodEnd: true,
        },
    });

    if (!user) {
        return;
    }

    const definitions = buildReminderDefinitions(user);
    const activeKeys = new Set(definitions.map((definition) =>
        `${definition.reminderType}:${definition.reminderWindow}:${definition.targetDate.toISOString()}`
    ));

    for (const definition of definitions) {
        const existingDispatch = await prisma.subscriptionReminderDispatch.findUnique({
            where: {
                userId_reminderType_reminderWindow_targetDate: {
                    userId,
                    reminderType: definition.reminderType,
                    reminderWindow: definition.reminderWindow,
                    targetDate: definition.targetDate,
                },
            },
            select: {
                id: true,
                status: true,
            },
        });

        if (!existingDispatch) {
            await prisma.subscriptionReminderDispatch.create({
                data: {
                    userId,
                    reminderType: definition.reminderType,
                    reminderWindow: definition.reminderWindow,
                    targetDate: definition.targetDate,
                    scheduledFor: definition.scheduledFor,
                    status: SubscriptionReminderStatus.PENDING,
                },
            });
            continue;
        }

        if (existingDispatch.status === SubscriptionReminderStatus.SENT) {
            continue;
        }

        await prisma.subscriptionReminderDispatch.update({
            where: { id: existingDispatch.id },
            data: {
                scheduledFor: definition.scheduledFor,
                status: SubscriptionReminderStatus.PENDING,
                leaseExpiresAt: null,
                leasedAt: null,
                leasedBy: null,
                lastError: null,
            },
        });
    }

    const staleDispatches = await prisma.subscriptionReminderDispatch.findMany({
        where: {
            userId,
            status: {
                in: [
                    SubscriptionReminderStatus.PENDING,
                    SubscriptionReminderStatus.PROCESSING,
                    SubscriptionReminderStatus.FAILED,
                ],
            },
        },
        select: {
            id: true,
            reminderType: true,
            reminderWindow: true,
            targetDate: true,
        },
    });

    for (const dispatch of staleDispatches) {
        const dispatchKey = `${dispatch.reminderType}:${dispatch.reminderWindow}:${dispatch.targetDate.toISOString()}`;

        if (activeKeys.has(dispatchKey)) {
            continue;
        }

        await prisma.subscriptionReminderDispatch.update({
            where: { id: dispatch.id },
            data: {
                status: SubscriptionReminderStatus.CANCELED,
                leaseExpiresAt: null,
                leasedAt: null,
                leasedBy: null,
                lastError: 'Dispatch cancelado por mudanca no estado da assinatura.',
            },
        });
    }
};

export const reconcileSubscriptionReminderDispatches = async () => {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                {
                    subscriptionStatus: SubscriptionStatus.TRIALING,
                    subscriptionTrialEndsAt: {
                        not: null,
                    },
                },
                {
                    subscriptionCancelAtPeriodEnd: true,
                    subscriptionCurrentPeriodEnd: {
                        not: null,
                    },
                    subscriptionStatus: {
                        notIn: [SubscriptionStatus.CANCELED, SubscriptionStatus.NONE],
                    },
                },
            ],
        },
        select: {
            id: true,
        },
    });

    for (const user of users) {
        await syncReminderDispatchesForUser(user.id);
    }
};

const claimDispatch = async (params: {
    dispatchId: string;
    workerId: string;
    leaseMs: number;
}) => {
    const now = getNow();
    const leaseExpiry = new Date(now.getTime() + params.leaseMs);

    const result = await prisma.subscriptionReminderDispatch.updateMany({
        where: {
            id: params.dispatchId,
            status: {
                in: [SubscriptionReminderStatus.PENDING, SubscriptionReminderStatus.FAILED],
            },
            OR: [
                { leaseExpiresAt: null },
                { leaseExpiresAt: { lt: now } },
            ],
        },
        data: {
            status: SubscriptionReminderStatus.PROCESSING,
            leasedAt: now,
            leaseExpiresAt: leaseExpiry,
            leasedBy: params.workerId,
        },
    });

    return result.count === 1;
};

export const dispatchDueSubscriptionReminders = async (params?: {
    batchSize?: number;
    leaseMs?: number;
    maxAttempts?: number;
    workerId?: string;
}) => {
    const batchSize = params?.batchSize ?? DEFAULT_BATCH_SIZE;
    const leaseMs = params?.leaseMs ?? DEFAULT_LEASE_MS;
    const maxAttempts = params?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const workerId = params?.workerId ?? getWorkerId();
    const now = getNow();

    const dueDispatches = await prisma.subscriptionReminderDispatch.findMany({
        where: {
            status: {
                in: [SubscriptionReminderStatus.PENDING, SubscriptionReminderStatus.FAILED],
            },
            scheduledFor: {
                lte: now,
            },
            attempts: {
                lt: maxAttempts,
            },
            OR: [
                { leaseExpiresAt: null },
                { leaseExpiresAt: { lt: now } },
            ],
        },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    subscriptionStatus: true,
                    subscriptionTrialEndsAt: true,
                    subscriptionCurrentPeriodEnd: true,
                    subscriptionCancelAtPeriodEnd: true,
                },
            },
        },
        orderBy: [
            { scheduledFor: 'asc' },
            { createdAt: 'asc' },
        ],
        take: batchSize,
    });

    let sentCount = 0;
    let canceledCount = 0;
    let failedCount = 0;

    for (const dispatch of dueDispatches) {
        const claimed = await claimDispatch({
            dispatchId: dispatch.id,
            workerId,
            leaseMs,
        });

        if (!claimed) {
            continue;
        }

        if (!isDispatchStillEligible(dispatch)) {
            await prisma.subscriptionReminderDispatch.update({
                where: { id: dispatch.id },
                data: {
                    status: SubscriptionReminderStatus.CANCELED,
                    leaseExpiresAt: null,
                    leasedAt: null,
                    leasedBy: null,
                    lastError: 'Dispatch cancelado porque a assinatura nao esta mais elegivel.',
                },
            });
            canceledCount += 1;
            continue;
        }

        try {
            await sendEndingReminderEmail({
                email: dispatch.user.email,
                name: dispatch.user.name,
                expiresAt: dispatch.targetDate,
                daysRemaining: dispatch.reminderWindow as 1 | 2,
                type: dispatch.reminderType === SubscriptionReminderType.TRIAL_ENDING ? 'trial' : 'subscription',
            });

            await prisma.subscriptionReminderDispatch.update({
                where: { id: dispatch.id },
                data: {
                    status: SubscriptionReminderStatus.SENT,
                    sentAt: getNow(),
                    leaseExpiresAt: null,
                    leasedAt: null,
                    leasedBy: null,
                    lastError: null,
                },
            });
            sentCount += 1;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Falha desconhecida ao enviar lembrete.';

            await prisma.subscriptionReminderDispatch.update({
                where: { id: dispatch.id },
                data: {
                    status: SubscriptionReminderStatus.FAILED,
                    attempts: {
                        increment: 1,
                    },
                    leaseExpiresAt: null,
                    leasedAt: null,
                    leasedBy: null,
                    lastError: errorMessage.slice(0, 1000),
                },
            });
            failedCount += 1;
            console.error(`[Reminder Worker] Failed to send dispatch ${dispatch.id}`, error);
        }
    }

    return {
        scanned: dueDispatches.length,
        sent: sentCount,
        canceled: canceledCount,
        failed: failedCount,
    };
};

export const runSubscriptionReminderWorkerCycle = async (params?: {
    batchSize?: number;
    leaseMs?: number;
    maxAttempts?: number;
    workerId?: string;
}) => {
    await reconcileSubscriptionReminderDispatches();
    return dispatchDueSubscriptionReminders(params);
};
