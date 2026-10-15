// backend/src/services/storage/storageConnectionService.ts
import type { StorageConnection } from '@prisma/client';

import prisma from '../../prisma';
import { sendStorageConnectionAlertEmail } from '../emailService';
import { getOfficeSeatAccessForUser } from '../officeSubscriptionService';
import { StorageError } from './types';

const isUsable = (connection: StorageConnection | null): connection is StorageConnection =>
    Boolean(connection && connection.status === 'ACTIVE' && connection.rootFolderId);

export const resolveConnectionForProject = async (projectId: string): Promise<StorageConnection | null> => {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { createdByUserId: true } });
    if (!project) return null;

    const seat = await getOfficeSeatAccessForUser(project.createdByUserId);
    if (seat) {
        const office = await prisma.storageConnection.findUnique({ where: { subscriptionId: seat.subscriptionId } });
        if (isUsable(office)) return office;
    }

    const own = await prisma.storageConnection.findUnique({ where: { userId: project.createdByUserId } });
    return isUsable(own) ? own : null;
};

export const recordConnectionFailure = async (connection: StorageConnection, error: StorageError): Promise<void> => {
    const isNewProblem = connection.lastError !== error.code;

    await prisma.storageConnection.update({
        where: { id: connection.id },
        data: error.code === 'AUTH_REVOKED'
            ? { status: 'REVOKED', lastError: error.code }
            : { lastError: error.code },
    });

    if (!isNewProblem) return;
    if (error.code !== 'AUTH_REVOKED' && error.code !== 'QUOTA' && error.code !== 'UNAVAILABLE' && error.code !== 'NOT_FOUND') return;

    const owner = await prisma.user.findUnique({ where: { id: connection.connectedByUserId }, select: { email: true, name: true } });
    if (owner) await sendStorageConnectionAlertEmail({ email: owner.email, name: owner.name, reason: error.code });
};

export const clearConnectionFailure = async (connection: StorageConnection): Promise<void> => {
    if (!connection.lastError) return;
    await prisma.storageConnection.update({ where: { id: connection.id }, data: { lastError: null } });
};
