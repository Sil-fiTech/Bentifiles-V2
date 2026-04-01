import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

export const checkProjectNotArchived = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const projectId = req.params.id || req.params.projectId || req.body.projectId;

        if (!projectId) {
            return next();
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { status: true }
        });

        if (project && project.status === 'DELETED') {
            return res.status(404).json({ message: 'Projeto não encontrado.' });
        }

        if (project && project.status === 'ARCHIVED') {
            return res.status(403).json({ message: 'Este projeto está arquivado (somente leitura). Nenhuma alteração pode ser feita.' });
        }

        next();
    } catch (error) {
        console.error('Error checking project status:', error);
        res.status(500).json({ message: 'Erro interno ao verificar o status do projeto.' });
    }
};
