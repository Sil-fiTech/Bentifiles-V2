import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
    };
    projectId?: string;
    projectRole?: 'ADMIN' | 'USER';
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    console.log(`[Auth] Verifying token for request to ${req.path}`);
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }

    if (!process.env.JWT_SECRET) {
        console.error('CRITICAL: JWT_SECRET is not defined in environment variables');
        return res.status(500).json({ message: 'Erro interno do servidor (Configuração de Segurança Ausente)' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log("[Auth] Token verification failed:", err.message);
            return res.status(403).json({ message: 'Token inválido ou expirado' });
        }
        console.log(`[Auth] User authenticated: ${decoded && typeof decoded === 'object' ? (decoded as any).userId : 'unknown'}`);
        req.user = decoded as { userId: string };
        next();
    });
};
