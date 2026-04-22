import { Request, Response } from 'express';
import fs from 'fs';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';
import { upload } from '../middleware/upload';
import crypto from 'crypto';
import { uploadToR2, getFileUrl, getFileFromR2 } from '../services/r2Service';

// Map allowed MIME types to secure, hardcoded extensions
const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

const DEFAULT_DOWNLOAD_FORMAT = 'pdf';
const ALLOWED_DOWNLOAD_FORMATS = new Set(['pdf', 'original']);
const PDF_CONVERTIBLE_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type DownloadFormat = 'pdf' | 'original';

const getPythonMicroserviceUrl = () =>
    process.env.AMBIENTE == 'DEV' ? 'http://localhost:8000' : process.env.PYTHON_MICROSERVICE_URL;

const resolveDownloadFormat = (value: unknown): DownloadFormat => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : DEFAULT_DOWNLOAD_FORMAT;
    return ALLOWED_DOWNLOAD_FORMATS.has(normalized) ? normalized as DownloadFormat : DEFAULT_DOWNLOAD_FORMAT;
};

const replaceExtensionWithPdf = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex <= 0) return `${filename}.pdf`;
    return `${filename.slice(0, lastDotIndex)}.pdf`;
};

const convertBufferToPdf = async (buffer: Buffer, originalName: string, mimeType: string): Promise<Buffer> => {
    const url = getPythonMicroserviceUrl();
    if (!url) {
        throw new Error('PYTHON_MICROSERVICE_URL nao configurada');
    }

    const formData = new FormData();
    formData.append('file', buffer, {
        filename: originalName,
        contentType: mimeType,
        knownLength: buffer.length,
    });

    const response = await axios.post(`${url}/convert-to-pdf`, formData, {
        headers: {
            ...formData.getHeaders(),
        },
        responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
};

const buildDownloadPayload = async ({
    buffer,
    originalName,
    mimeType,
    requestedFormat,
}: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    requestedFormat: DownloadFormat;
}): Promise<{ buffer: Buffer; mimeType: string; filename: string; format: DownloadFormat }> => {
    if (requestedFormat === 'original') {
        return {
            buffer,
            mimeType,
            filename: originalName,
            format: 'original',
        };
    }

    if (mimeType === 'application/pdf') {
        return {
            buffer,
            mimeType,
            filename: replaceExtensionWithPdf(originalName),
            format: 'pdf',
        };
    }

    if (mimeType.startsWith('image/') || PDF_CONVERTIBLE_MIME_TYPES.has(mimeType)) {
        const pdfBuffer = await convertBufferToPdf(buffer, originalName, mimeType);
        return {
            buffer: pdfBuffer,
            mimeType: 'application/pdf',
            filename: replaceExtensionWithPdf(originalName),
            format: 'pdf',
        };
    }

    return {
        buffer,
        mimeType,
        filename: originalName,
        format: 'original',
    };
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
            if (file && file.path) fs.promises.unlink(file.path).catch(e=>console.error(e));
            console.error('[Upload] Unauthorized: user context missing');
            return res.status(401).json({ message: 'Não autorizado' });
        }

        let analysisData: any = null;

        // If it's an image, send to Python microservice for validation
        if (file.mimetype.startsWith('image/')) {
            console.log('[Upload] Image detected, sending for analysis...');
            try {

                const url = getPythonMicroserviceUrl();
                const formData = new FormData();
                const stream = fs.createReadStream(file.path);
                formData.append('file', stream, {
                    filename: file.originalname,
                    contentType: file.mimetype,
                    knownLength: file.size,
                });
                const pythonResponse = await axios.post(`${url}/analyze`, formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });
                analysisData = pythonResponse.data;
                console.log('[Upload] Analysis complete:', analysisData);

                if (analysisData.status == "REJECTED") {
                    console.log('[Upload] Image rejected by analysis service');
                    // @ts-ignore   
                    await prisma.rejectedUpload.create({
                        data: {
                            userId,
                            projectId: projectId || null,
                        },
                    });
                    console.log('[Upload] Rejection event recorded in database');

                    const reasonStr = analysisData.reasons?.length ? ` Motivos: ${analysisData.reasons.join(" | ")}` : "";
                    
                    if (file && file.path) fs.promises.unlink(file.path).catch(e=>console.error(e));

                    return res.status(400).json({
                        success: false,
                        message: `A imagem não atende aos critérios mínimos de qualidade.${reasonStr}`,
                        analysis: {
                            approved: analysisData.approved,
                            status: analysisData.status,
                            score: analysisData.final_score ?? analysisData.score,
                            minScore: analysisData.minScore,
                            reasons: analysisData.reasons,
                            quality_label: analysisData.quality_label,
                            textDetected: analysisData.textDetected,
                            blurScore: analysisData.blurScore,
                            brightness: analysisData.brightness,
                            usefulAreaPct: analysisData.usefulAreaPct,
                            metrics: analysisData.metrics
                        }
                    });
                }
                console.log(`[Upload] Image analysis status: ${analysisData.status}`);
            } catch (microserviceError) {
                console.error('[Upload] Microservice error:', microserviceError);
                if (file && file.path) fs.promises.unlink(file.path).catch(e=>console.error(e));
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
        await uploadToR2(fs.createReadStream(file.path), file.mimetype, savedFilename);
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
                status: analysisData.status,
                score: analysisData.final_score ?? analysisData.score,
                quality_label: analysisData.quality_label,
                reasons: analysisData.reasons,
                textDetected: analysisData.textDetected,
                blurScore: analysisData.blurScore,
                brightness: analysisData.brightness,
                usefulAreaPct: analysisData.usefulAreaPct,
                metrics: analysisData.metrics
            } : undefined,
            document: resultingFile,
            file: resultingFile,
            docStatus: analysisData?.status
        });

    } catch (error) {
        console.error('[Upload] Unexpected internal error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    } finally {
        if (req.file && req.file.path) {
            fs.promises.unlink(req.file.path).catch(e => console.error("Erro ao apagar arquivo teporário:", e));
        }
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
        const requestedFormat = resolveDownloadFormat(req.query.format);
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ message: 'URL do arquivo não fornecida' });
        }

        // Extract filename from URL (last segment before query params)
        const urlWithoutQuery = url.split('?')[0];
        const filename = urlWithoutQuery ? urlWithoutQuery.split('/').pop() : null;

        if (!filename) {
            return res.status(400).json({ message: 'Nome do arquivo não encontrado na URL' });
        }

        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });

        // Security check (IDOR fix)
        const fileRecord = await prisma.file.findFirst({
            where: { filename },
            include: { project: { include: { members: true } } }
        });

        if (!fileRecord) {
            return res.status(404).json({ message: 'Arquivo não encontrado' });
        }

        const isOwner = fileRecord.userId === userId;
        const isMember = fileRecord.project?.members.some(m => m.userId === userId);
        
        if (!isOwner && !isMember) {
            return res.status(403).json({ message: 'Acesso negado. Você não pertence a este projeto.' });
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

        const downloadPayload = await buildDownloadPayload({
            buffer: fileBuffer,
            originalName: fileRecord.originalName,
            mimeType,
            requestedFormat,
        });

        const base64 = downloadPayload.buffer.toString('base64');
        res.json({
            base64,
            mimeType: downloadPayload.mimeType,
            filename: downloadPayload.filename,
            format: downloadPayload.format,
        });
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

export const getProjectFilesBase64 = async (req: AuthRequest, res: Response) => {
    try {
        const projectId = req.params.projectId as string;
        const userId = req.user?.userId;
        const requestedFormat = resolveDownloadFormat(req.query.format);

        if (!projectId) {
            return res.status(400).json({ message: 'ID do projeto não fornecido' });
        }

        if (!userId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        // Verify if user is part of the project
        const membership = await prisma.projectMembership.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId
                }
            }
        });

        if (!membership) {
            return res.status(403).json({ message: 'Você não tem acesso a este projeto' });
        }

        // Fetch all client documents for this project
        let whereClause: any = { projectId };
        if (membership.role === 'USER') {
            whereClause = { projectId, ownerUserId: userId };
        }

        const clientDocuments = await prisma.clientDocument.findMany({
            where: whereClause,
            include: {
                file: true,
                documentType: true,
                ownerUser: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (clientDocuments.length === 0) {
            return res.json({ files: [] });
        }

        // Fetch all files from R2 in parallel
        const filesData = await Promise.all(
            clientDocuments.map(async (doc: any) => {
                try {
                    const r2Data = await getFileFromR2(doc.file.filename);
                    const downloadPayload = await buildDownloadPayload({
                        buffer: r2Data.buffer,
                        originalName: doc.file.originalName,
                        mimeType: r2Data.contentType,
                        requestedFormat,
                    });
                    
                    return {
                        id: doc.id,
                        originalName: doc.file.originalName,
                        filename: doc.file.filename,
                        downloadName: downloadPayload.filename,
                        mimeType: downloadPayload.mimeType,
                        base64: downloadPayload.buffer.toString('base64'),
                        format: downloadPayload.format,
                        metadata: {
                            userName: doc.ownerUser.name,
                            userEmail: doc.ownerUser.email,
                            documentType: doc.documentType.name
                        }
                    };
                } catch (error) {
                    console.error(`Failed to fetch file ${doc.file?.filename} from R2:`, error);
                    return null;
                }
            })
        );

        // Filter out any failed R2 fetches
        const successfulFiles = filesData.filter(f => f !== null);

        res.json({ files: successfulFiles });
    } catch (error) {
        console.error('Get project files base64 error:', error);
        res.status(500).json({ message: 'Erro interno ao buscar arquivos do projeto' });
    }
};
