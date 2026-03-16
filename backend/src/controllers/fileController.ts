import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';
import { upload } from '../middleware/upload';
import fs from 'fs';
import path from 'path';
import { uploadToR2, getFileUrl, getFileFromR2 } from '../services/r2Service';

export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        const file = req.file;
        const userId = req.user?.userId;
        const { projectId } = req.body;

        console.log(`[Upload] Starting upload process for user ${userId} in project ${projectId}`);

        if (!file) {
            console.error('[Upload] No file received in request');
            return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        console.log(`[Upload] File received: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

        if (!projectId) {
            console.error('[Upload] Missing projectId in request body');
            return res.status(400).json({ message: 'projectId é obrigatório' });
        }

        if (!userId) {
            console.error('[Upload] Unauthorized: user context missing');
            return res.status(401).json({ message: 'Não autorizado' });
        }

        let analysisData: any = null;

        // If it's an image, send to Python microservice for validation
        if (file.mimetype.startsWith('image/')) {
            console.log('[Upload] Image detected, sending for analysis...');
            try {
                const formData = new FormData();
                formData.append('file', fs.createReadStream(file.path));
                const pythonResponse = await axios.post('http://localhost:8000/analyze', formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                analysisData = pythonResponse.data;
                console.log('[Upload] Analysis complete:', analysisData);

                if (!analysisData.approved) {
                    console.log('[Upload] Image rejected by analysis service');
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
                console.log('[Upload] Image approved');
            } catch (microserviceError) {
                console.error('[Upload] Microservice error:', microserviceError);
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
                return res.status(503).json({
                    success: false,
                    message: "Falha ao validar a imagem. O serviço de análise pode estar indisponível."
                });
            }
        }

        console.log('[Upload] Saving file to R2...');
        const fileBuffer = fs.readFileSync(file.path);
        const savedFilename = await uploadToR2(fileBuffer, file.mimetype, file.originalname);
        console.log(`[Upload] File saved to R2 as: ${savedFilename}`);

        // Remove from local disk after upload
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log("[Upload] Temporary local file deleted");
        }

        console.log('[Upload] Creating database record...');
        const dbFile = await prisma.file.create({
            data: {
                filename: savedFilename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                url: await getFileUrl(savedFilename),
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
                    recommendation: analysisData.recommendation || (analysisData.reasons ? analysisData.reasons.join(" | ") : null),
                }
            });
            console.log('[Upload] Verification result saved to database');
        }

        const resultingFile = await prisma.file.findUnique({
            where: { id: dbFile.id },
            include: { verificationResults: true }
        });

        console.log('[Upload] Process finished successfully');
        res.status(201).json({
            success: true,
            message: 'Upload realizado com sucesso',
            analysis: analysisData ? {
                approved: analysisData.approved,
                score: analysisData.score
            } : undefined,
            document: resultingFile,
            file: resultingFile
        });

    } catch (error) {
        console.error('[Upload] Unexpected internal error:', error);
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

        // The URL could be a public URL, a presigned URL, or an old local path.
        // What we need is the object key/filename.
        // Usually, the filename is the last part of the URL before query params.
        const urlWithoutQuery = url.split('?')[0];
        const filename = urlWithoutQuery ? urlWithoutQuery.split('/').pop() : null;

        if (!filename) {
            return res.status(400).json({ message: 'Nome do arquivo não encontrado na URL' });
        }

        let fileBuffer: Buffer;
        let mimeType: string;

        try {
            // Try fetching from R2 first
            const r2Data = await getFileFromR2(filename);
            fileBuffer = r2Data.buffer;
            mimeType = r2Data.contentType;
        } catch (r2Error) {
            // Fallback for older local files
            console.log(`Failed to fetch ${filename} from R2, falling back to local file system.`, r2Error);
            const filePath = path.join(__dirname, '../../uploads', filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ message: 'Arquivo não encontrado' });
            }

            fileBuffer = fs.readFileSync(filePath);
            
            const ext = path.extname(filename).toLowerCase();
            mimeType = 'application/octet-stream';
            if (ext === '.pdf') mimeType = 'application/pdf';
            else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
            else if (ext === '.png') mimeType = 'image/png';
        }

        const base64 = fileBuffer.toString('base64');
        res.json({ base64, mimeType });
    } catch (error) {
        console.error('Get file base64 error:', error);
        res.status(500).json({ message: 'Erro interno ao converter arquivo' });
    }
};
