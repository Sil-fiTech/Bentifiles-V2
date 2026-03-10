import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma';

const getPermissions = (role: string) => {
    if (role === 'ADMIN') {
        return ['PROJECT_EDIT', 'INVITE_CREATE', 'MEMBER_MANAGE', 'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
    }
    return ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
};

export const createInvite = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const projectId = req.params.id as string;

        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        // Set expiration for 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invite = await prisma.projectInvite.create({
            data: {
                projectId,
                role: 'USER',
                expiresAt,
            }
        });

        res.status(201).json({
            invite: {
                id: invite.id,
                projectId: invite.projectId,
                token: invite.token,
                expiresAt: invite.expiresAt,
                permissions: getPermissions(invite.role)
            }
        });
    } catch (error) {
        console.error('Error creating invite:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getMembers = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const projectId = req.params.id as string;

        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const members = await prisma.projectMembership.findMany({
            where: { projectId },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        const sanitizedMembers = members.map(m => ({
            userId: m.userId,
            user: m.user,
            permissions: getPermissions(m.role)
        }));

        res.status(200).json({ members: sanitizedMembers });
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
    try {
        const currentUserId = req.user?.userId;
        const projectId = req.params.id as string;
        const targetUserId = req.params.userId as string;
        const { role } = req.body; // Expecting { role: 'ADMIN' | 'USER' }

        if (!currentUserId) return res.status(401).json({ message: 'Não autorizado' });

        // Cannot demote the last ADMIN
        if (role === 'USER') {
            const adminCount = await prisma.projectMembership.count({
                where: { projectId, role: 'ADMIN' }
            });

            const targetIsAdmin = await prisma.projectMembership.findUnique({
                where: { projectId_userId: { projectId, userId: targetUserId } }
            });

            if (adminCount <= 1 && targetIsAdmin?.role === 'ADMIN') {
                return res.status(400).json({ message: 'Não é possível rebaixar o último ADMIN' });
            }
        }

        const updatedMember = await prisma.projectMembership.update({
            where: { projectId_userId: { projectId, userId: targetUserId } },
            data: { role },
        });

        res.status(200).json({
            member: {
                userId: updatedMember.userId,
                projectId: updatedMember.projectId,
                permissions: getPermissions(updatedMember.role)
            }
        });
    } catch (error) {
        console.error('Error updating member role:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
    try {
        const currentUserId = req.user?.userId;
        const projectId = req.params.id as string;
        const targetUserId = req.params.userId as string;

        if (!currentUserId) return res.status(401).json({ message: 'Não autorizado' });

        // Cannot remove the last member
        const memberCount = await prisma.projectMembership.count({
            where: { projectId }
        });

        if (memberCount <= 1) {
            return res.status(400).json({ message: 'Não é possível remover o último membro do projeto' });
        }

        // Cannot remove the last ADMIN if the target is an ADMIN
        const targetUserMembership = await prisma.projectMembership.findUnique({
            where: { projectId_userId: { projectId, userId: targetUserId } }
        });

        if (targetUserMembership?.role === 'ADMIN') {
            const adminCount = await prisma.projectMembership.count({
                where: { projectId, role: 'ADMIN' }
            });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Não é possível remover o último ADMIN' });
            }
        }

        await prisma.projectMembership.delete({
            where: { projectId_userId: { projectId, userId: targetUserId } },
        });

        res.status(200).json({ message: 'Membro removido com sucesso' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
