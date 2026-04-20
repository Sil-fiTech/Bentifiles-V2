import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma';

const getPermissions = (role: string) => {
    if (role === 'ADMIN') {
        return ['PROJECT_EDIT', 'INVITE_CREATE', 'MEMBER_MANAGE', 'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
    }
    return ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
};

export const acceptProjectInviteForUser = async (inviteToken: string, userId: string) => {
    const validInvite = await prisma.projectInvite.findUnique({
        where: { token: inviteToken },
        include: {
            project: {
                select: {
                    id: true,
                    status: true
                }
            }
        }
    });

    if (!validInvite) {
        return { ok: false as const, status: 404, message: 'Convite nao encontrado ou invalido' };
    }

    if (validInvite.expiresAt < new Date()) {
        return { ok: false as const, status: 400, message: 'Convite expirado' };
    }

    if (validInvite.project.status === 'DELETED') {
        return { ok: false as const, status: 404, message: 'Projeto nao encontrado.' };
    }

    if (validInvite.project.status === 'ARCHIVED') {
        return { ok: false as const, status: 403, message: 'Este projeto esta arquivado (somente leitura). Nenhuma alteracao pode ser feita.' };
    }

    if (validInvite.usedCount >= validInvite.maxUses) {
        return { ok: false as const, status: 400, message: 'Convite ja atingiu o limite de uso' };
    }

    const existingMembership = await prisma.projectMembership.findUnique({
        where: {
            projectId_userId: {
                projectId: validInvite.projectId,
                userId,
            }
        }
    });

    if (existingMembership) {
        return {
            ok: true as const,
            projectId: validInvite.projectId,
            message: 'Usuario ja e membro deste projeto'
        };
    }

    await prisma.projectMembership.create({
        data: {
            projectId: validInvite.projectId,
            userId,
            role: validInvite.role,
        }
    });

    await prisma.projectInvite.update({
        where: { id: validInvite.id },
        data: { usedCount: { increment: 1 } }
    });

    return {
        ok: true as const,
        projectId: validInvite.projectId,
        message: 'Entrou no projeto com sucesso'
    };
};

export const createInvite = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const projectId = req.params.id as string;

        if (!userId) return res.status(401).json({ message: 'Nao autorizado' });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1);

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

        if (!userId) return res.status(401).json({ message: 'Nao autorizado' });

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
        const { role } = req.body;

        if (!currentUserId) return res.status(401).json({ message: 'Nao autorizado' });

        if (role === 'USER') {
            const adminCount = await prisma.projectMembership.count({
                where: { projectId, role: 'ADMIN' }
            });

            const targetIsAdmin = await prisma.projectMembership.findUnique({
                where: { projectId_userId: { projectId, userId: targetUserId } }
            });

            if (adminCount <= 1 && targetIsAdmin?.role === 'ADMIN') {
                return res.status(400).json({ message: 'Nao e possivel rebaixar o ultimo ADMIN' });
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

        if (!currentUserId) return res.status(401).json({ message: 'Nao autorizado' });

        const memberCount = await prisma.projectMembership.count({
            where: { projectId }
        });

        if (memberCount <= 1) {
            return res.status(400).json({ message: 'Nao e possivel remover o ultimo membro do projeto' });
        }

        const targetUserMembership = await prisma.projectMembership.findUnique({
            where: { projectId_userId: { projectId, userId: targetUserId } }
        });

        if (targetUserMembership?.role === 'ADMIN') {
            const adminCount = await prisma.projectMembership.count({
                where: { projectId, role: 'ADMIN' }
            });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Nao e possivel remover o ultimo ADMIN' });
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

export const joinProject = async (req: AuthRequest, res: Response) => {
    try {
        const { inviteToken } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Usuario nao autenticado' });
        }

        if (!inviteToken) {
            return res.status(400).json({ message: 'Token de convite ausente' });
        }

        const inviteResult = await acceptProjectInviteForUser(inviteToken, userId);

        if (!inviteResult.ok) {
            return res.status(inviteResult.status).json({ message: inviteResult.message });
        }

        res.status(200).json({
            message: inviteResult.message,
            projectId: inviteResult.projectId
        });
    } catch (error) {
        console.error('Error joining project via invite:', error);
        res.status(500).json({ message: 'Erro interno ao processar convite' });
    }
};
