import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';
import { upload } from '../middleware/upload';
import crypto from 'crypto';
import { Readable } from 'stream';
import { uploadToR2, getFileUrl, getFileFromR2 } from '../services/r2Service';

// Map allowed MIME types to secure, hardcoded extensions
const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

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

        const fileBuffer = file.buffer;
        let analysisData: any = null;

        // If it's an image, send to Python microservice for validation
        if (file.mimetype.startsWith('image/')) {
            console.log('[Upload] Image detected, sending for analysis...');
            try {

                const url = process.env.AMBIENTE == 'DEV' ? 'http://localhost:8000' : process.env.PYTHON_MICROSERVICE_URL;
                const formData = new FormData();
                const stream = Readable.from(fileBuffer);
                formData.append('file', stream, {
                    filename: file.originalname,
                    contentType: file.mimetype,
                    knownLength: fileBuffer.length,
                });
                const pythonResponse = await axios.post(`${url}/analyze`, formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                analysisData = pythonResponse.data;
                console.log('[Upload] Analysis complete:', analysisData);

                if (!analysisData.approved) {
                    console.log('[Upload] Image rejected by analysis service');
                    // @ts-ignore   
                    await prisma.rejectedUpload.create({
                        data: {
                            userId,
                            projectId: projectId || null,
                        },
                    });
                    console.log('[Upload] Rejection event recorded in database');

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
                return res.status(503).json({
                    success: false,
                    message: "Falha ao validar a imagem. O serviço de análise pode estar indisponível."
                });
            }
        }

        // Generate secure filename
        const ext = mimeToExt[file.mimetype] || '.bin';
        const savedFilename = `${crypto.randomUUID()}${ext}`;

        console.log('[Upload] Saving file to R2...');
        await uploadToR2(fileBuffer, file.mimetype, savedFilename);
        console.log(`[Upload] File saved to R2 as: ${savedFilename}`);

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
            include: {
                clientDocuments: true,
                project: true,
                user: {
                    select: {
                        name: true,
                        // email: true (se quiser)
                    },
                },
                verificationResults: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        // Regenerate fresh URLs for each file (fixes old files with expired signed URLs)
        const filesWithFreshUrls = await Promise.all(
            files.map(async (file) => ({
                ...file,
                url: await getFileUrl(file.filename),
            }))
        );

        res.json({ files: filesWithFreshUrls });
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

        // Extract filename from URL (last segment before query params)
        const urlWithoutQuery = url.split('?')[0];
        const filename = urlWithoutQuery ? urlWithoutQuery.split('/').pop() : null;

        if (!filename) {
            return res.status(400).json({ message: 'Nome do arquivo não encontrado na URL' });
        }

        let fileBuffer: Buffer;
        let mimeType: string;

        try {
            const r2Data = await getFileFromR2(filename);
            fileBuffer = r2Data.buffer;
            mimeType = r2Data.contentType;
        } catch (r2Error) {
            console.error(`Failed to fetch ${filename} from R2:`, r2Error);
            return res.status(404).json({ message: 'Arquivo não encontrado' });
        }

        const base64 = fileBuffer.toString('base64');
        res.json({ base64, mimeType });
    } catch (error) {
        console.error('Get file base64 error:', error);
        res.status(500).json({ message: 'Erro interno ao converter arquivo' });
    }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const [aprovedUploads, rejectedUploads] = await Promise.all([
            prisma.file.count({
                where: { userId }
            }),
            // @ts-ignore
            prisma.rejectedUpload.count({
                where: { userId }
            })
        ]);

        const totalUploads = aprovedUploads + rejectedUploads
        return res.status(200).json({
            totalUploads: totalUploads,
            rejectedUploads: rejectedUploads
        });
    } catch (error) {
        console.error('[Dashboard Stats] Error:', error);
        return res.status(500).json({ message: 'Erro ao buscar estatísticas' });
    }
};

export const getPendingFiles = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const pendingFiles = await prisma.file.findMany({
            where: {
                project: {
                    createdByUserId: userId,
                },
                clientDocuments: {
                    some: {
                        status: 'pending',
                    },
                },
            },
            include: {
                clientDocuments: true,
                project: true,
                user: {
                    select: {
                        name: true,
                        // email: true (se quiser)
                    },
                },
                verificationResults: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.json({ files: pendingFiles });
    } catch (error) {
        console.error('[Pending Files] Error:', error);
        res.status(500).json({ message: 'Erro ao buscar arquivos pendentes' });
    }
};