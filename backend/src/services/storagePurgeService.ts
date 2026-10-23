import type { Prisma } from '@prisma/client';

import prisma from '../prisma';
import { sendProjectPurgeWarningEmail } from './emailService';
import { deleteStoredFile } from './storage';
import { logError, logInfo } from '../utils/logger';

export const PURGE_AFTER_DAYS = 7;
export const WARN_AFTER_DAYS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export const purgeableFilesWhere = (now: Date): Prisma.FileWhereInput => ({
    purgedAt: null,
    storageProvider: 'R2',
    project: {
        OR: [
            {
                status: 'ARCHIVED',
                archivedAt: { not: null, lte: daysBefore(now, PURGE_AFTER_DAYS) },
                // Pelo menos 24h entre o aviso e o expurgo.
                purgeWarningSentAt: { not: null, lte: daysBefore(now, 1) },
            },
            { status: 'DELETED' },
        ],
    },
});

export const warnableProjectsWhere = (now: Date): Prisma.ProjectWhereInput => ({
    status: 'ARCHIVED',
    archivedAt: { lte: daysBefore(now, WARN_AFTER_DAYS) },
    purgeWarningSentAt: null,
});

const sendWarnings = async (now: Date): Promise<number> => {
    const projects = await prisma.project.findMany({
        where: warnableProjectsWhere(now),
        select: {
            id: true,
            name: true,
            archivedAt: true,
            members: { where: { role: 'ADMIN' }, select: { user: { select: { email: true, name: true } } } },
        },
    });

    for (const project of projects) {
        if (!project.archivedAt) continue;
        const purgeAt = new Date(Math.max(project.archivedAt.getTime() + PURGE_AFTER_DAYS * DAY_MS, now.getTime() + DAY_MS));
        let delivered = 0;
        for (const member of project.members) {
            const ok = await sendProjectPurgeWarningEmail({
                email: member.user.email,
                name: member.user.name,
                projectName: project.name,
                projectId: project.id,
                purgeAt,
            });
            if (ok) delivered += 1;
        }
        // Sem nenhum envio bem-sucedido o aviso fica pendente e é refeito no próximo ciclo.
        if (delivered > 0 || project.members.length === 0) {
            await prisma.project.update({ where: { id: project.id }, data: { purgeWarningSentAt: now } });
        }
    }

    return projects.length;
};

const purgeFiles = async (now: Date, batchSize: number): Promise<{ purged: number; failed: number }> => {
    const failedIds: string[] = [];
    const skippedIds: string[] = [];
    let purged = 0;

    while (true) {
        const excludedIds = [...failedIds, ...skippedIds];
        const where: Prisma.FileWhereInput = excludedIds.length > 0
            ? { ...purgeableFilesWhere(now), id: { notIn: excludedIds } }
            : purgeableFilesWhere(now);
        const files = await prisma.file.findMany({ where, take: batchSize });
        if (files.length === 0) break;

        for (const file of files) {
            try {
                // O projeto pode ter sido desarquivado entre a seleção e agora.
                const stillEligible = await prisma.file.count({ where: { id: file.id, ...purgeableFilesWhere(now) } });
                if (stillEligible === 0) {
                    skippedIds.push(file.id);
                    continue;
                }
                await deleteStoredFile(file);
                // Sem a DEK o arquivo é irrecuperável mesmo que o objeto sobreviva em algum backup.
                await prisma.file.update({
                    where: { id: file.id },
                    data: { purgedAt: now, encryptedDek: null, iv: null, authTag: null },
                });
                purged += 1;
            } catch (error) {
                failedIds.push(file.id);
                logError('Storage purge failed for file', error, { fileId: file.id });
            }
        }
    }

    return { purged, failed: failedIds.length };
};

export const runStoragePurgeCycle = async (options: { now?: Date; batchSize?: number } = {}) => {
    const now = options.now ?? new Date();
    const warned = await sendWarnings(now);
    const { purged, failed } = await purgeFiles(now, options.batchSize ?? DEFAULT_BATCH_SIZE);
    logInfo('Storage purge cycle summary', { warned, purged, failed });
    return { warned, purged, failed };
};
