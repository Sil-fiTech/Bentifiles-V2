import { NextFunction, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from './auth';

export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Nao autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, systemRole: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Nao autenticado' });
    }

    if (user.systemRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

