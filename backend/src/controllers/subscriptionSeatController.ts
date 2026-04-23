import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  acceptOfficeInviteForUser,
  createOfficeInvite,
  getOfficeSubscriptionManagement,
  listOfficeInvites,
  removeOfficeMember,
  revokeOfficeInvite,
} from '../services/officeSubscriptionService';

export const getOfficeSubscriptionManagementData = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Nao autorizado' });
    }

    const management = await getOfficeSubscriptionManagement(userId);
    if (!management) {
      return res.status(404).json({ message: 'Assinatura OFFICE nao encontrada' });
    }

    res.json(management);
  } catch (error: any) {
    console.error('[OfficeSubscription] management error:', error);
    res.status(500).json({ message: error.message || 'Erro ao carregar assinatura OFFICE' });
  }
};

export const createInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const email = typeof req.body.email === 'string' ? req.body.email : '';

    if (!userId) {
      return res.status(401).json({ message: 'Nao autorizado' });
    }

    const invite = await createOfficeInvite(userId, email);
    res.status(201).json({ invite });
  } catch (error: any) {
    console.error('[OfficeSubscription] create invite error:', error);
    res.status(400).json({ message: error.message || 'Nao foi possivel criar o convite' });
  }
};

export const getInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Nao autorizado' });
    }

    const invites = await listOfficeInvites(userId);
    res.json(invites);
  } catch (error: any) {
    console.error('[OfficeSubscription] list invites error:', error);
    res.status(400).json({ message: error.message || 'Nao foi possivel listar os convites' });
  }
};

export const acceptInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const token = typeof req.body.token === 'string' ? req.body.token : '';

    if (!userId) {
      return res.status(401).json({ message: 'Nao autorizado' });
    }

    if (!token) {
      return res.status(400).json({ message: 'Token do convite e obrigatorio' });
    }

    const result = await acceptOfficeInviteForUser(token, userId);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.json(result);
  } catch (error: any) {
    console.error('[OfficeSubscription] accept invite error:', error);
    res.status(500).json({ message: error.message || 'Nao foi possivel aceitar o convite' });
  }
};

export const revokeInvite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const inviteId = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ message: 'Nao autorizado' });
    }

    const invite = await revokeOfficeInvite(userId, inviteId);
    res.json({ invite });
  } catch (error: any) {
    console.error('[OfficeSubscription] revoke invite error:', error);
    res.status(400).json({ message: error.message || 'Nao foi possivel revogar o convite' });
  }
};

export const deleteMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const memberId = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ message: 'Nao autorizado' });
    }

    const member = await removeOfficeMember(userId, memberId);
    res.json({ member });
  } catch (error: any) {
    console.error('[OfficeSubscription] remove member error:', error);
    res.status(400).json({ message: error.message || 'Nao foi possivel remover o membro' });
  }
};
