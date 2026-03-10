import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        const file = req.file;
        console.log("file ==> ", file);
        const userId = req.user?.userId;
        console.log("userId ==> ", userId);
        const { projectId } = req.body;

        if (!file) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        if (!projectId) {
            return res.status(400).json({ message: 'projectId é obrigatório' });
        }

        if (!userId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        // Save file metadata to database
        const dbFile = await prisma.file.create({
            data: {
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                url: `/uploads/${file.filename}`, // Local URL for now
                userId: userId,
                projectId: projectId,
            },
        });

        // If it's an image, send to Python microservice for validation
        if (file.mimetype.startsWith('image/')) {
            try {
                const formData = new FormData();
                formData.append('file', fs.createReadStream(file.path));

                const pythonResponse = await axios.post('http://localhost:8000/analyze', formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                const analysisData = pythonResponse.data;

                await prisma.verificationResult.create({
                    data: {
                        fileId: dbFile.id,
                        score: analysisData.score,
                        status: analysisData.status,
                        blurScore: analysisData.blurScore,
                        brightness: analysisData.brightness,
                        textDetected: analysisData.textDetected,
                        usefulAreaPct: analysisData.usefulAreaPct,
                        recommendation: analysisData.recommendation,
                    }
                });

            } catch (microserviceError) {
                console.error('Microservice error:', microserviceError);
                // We still return success for the upload, but log that validation failed
            }
        }

        // Return the created file and any results
        const resultingFile = await prisma.file.findUnique({
            where: { id: dbFile.id },
            include: { verificationResults: true }
        });

        res.status(201).json({
            message: 'Arquivo enviado com sucesso',
            file: resultingFile
        });

    } catch (error) {
    console.log("error ==> ", error);
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const getFiles = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: "Não autorizado" });

        const files = await prisma.file.findMany({
            where: { userId },
            include: { verificationResults: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(files);
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}
