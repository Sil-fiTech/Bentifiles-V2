type LogLevel = 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(secret|password|token|authorization|cookie|key|database_url)/i;

const sanitizeValue = (value: unknown): unknown => {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
            acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeValue(nestedValue);
            return acc;
        }, {});
    }

    return value;
};

const writeLog = (level: LogLevel, message: string, meta: LogMeta = {}) => {
    const sanitizedMeta = sanitizeValue(meta);
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        service: 'backend',
        environment: process.env.NODE_ENV || 'development',
        message,
        ...(sanitizedMeta && typeof sanitizedMeta === 'object' ? sanitizedMeta : {}),
    };

    const line = JSON.stringify(entry);

    if (level === 'error') {
        console.error(line);
        return;
    }

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.log(line);
};

export const logInfo = (message: string, meta?: LogMeta) => writeLog('info', message, meta);

export const logWarn = (message: string, meta?: LogMeta) => writeLog('warn', message, meta);

export const logError = (message: string, error?: unknown, meta?: LogMeta) =>
    writeLog('error', message, {
        ...meta,
        ...(error ? { error } : {}),
    });
