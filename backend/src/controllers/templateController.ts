import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';

export const getTemplates = async (req: AuthRequest, res: Response) => {
    try {
        const templates = await prisma.template.findMany({
            where: {
                isActive: true
            },
            include: {
                _count: {
                    select: { documentTypes: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        const mappedTemplates = templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            isDefault: t.isDefault,
            documentTypeCount: t._count.documentTypes
        }));

        res.json(mappedTemplates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const createTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description, documentTypes, isDefault } = req.body;
        const userId = req.user?.userId;

        if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const template = await prisma.template.create({
            data: {
                name,
                description,
                isDefault: isDefault || false,
                createdByUserId: userId,
                documentTypes: {
                    create: documentTypes?.map((dt: any, index: number) => ({
                        name: dt.name,
                        description: dt.description,
                        isRequired: dt.isRequired !== undefined ? dt.isRequired : true,
                        order: dt.order !== undefined ? dt.order : index
                    })) || []
                }
            },
            include: {
                documentTypes: true
            }
        });

        res.status(201).json(template);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const getTemplateById = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id as string;
        const template = await prisma.template.findUnique({
            where: { id },
            include: { documentTypes: { orderBy: { order: 'asc' } } }
        });

        if (!template) return res.status(404).json({ message: 'Template não encontrado' });
        res.json(template);
    } catch (error) {
        console.error('Error getting template:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const updateTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id as string;
        const { name, description, isActive, isDefault } = req.body;
        
        const template = await prisma.template.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(isActive !== undefined && { isActive }),
                ...(isDefault !== undefined && { isDefault }),
            }
        });
        
        res.json(template);
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const deleteTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id as string;

        const projectsCount = await prisma.project.count({
            where: { templateId: id }
        });

        if (projectsCount > 0) {
            return res.status(400).json({ message: 'Template não pode ser deletado pois está sendo usado por projetos' });
        }

        await prisma.template.delete({
            where: { id }
        });

        res.json({ message: 'Template deletado com sucesso' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const duplicateTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const original = await prisma.template.findUnique({
            where: { id },
            include: { documentTypes: true }
        });

        if (!original) return res.status(404).json({ message: 'Template não encontrado' });

        const duplicated = await prisma.template.create({
            data: {
                name: `${original.name} (Cópia)`,
                description: original.description,
                isDefault: false,
                createdByUserId: userId,
                documentTypes: {
                    create: original.documentTypes.map(dt => ({
                        name: dt.name,
                        description: dt.description,
                        isRequired: dt.isRequired,
                        order: dt.order
                    }))
                }
            },
            include: { documentTypes: true }
        });

        res.status(201).json(duplicated);
    } catch (error) {
        console.error('Error duplicating template:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};
