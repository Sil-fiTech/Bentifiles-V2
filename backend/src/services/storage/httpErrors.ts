import type { StorageProvider } from '@prisma/client';

import { StorageError } from './types';

export const storageErrorToHttp = (
    error: unknown,
    storageProvider?: StorageProvider,
): { status: number; message: string } | null => {
    if (!(error instanceof StorageError)) return null;

    switch (error.code) {
        case 'PURGED':
            return { status: 410, message: 'Arquivo expirado: o projeto foi arquivado há mais de 7 dias.' };
        case 'NOT_FOUND':
            if (storageProvider === 'GDRIVE') return { status: 410, message: 'Arquivo removido do Google Drive' };
            return { status: 404, message: 'Arquivo não encontrado' };
        case 'DISCONNECTED':
        case 'AUTH_REVOKED':
            return { status: 409, message: 'Arquivo disponível no Google Drive. Reconecte o Drive para abrir pelo BentiFiles.' };
        default:
            return { status: 503, message: 'Armazenamento indisponível no momento. Tente novamente.' };
    }
};
