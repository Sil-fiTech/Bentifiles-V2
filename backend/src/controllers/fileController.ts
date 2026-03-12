import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        const file = req.file;
        console.log(file);
        const userId = req.user?.userId;
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

        let analysisData: any = null;

        // If it's an image, send to Python microservice for validation MINDFULLY BEFORE SAVING TO DB
        if (file.mimetype.startsWith('image/')) {
            try {
                const formData = new FormData();
                formData.append('file', fs.createReadStream(file.path));
                const pythonResponse = await axios.post('http://localhost:8000/analyze', formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                analysisData = pythonResponse.data;
                console.log(analysisData);
                if (!analysisData.approved) {
                    fs.unlinkSync(file.path);
                    return res.status(400).json({
                        success: false,
                        message: "A imagem não atende aos critérios mínimos de qualidade",
                        analysis: {
                            approved: analysisData.approved,
                            score: analysisData.score,
                            minScore: analysisData.minScore,
                            reasons: analysisData.reasons
                        }
                    });
                }
            } catch (microserviceError) {
                console.error('Microservice error:', microserviceError);
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
                return res.status(503).json({
                    success: false,
                    message: "Falha ao validar a imagem. O serviço de análise pode estar indisponível."
                });
            }
        }

        // Save file metadata to database only AFTER validation passes
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

        if (analysisData) {
            await prisma.verificationResult.create({
                data: {
                    fileId: dbFile.id,
                    score: analysisData.score,
                    status: analysisData.status,
                    blurScore: analysisData.blurScore,
                    brightness: analysisData.brightness,
                    textDetected: analysisData.textDetected,
                    usefulAreaPct: analysisData.usefulAreaPct,
                    // Handle fallback gracefully to not break backwards compat in DB
                    recommendation: analysisData.recommendation || (analysisData.reasons ? analysisData.reasons.join(" | ") : null),
                }
            });
        }

        // Return the created file and any results
        const resultingFile = await prisma.file.findUnique({
            where: { id: dbFile.id },
            include: { verificationResults: true }
        });

        res.status(201).json({
            success: true,
            message: 'Upload realizado com sucesso',
            analysis: analysisData ? {
                approved: analysisData.approved,
                score: analysisData.score
            } : undefined,
            document: resultingFile,
            file: resultingFile // Manter compatibilidade com código frontend antigo
        });

    } catch (error) {
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

export const getFileBase64 = async (req: AuthRequest, res: Response) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ message: 'URL do arquivo não fornecida' });
        }

        const filename = url.replace('/uploads/', '');
        const filePath = path.join(__dirname, '../../uploads', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Arquivo não encontrado' });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const base64 = fileBuffer.toString('base64');

        const ext = path.extname(filename).toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === '.pdf') mimeType = 'application/pdf';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';

        res.json({ base64, mimeType });
    } catch (error) {
        console.error('Get file base64 error:', error);
        res.status(500).json({ message: 'Erro interno ao converter arquivo' });
    }
};
