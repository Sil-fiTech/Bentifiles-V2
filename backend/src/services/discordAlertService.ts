import {
    createNotifier,
    type Environment,
    type Logger as DiscordLogger,
    type Notifier,
    type NotifyInput,
    type NotifyResult,
} from 'discord-ops-alert';

import { logError, logInfo, logWarn } from '../utils/logger';

export enum DiscordTopic {
    SIGNUP = 'signup',
    BILLING = 'billing',
    ERRORS = 'errors',
    SECURITY = 'security',
}

const DEFAULT_USERNAME = 'BentiFiles Ops';
const MAX_DISCORD_MESSAGE_LENGTH = 2000;

const normalizeEnvironment = (value?: string): Environment => {
    const normalized = (value || '').toLowerCase();

    if (normalized === 'production' || normalized === 'prod') {
        return 'production';
    }

    if (normalized === 'staging') {
        return 'staging';
    }

    if (normalized === 'homologation' || normalized === 'homolog' || normalized === 'hml') {
        return 'homologation';
    }

    if (normalized === 'test') {
        return 'test';
    }

    return 'development';
};

const parseEnabledEnvironments = (value?: string): Environment[] => {
    const parsed = value
        ?.split(',')
        .map((item) => normalizeEnvironment(item.trim()))
        .filter((item, index, items) => items.indexOf(item) === index);

    return parsed && parsed.length > 0 ? parsed : ['production'];
};

const toInlineValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
        return 'n/a';
    }

    return String(value).replace(/`/g, "'");
};

const formatDiscordMessage = (title: string, details: Array<[string, unknown]>) => {
    const lines = [`**${title.replace(/\*\*/g, '').trim()}**`];

    for (const [label, value] of details) {
        if (value === undefined) {
            continue;
        }

        lines.push(`${label}: \`${toInlineValue(value)}\``);
    }

    const message = lines.join('\n');
    return message.length <= MAX_DISCORD_MESSAGE_LENGTH
        ? message
        : `${message.slice(0, MAX_DISCORD_MESSAGE_LENGTH - 3)}...`;
};

const loggerAdapter: DiscordLogger = {
    debug: (message, meta) => logInfo('Discord notifier debug', { message, ...meta }),
    info: (message, meta) => logInfo('Discord notifier info', { message, ...meta }),
    warn: (message, meta) => logWarn('Discord notifier warning', { message, ...meta }),
    error: (message, meta) => logError('Discord notifier error', undefined, { message, ...meta }),
};

type NotifierContext = {
    configuredTopics: Set<DiscordTopic>;
    notifier: Notifier<DiscordTopic> | null;
};

let cachedContext: NotifierContext | null = null;

const createNotifierContext = (): NotifierContext => {
    const configuredWebhooks: Record<DiscordTopic, string | undefined> = {
        [DiscordTopic.SIGNUP]: process.env.DISCORD_WEBHOOK_SIGNUP,
        [DiscordTopic.BILLING]: process.env.DISCORD_WEBHOOK_BILLING,
        [DiscordTopic.ERRORS]: process.env.DISCORD_WEBHOOK_ERRORS,
        [DiscordTopic.SECURITY]: process.env.DISCORD_WEBHOOK_SECURITY,
    };

    const configuredTopics = new Set(
        Object.entries(configuredWebhooks)
            .filter(([, value]) => Boolean(value))
            .map(([topic]) => topic as DiscordTopic)
    );

    const alertsExplicitlyDisabled = ['0', 'false', 'off']
        .includes((process.env.DISCORD_ALERTS_ENABLED || '').trim().toLowerCase());

    const shouldCreateNotifier = !alertsExplicitlyDisabled && configuredTopics.size > 0;

    if (!shouldCreateNotifier) {
        logInfo('Discord alerts are disabled or not configured', {
            alertsExplicitlyDisabled,
            configuredTopics: Array.from(configuredTopics),
        });

        return {
            configuredTopics,
            notifier: null,
        };
    }

    return {
        configuredTopics,
        notifier: createNotifier<DiscordTopic>({
            mode: 'webhook',
            webhooks: configuredWebhooks,
            environment: normalizeEnvironment(process.env.NODE_ENV),
            enabledIn: parseEnabledEnvironments(process.env.DISCORD_ALERTS_ENABLED_IN),
            timeoutMs: Number(process.env.DISCORD_ALERTS_TIMEOUT_MS) || 5000,
            defaultUsername: process.env.DISCORD_ALERTS_DEFAULT_USERNAME || DEFAULT_USERNAME,
            logger: loggerAdapter,
            awaitByDefault: false,
            onRetry: (event) => {
                logWarn('Discord notification retry scheduled', {
                    attempt: event.attempt,
                    reason: event.reason,
                    status: event.status,
                    nextDelayMs: event.nextDelayMs,
                });
            },
            onError: (error, input) => {
                logError('Discord notification failed', error, {
                    topic: input.topic,
                });
            },
        }),
    };
};

const getNotifierContext = () => {
    if (!cachedContext) {
        cachedContext = createNotifierContext();
    }

    return cachedContext;
};

const skipBecauseUnavailable = (topic: DiscordTopic) => {
    const { configuredTopics, notifier } = getNotifierContext();

    if (!notifier) {
        return true;
    }

    if (!configuredTopics.has(topic)) {
        logInfo('Discord topic skipped because webhook is not configured', { topic });
        return true;
    }

    return false;
};

export const notifyDiscord = (input: NotifyInput<DiscordTopic>) => {
    if (skipBecauseUnavailable(input.topic)) {
        return;
    }

    getNotifierContext().notifier!(input);
};

export const notifyDiscordAsync = async (input: NotifyInput<DiscordTopic>): Promise<NotifyResult> => {
    if (skipBecauseUnavailable(input.topic)) {
        return {
            ok: false,
            attempts: 0,
            error: 'discord alerts are disabled or topic is not configured',
        };
    }

    return getNotifierContext().notifier!.async(input);
};

export const notifySignupCreated = (params: {
    userId: string;
    email: string;
    name: string;
    provider: 'credentials' | 'google';
}) => {
    notifyDiscord({
        topic: DiscordTopic.SIGNUP,
        message: formatDiscordMessage('Novo cadastro', [
            ['Provider', params.provider],
            ['User ID', params.userId],
            ['Nome', params.name],
            ['Email', params.email],
            ['Ambiente', normalizeEnvironment(process.env.NODE_ENV)],
        ]),
    });
};

export const notifyBillingEvent = (title: string, details: Array<[string, unknown]>) => {
    notifyDiscord({
        topic: DiscordTopic.BILLING,
        message: formatDiscordMessage(title, [
            ...details,
            ['Ambiente', normalizeEnvironment(process.env.NODE_ENV)],
        ]),
    });
};

export const notifyErrorEvent = (title: string, error: unknown, details: Array<[string, unknown]> = []) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));

    notifyDiscord({
        topic: DiscordTopic.ERRORS,
        message: formatDiscordMessage(title, [
            ...details,
            ['Error', normalizedError.message],
            ['Ambiente', normalizeEnvironment(process.env.NODE_ENV)],
        ]),
    });
};

export const notifyErrorEventAsync = async (title: string, error: unknown, details: Array<[string, unknown]> = []) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));

    return notifyDiscordAsync({
        topic: DiscordTopic.ERRORS,
        message: formatDiscordMessage(title, [
            ...details,
            ['Error', normalizedError.message],
            ['Ambiente', normalizeEnvironment(process.env.NODE_ENV)],
        ]),
    });
};
