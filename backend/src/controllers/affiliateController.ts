import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma';
import { logError } from '../utils/logger';
import {
  attributeLinkReferral,
  enrollAffiliate,
  getAffiliateOverview,
  listAffiliatesForAdmin,
  listReferrals,
} from '../services/affiliateService';

const REFERRAL_LISTS = ['link', 'trial', 'paying'] as const;
type ReferralList = (typeof REFERRAL_LISTS)[number];

const parseList = (value: unknown): ReferralList | null =>
  REFERRAL_LISTS.includes(value as ReferralList) ? (value as ReferralList) : null;

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Nao autorizado' });
    res.json(await getAffiliateOverview(userId));
  } catch (error: any) {
    logError('[Affiliate] getMe failed', error);
    res.status(500).json({ message: error.message || 'Erro ao carregar perfil de afiliado' });
  }
};

export const enroll = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Nao autorizado' });
    await enrollAffiliate(userId);
    res.status(201).json(await getAffiliateOverview(userId));
  } catch (error: any) {
    logError('[Affiliate] enroll failed', error);
    res.status(500).json({ message: error.message || 'Erro ao criar perfil de afiliado' });
  }
};

export const listMyReferrals = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Nao autorizado' });

    const list = parseList(req.query.list);
    if (!list) return res.status(400).json({ message: 'Parametro "list" invalido' });

    const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
    if (!affiliate) return res.status(409).json({ message: 'Usuario ainda nao e afiliado' });

    res.json(
      await listReferrals({
        affiliateId: affiliate.id,
        list,
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 20,
      }),
    );
  } catch (error: any) {
    logError('[Affiliate] listMyReferrals failed', error);
    res.status(500).json({ message: error.message || 'Erro ao carregar indicacoes' });
  }
};

export const track = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Nao autorizado' });
    const result = await attributeLinkReferral(userId, req.body?.ref);
    res.json(result);
  } catch (error: any) {
    logError('[Affiliate] track failed', error);
    res.status(500).json({ message: error.message || 'Erro ao registrar indicacao' });
  }
};

export const adminList = async (req: AuthRequest, res: Response) => {
  try {
    res.json(
      await listAffiliatesForAdmin({
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 20,
        ...(typeof req.query.q === 'string' && req.query.q ? { q: req.query.q } : {}),
      }),
    );
  } catch (error: any) {
    logError('[Affiliate] adminList failed', error);
    res.status(500).json({ message: error.message || 'Erro ao listar afiliados' });
  }
};

export const adminListReferrals = async (req: AuthRequest, res: Response) => {
  try {
    const list = parseList(req.query.list);
    if (!list) return res.status(400).json({ message: 'Parametro "list" invalido' });

    const affiliate = await prisma.affiliate.findUnique({ where: { id: String(req.params.id) } });
    if (!affiliate) return res.status(404).json({ message: 'Afiliado nao encontrado' });

    res.json(
      await listReferrals({
        affiliateId: affiliate.id,
        list,
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 20,
      }),
    );
  } catch (error: any) {
    logError('[Affiliate] adminListReferrals failed', error);
    res.status(500).json({ message: error.message || 'Erro ao carregar indicacoes' });
  }
};
