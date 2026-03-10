import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../prisma';

export const checkRole = (allowedRoles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.userId;
            const projectId = req.params?.id || req.body?.projectId || req.query?.projectId;

            if (!userId) {
                return res.status(401).json({ message: 'Não autorizado: Usuário não autenticado' });
            }

            if (!projectId) {
                return res.status(400).json({ message: 'Requisição inválida: ID do projeto é obrigatório' });
            }

            const membership = await prisma.projectMembership.findUnique({
                where: {
                    projectId_userId: {
                        projectId,
                        userId,
                    },
                },
            });

            if (!membership) {
                return res.status(403).json({ message: 'Acesso negado: Você não é membro deste projeto' });
            }

            if (!allowedRoles.includes(membership.role)) {
                return res.status(403).json({ message: `Acesso negado: Esta ação requer um dos seguintes papéis: ${allowedRoles.join(', ')}` });
            }

            // Attach context to request
            req.projectId = projectId;
            req.projectRole = membership.role as 'ADMIN' | 'USER';

            next();
        } catch (error) {
        console.log("error ==> ", error);
            console.error('Error in checkRole middleware:', error);
            res.status(500).json({ message: 'Erro interno do servidor' });
        }
    };
};
