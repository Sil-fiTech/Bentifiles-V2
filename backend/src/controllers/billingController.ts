import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as billingService from '../services/billingService';
import { stripe } from '../lib/stripe';
import prisma from '../prisma';

export const createCheckoutSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { plan, interval = 'monthly', quantity = 1 } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    if (!['INDIVIDUAL', 'OFFICE', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({ message: 'Plano inválido' });
    }

    if (!['monthly', 'yearly'].includes(interval)) {
      return res.status(400).json({ message: 'Intervalo inválido' });
    }

    const url = await billingService.createCheckoutSession(userId, plan, interval, Math.max(1, Number(quantity)));
    res.json({ url });
  } catch (error: any) {
    console.error('[Billing] Checkout error:', error);
    res.status(500).json({ message: error.message || 'Erro ao criar sessão de checkout' });
  }
};

export const getAccessStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const status = await billingService.getUserAccessStatus(userId);
    res.json(status);
  } catch (error: any) {
    console.error('[Billing] Access status error:', error);
    res.status(500).json({ message: error.message || 'Erro ao buscar status de acesso' });
  }
};

export const createPortalSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ message: 'Sessão de cobrança não encontrada para este usuário' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:3000/profile',
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('[Billing] Portal session error:', error);
    res.status(500).json({ message: error.message || 'Erro ao criar sessão do portal' });
  }
};
export const syncSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    await billingService.syncUserSubscriptionFromStripe({ userId });
    
    // Fetch updated status
    const status = await billingService.getUserAccessStatus(userId);
    res.json(status);
  } catch (error: any) {
    console.error('Manual sync error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getSubscriptionDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Não autorizado' });

    const subscriptionData = await billingService.getSubscriptionDetails(userId);
    res.json(subscriptionData);
  } catch (error: any) {
    console.error('[Billing] Get subscription error:', error);
    res.status(500).json({ message: error.message || 'Erro ao buscar detalhes da assinatura' });
  }
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });
    
        await billingService.cancelUserSubscription(userId);
        res.json({ success: true, message: 'Assinatura agendada para cancelamento' });
      } catch (error: any) {
        console.error('[Billing] Cancel subscription error:', error);
        res.status(500).json({ message: error.message || 'Erro ao cancelar assinatura' });
      }
};

export const reactivateSubscription = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: 'Não autorizado' });
    
        await billingService.reactivateUserSubscription(userId);
        res.json({ success: true, message: 'Assinatura reativada' });
      } catch (error: any) {
        console.error('[Billing] Reactivate subscription error:', error);
        res.status(500).json({ message: error.message || 'Erro ao reativar assinatura' });
      }
};
