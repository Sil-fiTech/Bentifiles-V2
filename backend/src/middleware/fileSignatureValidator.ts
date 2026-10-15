import { NextFunction, Request, Response } from 'express';
import { fromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const validateFileSignature = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = req.file;

        if (!file) {
            return next();
        }

        const typeInfo = await fromBuffer(file.buffer);

        if (!typeInfo) {
            console.error(`[BinaryValidator] Failed to detect binary signature for ${file.originalname}`);
            return res.status(400).json({
                success: false,
                message: 'Assinatura do arquivo invalida ou arquivo corrompido.',
            });
        }

        console.log(`[BinaryValidator] Checking ${file.originalname}: declared=${file.mimetype} detected=${typeInfo.mime}`);

        if (!ALLOWED_MIME_TYPES.includes(typeInfo.mime)) {
            console.warn(`[BinaryValidator] Blocked file type: ${typeInfo.mime}`);
            return res.status(400).json({
                success: false,
                message: `Tipo de arquivo nao permitido (${typeInfo.mime}).`,
            });
        }

        if (file.mimetype !== typeInfo.mime) {
            console.warn(`[BinaryValidator] MIME mismatch: header=${file.mimetype} binary=${typeInfo.mime}`);
        }

        next();
    } catch (error) {
        console.error('[BinaryValidator] Internal error:', error);
        res.status(500).json({ message: 'Erro interno ao validar integridade do arquivo.' });
    }
};
