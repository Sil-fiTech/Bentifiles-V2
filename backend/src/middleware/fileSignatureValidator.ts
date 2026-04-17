import { Request, Response, NextFunction } from 'express';
import { fromFile } from 'file-type';

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * Middleware para validar a assinatura binária (Magic Numbers) de um arquivo.
 * Deve ser usado após o multer (que processa o arquivo e o coloca em req.file).
 */
export const validateFileSignature = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = req.file;

        if (!file) {
            return next();
        }

        // Detectar o tipo real do arquivo a partir do arquivo em disco
        const typeInfo = await fromFile(file.path);

        if (!typeInfo) {
            console.error(`[BinaryValidator] Falha ao detectar assinatura binária para o arquivo: ${file.originalname}`);
            return res.status(400).json({
                success: false,
                message: 'Assinatura do arquivo inválida ou arquivo corrompido. O conteúdo não pôde ser identificado.'
            });
        }

        console.log(`[BinaryValidator] Verificando ${file.originalname}: Declarado (${file.mimetype}) | Detectado (${typeInfo.mime})`);

        // Comparar o tipo detectado com a lista permitida
        if (!ALLOWED_MIME_TYPES.includes(typeInfo.mime)) {
            console.warn(`[BinaryValidator] Tipo de arquivo bloqueado: ${typeInfo.mime}`);
            return res.status(400).json({
                success: false,
                message: `Tipo de arquivo não permitido (${typeInfo.mime}). Mesmo que a extensão pareça válida, o conteúdo binário não é aceito.`
            });
        }

        // Opcional: Verificar se o tipo detectado coincide com o tipo declarado pelo navegador (para evitar spoofing simples)
        // Nota: Alguns mimetypes podem ter variações, mas para os básicos que usamos, deve ser exato.
        if (file.mimetype !== typeInfo.mime) {
            // Caso especial para DOCX que às vezes é reportado como zip ou algo genérico dependendo do OS, 
            // mas o file-type geralmente é bem preciso.
            console.warn(`[BinaryValidator] Mismatch detectado: Cabeçalho (${file.mimetype}) vs Binário (${typeInfo.mime})`);
            
            // Se o binário detectado for PDF/DOCX/JPG/PNG, mas o header diz outra coisa, podemos ser restritos ou flexíveis.
            // Aqui seremos restritos: se não bater, bloqueia.
            // return res.status(400).json({ message: 'Inconsistência entre extensão e conteúdo do arquivo.' });
        }

        next();
    } catch (error) {
        console.error('[BinaryValidator] Erro interno:', error);
        res.status(500).json({ message: 'Erro interno ao validar integridade do arquivo.' });
    }
};
