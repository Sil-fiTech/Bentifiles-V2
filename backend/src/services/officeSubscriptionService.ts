import { Prisma, SubscriptionInviteStatus, SubscriptionPlan, SubscriptionSeatMemberStatus, SubscriptionSeatType, SubscriptionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import prisma from '../prisma';
import { sendOfficeSubscriptionInviteEmail } from './emailService';

const OFFICE_INVITE_TTL_HOURS = 72;
const OFFICE_ACCESS_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING'];

const isOfficeAccessActive = (status: SubscriptionStatus) => OFFICE_ACCESS_STATUSES.includes(status);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const buildInviteToken = () => randomBytes(32).toString('hex');

const getFrontendUrl = () => {
  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (!frontendUrl.startsWith('http')) {
    frontendUrl = `https://${frontendUrl}`;
  }

  return frontendUrl;
};

const buildOfficeInviteLink = (token: string) => {
  const inviteUrl = new URL('/login', getFrontendUrl());
  inviteUrl.searchParams.set('officeInvite', token);
  return inviteUrl.toString();
};

const expirePendingInvitesTx = async (tx: Prisma.TransactionClient, subscriptionId: string) => {
  await tx.subscriptionInvite.updateMany({
    where: {
      subscriptionId,
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: {
      status: 'EXPIRED',
    },
  });
};

const syncSeatCountersTx = async (tx: Prisma.TransactionClient, subscriptionId: string) => {
  const subscription = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    select: { totalSeats: true },
  });

  if (!subscription) {
    throw new Error('Assinatura nao encontrada');
  }

  const usedSeats = await tx.subscriptionSeatMember.count({
    where: {
      subscriptionId,
      status: 'ACTIVE',
    },
  });

  const availableSeats = Math.max(subscription.totalSeats - usedSeats, 0);

  await tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      usedSeats,
      availableSeats,
    },
  });

  return {
    totalSeats: subscription.totalSeats,
    usedSeats,
    availableSeats,
  };
};

const mapInviteStatus = (invite: {
  status: SubscriptionInviteStatus;
  expiresAt: Date;
}) => {
  if (invite.status === 'PENDING' && invite.expiresAt < new Date()) {
    return 'EXPIRED' as const;
  }

  return invite.status;
};

const serializeMember = (member: {
  id: string;
  userId: string;
  seatType: SubscriptionSeatType;
  status: SubscriptionSeatMemberStatus;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}) => ({
  id: member.id,
  userId: member.userId,
  seatType: member.seatType,
  status: member.status,
  createdAt: member.createdAt,
  updatedAt: member.updatedAt,
  user: member.user,
});

const serializeInvite = (invite: {
  id: string;
  email: string;
  token: string;
  status: SubscriptionInviteStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  acceptedByUser: { id: string; name: string; email: string } | null;
}) => ({
  id: invite.id,
  email: invite.email,
  token: invite.token,
  link: buildOfficeInviteLink(invite.token),
  status: mapInviteStatus(invite),
  expiresAt: invite.expiresAt,
  acceptedAt: invite.acceptedAt,
  revokedAt: invite.revokedAt,
  invitedByUserId: invite.invitedByUserId,
  acceptedByUserId: invite.acceptedByUserId,
  acceptedByUser: invite.acceptedByUser,
  createdAt: invite.createdAt,
  updatedAt: invite.updatedAt,
});

const ensureOwnerSeatTx = async (tx: Prisma.TransactionClient, subscriptionId: string, ownerId: string) => {
  await tx.subscriptionSeatMember.upsert({
    where: {
      subscriptionId_userId: {
        subscriptionId,
        userId: ownerId,
      },
    },
    create: {
      subscriptionId,
      userId: ownerId,
      seatType: 'OWNER',
      status: 'ACTIVE',
    },
    update: {
      seatType: 'OWNER',
      status: 'ACTIVE',
      invitedByUserId: null,
    },
  });
};

const deactivateNonOwnerSeatsTx = async (tx: Prisma.TransactionClient, subscriptionId: string) => {
  await tx.subscriptionSeatMember.updateMany({
    where: {
      subscriptionId,
      seatType: 'MEMBER',
      status: 'ACTIVE',
    },
    data: {
      status: 'REMOVED',
    },
  });
};

const deactivateAllSeatsTx = async (tx: Prisma.TransactionClient, subscriptionId: string) => {
  await tx.subscriptionSeatMember.updateMany({
    where: {
      subscriptionId,
      status: 'ACTIVE',
    },
    data: {
      status: 'REMOVED',
    },
  });
};

const revokePendingInvitesTx = async (tx: Prisma.TransactionClient, subscriptionId: string) => {
  await tx.subscriptionInvite.updateMany({
    where: {
      subscriptionId,
      status: 'PENDING',
    },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  });
};

const getOwnerSubscriptionBase = async (ownerId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { ownerId },
  });

  if (!subscription) {
    throw new Error('Assinatura OFFICE nao encontrada');
  }

  return subscription;
};

export const syncOfficeSubscriptionFromBilling = async (params: {
  ownerId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingInterval?: string | null;
  totalSeats: number;
  currentPeriodEnd?: Date | null;
}) => {
  await prisma.$transaction(async (tx) => {
    const totalSeats = params.plan === 'OFFICE' ? Math.max(1, params.totalSeats || 1) : 0;

    const subscription = await tx.subscription.upsert({
      where: { ownerId: params.ownerId },
      create: {
        ownerId: params.ownerId,
        stripeCustomerId: params.stripeCustomerId ?? null,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        plan: params.plan,
        status: params.status,
        billingInterval: params.billingInterval ?? null,
        totalSeats,
        usedSeats: 0,
        availableSeats: 0,
        currentPeriodEnd: params.currentPeriodEnd ?? null,
      },
      update: {
        stripeCustomerId: params.stripeCustomerId ?? null,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        plan: params.plan,
        status: params.status,
        billingInterval: params.billingInterval ?? null,
        totalSeats,
        currentPeriodEnd: params.currentPeriodEnd ?? null,
      },
    });

    await expirePendingInvitesTx(tx, subscription.id);

    if (params.plan === 'OFFICE') {
      await ensureOwnerSeatTx(tx, subscription.id, params.ownerId);

      if (!isOfficeAccessActive(params.status)) {
        await deactivateNonOwnerSeatsTx(tx, subscription.id);
        await revokePendingInvitesTx(tx, subscription.id);
      }
    } else {
      await deactivateAllSeatsTx(tx, subscription.id);
      await revokePendingInvitesTx(tx, subscription.id);
    }

    await syncSeatCountersTx(tx, subscription.id);
  });
};

export const getOfficeSeatAccessForUser = async (userId: string) => {
  const membership = await prisma.subscriptionSeatMember.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      subscription: {
        plan: 'OFFICE',
        status: { in: OFFICE_ACCESS_STATUSES },
      },
    },
    include: {
      subscription: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    subscriptionId: membership.subscriptionId,
    owner: membership.subscription.owner,
    seatType: membership.seatType,
    plan: membership.subscription.plan,
    status: membership.subscription.status,
    totalSeats: membership.subscription.totalSeats,
    usedSeats: membership.subscription.usedSeats,
    availableSeats: membership.subscription.availableSeats,
  };
};

export const canUserCreateProjects = async (userId: string, fallbackStatus: SubscriptionStatus) => {
  if (fallbackStatus === 'ACTIVE' || fallbackStatus === 'TRIALING') {
    return true;
  }

  const seatAccess = await getOfficeSeatAccessForUser(userId);
  return Boolean(seatAccess);
};

export const getOfficeSubscriptionManagement = async (ownerId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { ownerId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [
          { seatType: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      invites: {
        orderBy: { createdAt: 'desc' },
        include: {
          acceptedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!subscription || subscription.plan !== 'OFFICE') {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await expirePendingInvitesTx(tx, subscription.id);
    await syncSeatCountersTx(tx, subscription.id);
  });

  const fresh = await prisma.subscription.findUnique({
    where: { ownerId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [
          { seatType: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      invites: {
        orderBy: { createdAt: 'desc' },
        include: {
          acceptedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!fresh) {
    return null;
  }

  return {
    subscriptionId: fresh.id,
    owner: fresh.owner,
    plan: fresh.plan,
    status: fresh.status,
    billingInterval: fresh.billingInterval,
    totalSeats: fresh.totalSeats,
    usedSeats: fresh.usedSeats,
    availableSeats: fresh.availableSeats,
    currentPeriodEnd: fresh.currentPeriodEnd,
    members: fresh.members.map(serializeMember),
    invites: fresh.invites.map(serializeInvite),
  };
};

export const listOfficeInvites = async (ownerId: string) => {
  const management = await getOfficeSubscriptionManagement(ownerId);
  if (!management) {
    throw new Error('Assinatura OFFICE nao encontrada');
  }

  return {
    totalSeats: management.totalSeats,
    usedSeats: management.usedSeats,
    availableSeats: management.availableSeats,
    invites: management.invites,
  };
};

export const createOfficeInvite = async (ownerId: string, email: string) => {
  const normalizedEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('E-mail invalido');
  }

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { ownerId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!subscription || subscription.plan !== 'OFFICE' || !isOfficeAccessActive(subscription.status)) {
      throw new Error('Apenas assinaturas OFFICE ativas podem convidar membros');
    }

    await expirePendingInvitesTx(tx, subscription.id);
    const counters = await syncSeatCountersTx(tx, subscription.id);

    if (counters.availableSeats <= 0) {
      throw new Error('Nao ha licencas disponiveis para novos convites');
    }

    if (normalizedEmail === subscription.owner.email.toLowerCase()) {
      throw new Error('O proprietario da assinatura ja ocupa uma licenca');
    }

    const invitedUser = await tx.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (invitedUser) {
      const existingSeat = await tx.subscriptionSeatMember.findUnique({
        where: {
          subscriptionId_userId: {
            subscriptionId: subscription.id,
            userId: invitedUser.id,
          },
        },
      });

      if (existingSeat?.status === 'ACTIVE') {
        throw new Error('Este usuario ja ocupa uma licenca desta assinatura');
      }
    }

    const existingPendingInvite = await tx.subscriptionInvite.findFirst({
      where: {
        subscriptionId: subscription.id,
        email: normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPendingInvite) {
      throw new Error('Ja existe um convite pendente para este e-mail');
    }

    const invite = await tx.subscriptionInvite.create({
      data: {
        subscriptionId: subscription.id,
        email: normalizedEmail,
        token: buildInviteToken(),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + OFFICE_INVITE_TTL_HOURS * 60 * 60 * 1000),
        invitedByUserId: ownerId,
      },
    });

    return {
      invite,
      owner: subscription.owner,
    };
  }).then(async ({ invite, owner }) => {
    await sendOfficeSubscriptionInviteEmail({
      email: invite.email,
      inviteLink: buildOfficeInviteLink(invite.token),
      invitedByName: owner.name,
      seatsLabel: 'licenca OFFICE',
    });

    const reloaded = await prisma.subscriptionInvite.findUnique({
      where: { id: invite.id },
      include: {
        acceptedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return reloaded ? serializeInvite(reloaded) : serializeInvite({ ...invite, acceptedByUser: null });
  });
};

export const revokeOfficeInvite = async (ownerId: string, inviteId: string) => {
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { ownerId },
    });

    if (!subscription || subscription.plan !== 'OFFICE') {
      throw new Error('Assinatura OFFICE nao encontrada');
    }

    const invite = await tx.subscriptionInvite.findFirst({
      where: {
        id: inviteId,
        subscriptionId: subscription.id,
      },
      include: {
        acceptedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invite) {
      throw new Error('Convite nao encontrado');
    }

    if (invite.status === 'ACCEPTED') {
      throw new Error('Convites aceitos nao podem ser revogados');
    }

    const updated = await tx.subscriptionInvite.update({
      where: { id: invite.id },
      data: {
        status: invite.status === 'EXPIRED' ? 'EXPIRED' : 'REVOKED',
        revokedAt: new Date(),
      },
      include: {
        acceptedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return serializeInvite(updated);
  });
};

export const acceptOfficeInviteForUser = async (inviteToken: string, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.subscriptionInvite.findUnique({
      where: { token: inviteToken },
      include: {
        subscription: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!invite) {
      return { ok: false as const, status: 404, message: 'Convite de licenca nao encontrado ou invalido' };
    }

    await expirePendingInvitesTx(tx, invite.subscriptionId);

    const freshInvite = await tx.subscriptionInvite.findUnique({
      where: { id: invite.id },
      include: {
        subscription: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!freshInvite) {
      return { ok: false as const, status: 404, message: 'Convite de licenca nao encontrado ou invalido' };
    }

    if (freshInvite.status === 'REVOKED') {
      return { ok: false as const, status: 400, message: 'Este convite foi revogado' };
    }

    if (freshInvite.status === 'EXPIRED' || freshInvite.expiresAt < new Date()) {
      return { ok: false as const, status: 400, message: 'Este convite expirou' };
    }

    if (freshInvite.status === 'ACCEPTED') {
      return { ok: false as const, status: 400, message: 'Este convite ja foi utilizado' };
    }

    if (freshInvite.subscription.plan !== 'OFFICE' || !isOfficeAccessActive(freshInvite.subscription.status)) {
      return { ok: false as const, status: 400, message: 'A assinatura OFFICE vinculada ao convite nao esta ativa' };
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return { ok: false as const, status: 404, message: 'Usuario nao encontrado' };
    }

    if (normalizeEmail(user.email) !== freshInvite.email) {
      return { ok: false as const, status: 400, message: 'Este convite foi enviado para outro e-mail' };
    }

    if (user.id === freshInvite.subscription.ownerId) {
      return { ok: false as const, status: 400, message: 'O dono da assinatura ja ocupa a vaga principal' };
    }

    const counters = await syncSeatCountersTx(tx, freshInvite.subscriptionId);
    if (counters.availableSeats <= 0) {
      return { ok: false as const, status: 400, message: 'Nao ha mais vagas disponiveis nesta assinatura' };
    }

    const seat = await tx.subscriptionSeatMember.upsert({
      where: {
        subscriptionId_userId: {
          subscriptionId: freshInvite.subscriptionId,
          userId,
        },
      },
      create: {
        subscriptionId: freshInvite.subscriptionId,
        userId,
        invitedByUserId: freshInvite.invitedByUserId,
        seatType: 'MEMBER',
        status: 'ACTIVE',
      },
      update: {
        invitedByUserId: freshInvite.invitedByUserId,
        seatType: 'MEMBER',
        status: 'ACTIVE',
      },
    });

    await tx.subscriptionInvite.update({
      where: { id: freshInvite.id },
      data: {
        status: 'ACCEPTED',
        acceptedByUserId: userId,
        acceptedAt: new Date(),
      },
    });

    await syncSeatCountersTx(tx, freshInvite.subscriptionId);

    return {
      ok: true as const,
      memberId: seat.id,
      owner: freshInvite.subscription.owner,
      message: 'Licenca OFFICE ativada com sucesso',
    };
  });
};

export const removeOfficeMember = async (ownerId: string, memberId: string) => {
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { ownerId },
    });

    if (!subscription || subscription.plan !== 'OFFICE') {
      throw new Error('Assinatura OFFICE nao encontrada');
    }

    const member = await tx.subscriptionSeatMember.findFirst({
      where: {
        id: memberId,
        subscriptionId: subscription.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!member) {
      throw new Error('Membro nao encontrado');
    }

    if (member.seatType === 'OWNER') {
      throw new Error('O proprietario da assinatura nao pode ser removido');
    }

    const updated = await tx.subscriptionSeatMember.update({
      where: { id: member.id },
      data: {
        status: 'REMOVED',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await syncSeatCountersTx(tx, subscription.id);

    return serializeMember(updated);
  });
};
