import type { FileAccessAction } from '@prisma/client';

import prisma from '../prisma';
import { logError } from '../utils/logger';

export interface FileAccessEntry {
    fileId: string;
    userId: string;
    action: FileAccessAction;
    ip: string | null;
}

// Falha de auditoria é alertada, mas não bloqueia o acesso do usuário ao documento.
export const logFileAccess = async (entries: FileAccessEntry[]): Promise<void> => {
    if (entries.length === 0) return;
    try {
        await prisma.fileAccessLog.createMany({ data: entries });
    } catch (error) {
        logError('Failed to write file access log', error, { count: entries.length });
    }
};
