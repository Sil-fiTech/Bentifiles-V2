import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../prisma';
import { computeSystemAccess, getAccessRedirect } from '../services/accessService';

/**
 * Middleware: requireProductAccess
 * 
 * Assumes the user is already authenticated (req.user is set).
 * Checks if the user has a valid subscription or trial access.
 */
export const requireProductAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // Determine current access status
    const hasAccess = computeSystemAccess(user);
    const redirectTo = getAccessRedirect({ ...user, hasSystemAccess: hasAccess });

    if (!hasAccess) {
      // If no access, determine why and return semantic error
      if (!user.hasSelectedPlan) {
        return res.status(403).json({
          error: 'PLAN_REQUIRED',
          message: 'Você precisa escolher um plano para acessar o Bentifiles.',
          redirectTo: redirectTo || '/plans'
        });
      } else {
        return res.status(403).json({
          error: 'SUBSCRIPTION_INACTIVE',
          message: 'Sua assinatura não está ativa no momento.',
          redirectTo: redirectTo || '/plans'
        });
      }
    }

    // In sync with DB? If not, update it
    if (user.hasSystemAccess !== hasAccess) {
      await prisma.user.update({
        where: { id: userId },
        data: { hasSystemAccess: hasAccess }
      });
    }

    next();
  } catch (error) {
    console.error('[Middleware] Product access check failed:', error);
    res.status(500).json({ message: 'Erro interno na verificação de acesso' });
  }
};
