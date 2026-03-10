import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma';

export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const memberships = await prisma.projectMembership.findMany({
            where: { userId },
            include: { project: true },
        });

        const projects = memberships.map((m) => m.project);
        res.status(200).json({ projects });
    } catch (error) {
    console.log("error ==> ", error);
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const createProject = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { name } = req.body;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const projectName = name || 'Projeto';

        const project = await prisma.project.create({
            data: {
                name: projectName,
                createdByUserId: userId,
                members: {
                    create: {
                        userId,
                        role: 'ADMIN',
                    },
                },
            },
        });

        res.status(201).json({ project });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const updateProjectName = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id as string;
        const { name } = req.body;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const project = await prisma.project.update({
            where: { id },
            data: { name },
        });

        res.status(200).json({ project });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const getProjectDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id as string;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const files = await prisma.file.findMany({
            where: { projectId: id },
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json({ files });
    } catch (error) {
        console.error('Error fetching project documents:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};
