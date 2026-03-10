import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Global Document Types
 */
export const getDocumentTypes = async (req: AuthRequest, res: Response) => {
    try {
        const types = await prisma.documentType.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(types);
    } catch (error) {
        console.error('Error fetching document types:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const createDocumentType = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });

        const data: any = { name };
        if (description !== undefined) data.description = description;

        const newType = await prisma.documentType.create({
            data
        });
        res.status(201).json(newType);
    } catch (error) {
        console.error('Error creating document type:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const updateDocumentType = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { name, description } = req.body;

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;

        const updatedType = await prisma.documentType.update({
            where: { id },
            data
        });
        res.json(updatedType);
    } catch (error) {
        console.error('Error updating document type:', error);
        res.status(500).json({ message: 'Erro ao atualizar' });
    }
};

export const deleteDocumentType = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await prisma.documentType.delete({ where: { id } });
        res.json({ message: 'Tipo de documento removido' });
    } catch (error) {
        console.error('Error deleting document type:', error);
        res.status(500).json({ message: 'Erro ao remover' });
    }
};

/**
 * Project Required Documents
 */
export const getProjectRequiredDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const projectId = req.projectId as string;
        if (!projectId) return res.status(400).json({ message: 'Obrigatório informar projectId' });

        const requiredDocs = await prisma.projectRequiredDocument.findMany({
            where: { projectId },
            include: { documentType: true }
        });
        res.json(requiredDocs);
    } catch (error) {
        console.error('Error getting required docs:', error);
        res.status(500).json({ message: 'Erro interno' });
    }
};

export const configureProjectRequiredDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const projectId = req.projectId as string;
        const { documentTypeIds } = req.body;

        if (!projectId) return res.status(400).json({ message: 'Obrigatório informar projectId' });
        if (!Array.isArray(documentTypeIds)) {
            return res.status(400).json({ message: 'documentTypeIds deve ser um array' });
        }

        await prisma.projectRequiredDocument.deleteMany({
            where: { projectId }
        });

        if (documentTypeIds.length > 0) {
            const dataToInsert = documentTypeIds.map((id: string) => ({
                projectId,
                documentTypeId: id,
                required: true
            }));

            await prisma.projectRequiredDocument.createMany({
                data: dataToInsert
            });
        }

        const newRequiredDocs = await prisma.projectRequiredDocument.findMany({
            where: { projectId },
            include: { documentType: true }
        });

        res.json(newRequiredDocs);
    } catch (error) {
        console.error('Error configuring required docs:', error);
        res.status(500).json({ message: 'Erro ao configurar documentos' });
    }
};

/**
 * Client Documents
 */
export const uploadClientDocument = async (req: AuthRequest, res: Response) => {
    try {
        const projectId = req.body.projectId || (req.projectId as string);
        const { documentTypeId, ownerUserId, fileId } = req.body;
        const uploadedByUserId = req.user?.userId;
        const role = req.projectRole;

        if (!projectId || !documentTypeId || !ownerUserId || !fileId || !uploadedByUserId) {
            return res.status(400).json({ message: 'Faltam parâmetros obrigatórios' });
        }

        if (role === 'USER') {
            if (ownerUserId !== uploadedByUserId) {
                return res.status(403).json({ message: 'Usuário não pode enviar documentos em nome de outro' });
            }
        }

        const isRequired = await prisma.projectRequiredDocument.findFirst({
            where: { projectId, documentTypeId }
        });

        if (!isRequired) {
            return res.status(400).json({ message: 'Este tipo de documento não é exigido para este projeto' });
        }

        const clientDoc = await prisma.clientDocument.create({
            data: {
                projectId,
                documentTypeId,
                ownerUserId,
                uploadedByUserId,
                fileId,
                status: 'pending'
            },
            include: {
                documentType: true,
                file: true,
                ownerUser: { select: { id: true, name: true, email: true } },
                uploadedByUser: { select: { id: true, name: true, email: true } }
            }
        });

        res.status(201).json(clientDoc);
    } catch (error) {
        console.error('Error uploading client document:', error);
        res.status(500).json({ message: 'Erro ao salvar documento do cliente' });
    }
};

export const getClientDocuments = async (req: AuthRequest, res: Response) => {
    try {
        const projectId = req.projectId as string;
        const { projectRole } = req;
        const userId = req.user?.userId;

        if (!projectId || !userId) {
            return res.status(400).json({ message: 'Parâmetros inválidos' });
        }

        let whereClause: any = { projectId };

        if (projectRole === 'USER') {
            whereClause = { projectId, ownerUserId: userId };
        }

        const docs = await prisma.clientDocument.findMany({
            where: whereClause,
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

        res.json(docs);
    } catch (error) {
        console.error('Error getting client docs:', error);
        res.status(500).json({ message: 'Erro interno' });
    }
};

export const updateClientDocumentStatus = async (req: AuthRequest, res: Response) => {
    try {
        const docId = req.params.docId as string;
        const { status, rejectionReason } = req.body;
        console.log(status, rejectionReason)

        const reviewerId = req.user?.userId || null;
        const role = req.projectRole;

        if (role !== 'ADMIN') {
            return res.status(403).json({ message: 'Apenas administradores podem avaliar documentos' });
        }

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status inválido' });
        }

        const data: any = {
            status,
            reviewedAt: new Date(),
            reviewedByUserId: reviewerId
        };

        if (status === 'rejected' && rejectionReason) {
            data.rejectionReason = rejectionReason;
        } else if (status === 'rejected') {
            data.rejectionReason = null;
        } else {
            data.rejectionReason = null;
        }

        const updatedDoc = await prisma.clientDocument.update({
            where: { id: docId },
            data,
            include: {
                documentType: true,
                file: true,
                ownerUser: { select: { id: true, name: true, email: true } }
            }
        });

        res.json(updatedDoc);
    } catch (error) {
        console.error('Error updating document status:', error);
        res.status(500).json({ message: 'Erro ao avaliar documento' });
    }
};
