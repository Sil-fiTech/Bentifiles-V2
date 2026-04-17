import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../prisma';
import { canCreateProject } from '../services/billingAccessService';

/**
 * Middleware: requireActiveSubscription
 * 
 * Protects premium routes (e.g. project creation).
 * Assumes user is already authenticated (req.user is set).
 */
export const requireActiveSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (!canCreateProject(user)) {
      return res.status(403).json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Você precisa de um plano ativo ou em período de teste para criar projetos.',
        redirectTo: '/plans'
      });
    }

    next();
  } catch (error) {
    console.error('[Middleware] Premium access check failed:', error);
    res.status(500).json({ message: 'Erro interno na verificação de assinatura' });
  }
};
