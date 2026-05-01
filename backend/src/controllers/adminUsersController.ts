import { Request, Response } from 'express';
import { SystemRole as PrismaSystemRole } from '@prisma/client';
import prisma from '../prisma';
import { computeSystemAccess } from '../services/accessService';
import { syncOfficeSubscriptionFromBilling } from '../services/officeSubscriptionService';

const SYSTEM_ROLES = Object.values(PrismaSystemRole) as PrismaSystemRole[];
type SystemRole = PrismaSystemRole;

const SUBSCRIPTION_PLANS = ['NONE', 'INDIVIDUAL', 'OFFICE', 'ENTERPRISE'] as const;
const SUBSCRIPTION_STATUSES = ['NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID'] as const;
type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const parseOptionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const buildUserListWhere = (q?: string, systemRole?: string) => {
  const where: any = {};

  const trimmedQuery = (q || '').trim();
  if (trimmedQuery) {
    where.OR = [
      { name: { contains: trimmedQuery, mode: 'insensitive' } },
      { email: { contains: trimmedQuery, mode: 'insensitive' } },
    ];
  }

  if (systemRole && systemRole !== 'ALL') {
    where.systemRole = systemRole;
  }

  return where;
};

const toSafeUserRow = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  systemRole: user.systemRole,
  subscriptionPlan: user.subscriptionPlan,
  subscriptionStatus: user.subscriptionStatus,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  projectCount: user._count?.projects ?? 0,
});

export const listAdminUsers = async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100);
    const skip = (page - 1) * pageSize;

    const where = buildUserListWhere(q, role);

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          systemRole: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { projects: true } },
        },
      }),
    ]);

    res.json({
      items: users.map(toSafeUserRow),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateUserSystemRole = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.userId as string | undefined;
    if (!actorId) {
      return res.status(401).json({ message: 'Nao autenticado' });
    }

    const targetUserId = String(req.params.id || '').trim();
    if (!targetUserId) {
      return res.status(400).json({ message: 'Usuario invalido' });
    }

    const systemRole = (req.body?.systemRole as string | undefined) || '';
    if (!SYSTEM_ROLES.includes(systemRole as SystemRole)) {
      return res.status(400).json({ message: 'systemRole invalido' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { projects: true } },
      },
    });

    if (!target) {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    if (target.systemRole === systemRole) {
      return res.json({ user: toSafeUserRow(target) });
    }

    if (target.systemRole === 'SUPER_ADMIN' && systemRole !== 'SUPER_ADMIN') {
      const superAdminCount = await prisma.user.count({ where: { systemRole: 'SUPER_ADMIN' } });
      if (superAdminCount <= 1) {
        return res.status(400).json({ message: 'O sistema nao pode ficar sem SUPER_ADMIN' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { systemRole: systemRole as SystemRole },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { projects: true } },
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetUserId,
        action: 'USER_SYSTEM_ROLE_UPDATED',
        metadata: {
          oldSystemRole: target.systemRole,
          newSystemRole: systemRole,
        },
      },
    });

    res.json({ user: toSafeUserRow(updated) });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const getAdminUserDetails = async (req: Request, res: Response) => {
  try {
    const targetUserId = String(req.params.id || '').trim();
    if (!targetUserId) {
      return res.status(400).json({ message: 'Usuario invalido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        systemRole: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,

        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionTrialEndsAt: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelAtPeriodEnd: true,
        hasSelectedPlan: true,
        hasSystemAccess: true,

        projects: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },

        clientDocsUploaded: {
          select: {
            id: true,
            status: true,
            uploadedAt: true,
            projectId: true,
            documentTypeId: true,
            fileId: true,
          },
          orderBy: { uploadedAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            projects: true,
            clientDocsUploaded: true,
            clientDocsOwned: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        systemRole: user.systemRole,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,

        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionTrialEndsAt: user.subscriptionTrialEndsAt,
        subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
        subscriptionCancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
        hasSelectedPlan: user.hasSelectedPlan,
        hasSystemAccess: user.hasSystemAccess,

        projectCount: user._count.projects,
        projects: user.projects.map((membership) => ({
          projectId: membership.project.id,
          projectName: membership.project.name,
          projectStatus: membership.project.status,
          role: membership.role,
          joinedAt: membership.createdAt,
        })),

        documentCounts: {
          uploaded: user._count.clientDocsUploaded,
          owned: user._count.clientDocsOwned,
        },
        recentUploadedDocuments: user.clientDocsUploaded,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateUserSubscription = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.userId as string | undefined;
    if (!actorId) {
      return res.status(401).json({ message: 'Nao autenticado' });
    }

    const targetUserId = String(req.params.id || '').trim();
    if (!targetUserId) {
      return res.status(400).json({ message: 'Usuario invalido' });
    }

    const plan = String(req.body?.plan || '').trim() as SubscriptionPlan;
    const status = String(req.body?.status || '').trim() as SubscriptionStatus;
    const billingInterval = req.body?.billingInterval === null || req.body?.billingInterval === undefined
      ? null
      : String(req.body.billingInterval);
    const totalSeats = parsePositiveInt(req.body?.totalSeats, 1);
    const currentPeriodEnd = parseOptionalDate(req.body?.currentPeriodEnd);
    const trialEndsAt = parseOptionalDate(req.body?.trialEndsAt);
    const cancelAtPeriodEnd = req.body?.cancelAtPeriodEnd === undefined ? undefined : Boolean(req.body.cancelAtPeriodEnd);

    if (!SUBSCRIPTION_PLANS.includes(plan)) {
      return res.status(400).json({ message: 'plan invalido' });
    }
    if (!SUBSCRIPTION_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'status invalido' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionTrialEndsAt: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelAtPeriodEnd: true,
        hasSelectedPlan: true,
        hasSystemAccess: true,
        _count: { select: { projects: true } },
      },
    });

    if (!target) {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    await syncOfficeSubscriptionFromBilling({
      ownerId: targetUserId,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      plan: plan as any,
      status: status as any,
      billingInterval,
      totalSeats: plan === 'OFFICE' ? totalSeats : 0,
      currentPeriodEnd,
    });

    const nextTrialEndsAt = status === 'TRIALING' ? (trialEndsAt ?? target.subscriptionTrialEndsAt ?? null) : null;
    const nextHasSelectedPlan = plan !== 'NONE';

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        subscriptionPlan: plan as any,
        subscriptionStatus: status as any,
        subscriptionTrialEndsAt: nextTrialEndsAt,
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
        ...(cancelAtPeriodEnd !== undefined && { subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd }),
        hasSelectedPlan: nextHasSelectedPlan,
      },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { projects: true } },
      },
    });

    const hasAccess = computeSystemAccess({
      ...(await prisma.user.findUnique({ where: { id: targetUserId } }))!,
    } as any);

    await prisma.user.update({
      where: { id: targetUserId },
      data: { hasSystemAccess: hasAccess },
    });

    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetUserId,
        action: 'USER_SUBSCRIPTION_UPDATED',
        metadata: {
          old: {
            subscriptionPlan: target.subscriptionPlan,
            subscriptionStatus: target.subscriptionStatus,
            subscriptionTrialEndsAt: target.subscriptionTrialEndsAt,
            subscriptionCurrentPeriodEnd: target.subscriptionCurrentPeriodEnd,
            subscriptionCancelAtPeriodEnd: target.subscriptionCancelAtPeriodEnd,
            hasSelectedPlan: target.hasSelectedPlan,
            hasSystemAccess: target.hasSystemAccess,
          },
          new: {
            subscriptionPlan: plan,
            subscriptionStatus: status,
            billingInterval,
            totalSeats: plan === 'OFFICE' ? totalSeats : 0,
            subscriptionTrialEndsAt: nextTrialEndsAt,
            subscriptionCurrentPeriodEnd: currentPeriodEnd,
            cancelAtPeriodEnd: cancelAtPeriodEnd ?? target.subscriptionCancelAtPeriodEnd,
            hasSelectedPlan: nextHasSelectedPlan,
            hasSystemAccess: hasAccess,
          },
        },
      },
    });

    res.json({ user: toSafeUserRow(updated) });
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};
