import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma';
import { generateSlug } from '../utils/slugify';

export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        console.log("userId ==> ", userId);
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const memberships = await prisma.projectMembership.findMany({
            where: { 
                userId,
                project: {
                    status: { not: 'DELETED' }
                }
            },
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
        const { name, templateId } = req.body;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const projectName = name || 'Projeto';

        const project = await prisma.project.create({
            data: {
                name: projectName,
                createdByUserId: userId,
                templateId: templateId || undefined,
                members: {
                    create: {
                        userId,
                        role: 'ADMIN',
                    },
                },
            },
        });

        if (templateId) {
            const template = await prisma.template.findUnique({
                where: { id: templateId },
                include: { documentTypes: true }
            });

            if (template && template.documentTypes.length > 0) {
                for (const tdt of template.documentTypes) {
                    const slug = generateSlug(tdt.name);
                    
                    let docType = await prisma.documentType.findFirst({
                        where: {
                            slug,
                            deletedAt: null,
                            OR: [
                                { isDefault: true },
                                { tenantId: userId }
                            ]
                        }
                    });

                    if (!docType) {
                        docType = await prisma.documentType.create({
                            data: {
                                name: tdt.name,
                                slug,
                                description: tdt.description,
                                isDefault: false,
                                createdById: userId,
                                tenantId: userId
                            }
                        });
                    }

                    await prisma.projectRequiredDocument.create({
                        data: {
                            projectId: project.id,
                            documentTypeId: docType.id,
                            required: tdt.isRequired,
                            order: tdt.order
                        }
                    });
                }
            }
        }

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

export const getProjectDetails = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id as string;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        // Get permissions from membershipController logic (mirrored here)
        const getPermissions = (role: string) => {
            if (role === 'ADMIN') {
                return ['PROJECT_EDIT', 'INVITE_CREATE', 'MEMBER_MANAGE', 'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
            }
            return ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
        };

        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                },
                requiredDocuments: {
                    include: { documentType: true }
                }
            }
        });

        if (!project || project.status === 'DELETED') return res.status(404).json({ message: 'Projeto não encontrado' });

        // Get client documents separately because they have complex includes
        const clientDocs = await prisma.clientDocument.findMany({
            where: {
                projectId: id,
                // If user, only their docs. If admin, all.
                ...(req.projectRole === 'USER' ? { ownerUserId: userId } : {})
            },
            include: {
                documentType: true,
                file: {
                    include: { verificationResults: true }
                },
                ownerUser: { select: { id: true, name: true, email: true } },
                uploadedByUser: { select: { id: true, name: true, email: true } },
                reviewedByUser: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Get standard files
        const files = await prisma.file.findMany({
            where: { projectId: id },
            orderBy: { createdAt: 'desc' },
        });

        const me = project.members.find(m => m.userId === userId);
        const currentUserPermissions = me ? getPermissions(me.role) : ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
      
        res.status(200).json({
            project: {
                id: project.id,
                name: project.name,
                status: project.status,
                createdAt: project.createdAt
            },
            files,
            members: project.members.map(m => ({
                userId: m.userId,
                user: m.user,
                permissions: getPermissions(m.role)
            })),
            requiredDocuments: project.requiredDocuments,
            clientDocuments: clientDocs,
            currentUserPermissions
        });
    } catch (error) {
        console.error('Error fetching project details:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const applyTemplateToProject = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id as string;
        const { templateId } = req.body;
        
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });
        if (!templateId) return res.status(400).json({ message: 'templateId é obrigatório' });

        const template = await prisma.template.findUnique({
            where: { id: templateId },
            include: { documentTypes: true }
        });

        if (!template) {
            return res.status(404).json({ message: 'Template não encontrado' });
        }

        const project = await prisma.project.findUnique({
            where: { id }
        });

        if (!project || project.status === 'DELETED') {
            return res.status(404).json({ message: 'Projeto não encontrado' });
        }

        // Get currently required docs to avoid duplicates
        const existingReqs = await prisma.projectRequiredDocument.findMany({
            where: { projectId: id }
        });
        const existingDocTypeIds = existingReqs.map(r => r.documentTypeId);

        if (template.documentTypes.length > 0) {
            for (const tdt of template.documentTypes) {
                const slug = generateSlug(tdt.name);
                
                let docType = await prisma.documentType.findFirst({
                    where: {
                        slug,
                        deletedAt: null,
                        OR: [
                            { isDefault: true },
                            { tenantId: userId }
                        ]
                    }
                });

                if (!docType) {
                    docType = await prisma.documentType.create({
                        data: {
                            name: tdt.name,
                            slug,
                            description: tdt.description,
                            isDefault: false,
                            createdById: userId,
                            tenantId: userId
                        }
                    });
                }

                // If not already required in project, add it
                if (!existingDocTypeIds.includes(docType.id)) {
                    await prisma.projectRequiredDocument.create({
                        data: {
                            projectId: project.id,
                            documentTypeId: docType.id,
                            required: tdt.isRequired,
                            order: tdt.order
                        }
                    });
                    existingDocTypeIds.push(docType.id);
                }
            }
        }
        
        // Fetch and return the updated required documents list
        const updatedRequiredDocs = await prisma.projectRequiredDocument.findMany({
            where: { projectId: id },
            include: { documentType: true },
            orderBy: { order: 'asc' }
        });

        res.status(200).json(updatedRequiredDocs);
    } catch (error) {
        console.error('Error applying template to project:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const archiveProject = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id as string;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const project = await prisma.project.update({
            where: { id },
            data: { status: 'ARCHIVED' },
        });

        res.status(200).json({ project });
    } catch (error) {
        console.error('Error archiving project:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const unarchiveProject = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id as string;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        const project = await prisma.project.update({
            where: { id },
            data: { status: 'ACTIVE' },
        });

        res.status(200).json({ project });
    } catch (error) {
        console.error('Error unarchiving project:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id as string;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        await prisma.project.update({
            where: { id },
            data: { status: 'DELETED' }
        });

        res.status(200).json({ message: 'Projeto excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

