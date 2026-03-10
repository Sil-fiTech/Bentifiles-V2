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
        console.log("err ==> ", err);
            return res.status(403).json({ message: 'Token inválido ou expirado' });
        }
        req.user = decoded as { userId: string };
        next();
    });
};
