import { Affiliate, Prisma } from '@prisma/client';
import { stripe, mapStripeStatus } from '../lib/stripe';
import prisma from '../prisma';
import { logError, logInfo } from '../utils/logger';

const AFFILIATE_DISCOUNT_PERCENT = 10;
const AFFILIATE_DISCOUNT_DURATION_MONTHS = 2;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type ReferralList = 'link' | 'trial' | 'paying';

let cachedCouponId: string | null = null;

const getFrontendUrl = () => {
  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (!/^https?:\/\//i.test(frontendUrl)) {
    const scheme = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(frontendUrl) ? 'http' : 'https';
    frontendUrl = `${scheme}://${frontendUrl}`;
  }
  return frontendUrl.replace(/\/$/, '');
};

export const normalizeAffiliateCode = (value?: string | null) =>
  (value || '').trim().toUpperCase();

export const getConfiguredAffiliateCouponId = (): string | null =>
  process.env.STRIPE_AFFILIATE_COUPON_ID || cachedCouponId;

/**
 * Returns the shared Stripe coupon id used by every affiliate promotion code.
 * If STRIPE_AFFILIATE_COUPON_ID is not set, creates the coupon once per process
 * and logs the id the operator should persist to the environment.
 */
export const ensureAffiliateCoupon = async (): Promise<string> => {
  const configured = getConfiguredAffiliateCouponId();
  if (configured) return configured;

  const coupon = await stripe.coupons.create({
    percent_off: AFFILIATE_DISCOUNT_PERCENT,
    duration: 'repeating',
    duration_in_months: AFFILIATE_DISCOUNT_DURATION_MONTHS,
    name: `Afiliado BentiFiles ${AFFILIATE_DISCOUNT_PERCENT}%`,
    metadata: { purpose: 'affiliate-shared-coupon' },
  });

  cachedCouponId = coupon.id;
  logInfo(
    `[Affiliate] Shared coupon created (${coupon.id}). ` +
      `Persist STRIPE_AFFILIATE_COUPON_ID=${coupon.id} to the environment to reuse it across restarts.`,
  );
  return coupon.id;
};

const randomSuffix = (length: number) => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
};

export const generateAffiliateCode = (name?: string | null) => {
  const firstToken = (name || 'AFF')
    .normalize('NFD')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 10);
  const base = firstToken || 'AFF';
  return `${base}-${randomSuffix(4)}`;
};

const pickUniqueCode = async (name?: string | null) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateAffiliateCode(name);
    const clash = await prisma.affiliate.findUnique({ where: { code } });
    if (!clash) return code;
  }
  throw new Error('Nao foi possivel gerar um codigo de afiliado unico');
};

const isDuplicateCodeError = (error: any) =>
  error?.type === 'StripeInvalidRequestError' &&
  typeof error?.message === 'string' &&
  /already exists|code.*taken/i.test(error.message);

/**
 * Idempotently turns a user into an affiliate: creates the Affiliate row plus a
 * dedicated Stripe promotion code pointing at the shared coupon.
 */
export const enrollAffiliate = async (userId: string): Promise<Affiliate> => {
  const existing = await prisma.affiliate.findUnique({ where: { userId } });
  if (existing) return existing;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuario nao encontrado');

  const couponId = await ensureAffiliateCoupon();

  let code = await pickUniqueCode(user.name);
  let promotionCodeId: string | null = null;

  for (let attempt = 0; attempt < 5 && !promotionCodeId; attempt += 1) {
    try {
      const promo = await stripe.promotionCodes.create({
        promotion: { type: 'coupon', coupon: couponId },
        code,
        metadata: { userId },
      });
      promotionCodeId = promo.id;
    } catch (error) {
      if (isDuplicateCodeError(error)) {
        code = await pickUniqueCode(user.name);
        continue;
      }
      throw error;
    }
  }

  if (!promotionCodeId) {
    throw new Error('Nao foi possivel criar o codigo promocional na Stripe');
  }

  let affiliate: Affiliate;
  try {
    affiliate = await prisma.affiliate.create({
      data: {
        userId,
        code,
        stripeCouponId: couponId,
        stripePromotionCodeId: promotionCodeId,
        discountPercent: AFFILIATE_DISCOUNT_PERCENT,
        discountDurationMonths: AFFILIATE_DISCOUNT_DURATION_MONTHS,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Concurrent enroll for the same user won the race.
      const raced = await prisma.affiliate.findUnique({ where: { userId } });
      if (raced) {
        await stripe.promotionCodes
          .update(promotionCodeId, { active: false })
          .catch(() => undefined);
        return raced;
      }
    }
    throw error;
  }

  await stripe.promotionCodes
    .update(promotionCodeId, { metadata: { affiliateId: affiliate.id, userId } })
    .catch((error) => logError('[Affiliate] Failed to backfill promotion code metadata', error));

  logInfo('[Affiliate] Affiliate enrolled', { userId, code });
  return affiliate;
};

const referralWhereForList = (
  affiliateId: string,
  list: ReferralList,
): Prisma.AffiliateReferralWhereInput => {
  if (list === 'link') {
    return { affiliateId, viaLink: true };
  }
  if (list === 'trial') {
    return { affiliateId, couponRedeemed: true, referredUser: { subscriptionStatus: 'TRIALING' } };
  }
  return { affiliateId, couponRedeemed: true, referredUser: { subscriptionStatus: 'ACTIVE' } };
};

export const listReferrals = async (params: {
  affiliateId: string;
  list: ReferralList;
  page?: number;
  pageSize?: number;
}) => {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const where = referralWhereForList(params.affiliateId, params.list);

  const [total, rows] = await Promise.all([
    prisma.affiliateReferral.count({ where }),
    prisma.affiliateReferral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        referredUser: {
          select: {
            name: true,
            email: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
            subscriptionTrialEndsAt: true,
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.referredUser.name,
      email: row.referredUser.email,
      subscriptionStatus: row.referredUser.subscriptionStatus,
      subscriptionPlan: row.referredUser.subscriptionPlan,
      trialEndsAt: row.referredUser.subscriptionTrialEndsAt,
      viaLink: row.viaLink,
      couponRedeemed: row.couponRedeemed,
      couponRedeemedAt: row.couponRedeemedAt,
      firstPaidAt: row.firstPaidAt,
      signedUpAt: row.createdAt,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

export const getAffiliateOverview = async (userId: string) => {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) {
    return { enrolled: false as const };
  }

  const [linkSignups, couponTrialing, couponPaying] = await Promise.all([
    prisma.affiliateReferral.count({ where: { affiliateId: affiliate.id, viaLink: true } }),
    prisma.affiliateReferral.count({
      where: { affiliateId: affiliate.id, couponRedeemed: true, referredUser: { subscriptionStatus: 'TRIALING' } },
    }),
    prisma.affiliateReferral.count({
      where: { affiliateId: affiliate.id, couponRedeemed: true, referredUser: { subscriptionStatus: 'ACTIVE' } },
    }),
  ]);

  return {
    enrolled: true as const,
    code: affiliate.code,
    signupLink: `${getFrontendUrl()}/landing?ref=${encodeURIComponent(affiliate.code)}`,
    discountPercent: affiliate.discountPercent,
    discountDurationMonths: affiliate.discountDurationMonths,
    status: affiliate.status,
    stats: { linkSignups, couponTrialing, couponPaying },
  };
};

/**
 * Records that `userId` signed up through an affiliate link. First-touch:
 * an existing attribution to another affiliate is preserved.
 */
export const attributeLinkReferral = async (userId: string, ref?: string | null) => {
  const code = normalizeAffiliateCode(ref);
  if (!code) return { ok: false as const, reason: 'no_ref' };

  const affiliate = await prisma.affiliate.findUnique({ where: { code } });
  if (!affiliate) return { ok: false as const, reason: 'unknown_code' };
  if (affiliate.userId === userId) return { ok: false as const, reason: 'self_referral' };

  const samePair = await prisma.affiliateReferral.findUnique({
    where: { affiliateId_referredUserId: { affiliateId: affiliate.id, referredUserId: userId } },
  });
  if (samePair) {
    if (!samePair.viaLink) {
      await prisma.affiliateReferral.update({ where: { id: samePair.id }, data: { viaLink: true } });
    }
    return { ok: true as const };
  }

  const otherAttribution = await prisma.affiliateReferral.findFirst({ where: { referredUserId: userId } });
  if (otherAttribution) return { ok: false as const, reason: 'already_attributed' };

  await prisma.affiliateReferral.create({
    data: { affiliateId: affiliate.id, referredUserId: userId, viaLink: true },
  });
  return { ok: true as const };
};

/**
 * Called from the Stripe billing sync. Figures out which affiliate a paid/trialing
 * subscription belongs to and upserts the referral row with `couponRedeemed`.
 *
 * Resolution order:
 *  1. `subscription.metadata.affiliateId` — stamped at checkout for the link flow
 *     (rock solid, no discount parsing).
 *  2. The shared affiliate coupon on the subscription's discounts + the promotion
 *     code that carried it — covers people who typed the code manually on Stripe.
 *
 * Swallows its own errors so it never breaks billing.
 */
export const recordCouponRedemption = async (params: {
  subscription: any;
  userId: string;
}) => {
  try {
    const sub = params.subscription;
    let affiliate: Affiliate | null = null;
    let via = '';

    // 1) Metadata stamped by our own checkout (link flow).
    const metaAffiliateId = sub?.metadata?.affiliateId;
    if (metaAffiliateId) {
      affiliate = await prisma.affiliate.findUnique({ where: { id: String(metaAffiliateId) } });
      if (affiliate) via = 'metadata';
    }

    // 2) Discount / promotion-code inspection (manual code entry).
    if (!affiliate) {
      const couponId = getConfiguredAffiliateCouponId();
      if (!couponId) {
        logInfo('[Affiliate] recordCouponRedemption: STRIPE_AFFILIATE_COUPON_ID not set and no metadata', {
          subscriptionId: sub?.id,
        });
        return;
      }

      const readDiscounts = (s: any): any[] =>
        Array.isArray(s?.discounts) ? s.discounts : s?.discount ? [s.discount] : [];
      const couponIdOf = (d: any) => {
        const c = typeof d === 'object' ? d?.coupon : d;
        return typeof c === 'string' ? c : c?.id;
      };

      let discounts = readDiscounts(sub);
      let match = discounts.find((d) => couponIdOf(d) === couponId);

      if (!match) {
        try {
          const expanded = await stripe.subscriptions.retrieve(sub.id, { expand: ['discounts'] });
          discounts = readDiscounts(expanded);
          match = discounts.find((d) => couponIdOf(d) === couponId);
        } catch (error) {
          logError('[Affiliate] Failed to expand subscription discounts', error);
        }
      }

      logInfo('[Affiliate] recordCouponRedemption: discount scan', {
        subscriptionId: sub?.id,
        couponId,
        discountCount: discounts.length,
        matchedSharedCoupon: Boolean(match),
      });

      if (!match) return;

      const promotionCode: string | null =
        typeof match.promotion_code === 'string'
          ? match.promotion_code
          : match.promotion_code?.id || null;

      if (promotionCode) {
        affiliate = await prisma.affiliate.findUnique({ where: { stripePromotionCodeId: promotionCode } });
        if (!affiliate) {
          const pc = await stripe.promotionCodes.retrieve(promotionCode);
          const affiliateId = pc.metadata?.affiliateId;
          if (affiliateId) {
            affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
          }
        }
      }
      if (affiliate) via = 'discount';
    }

    if (!affiliate) {
      logInfo('[Affiliate] recordCouponRedemption: could not resolve affiliate', { subscriptionId: sub?.id });
      return;
    }
    if (affiliate.userId === params.userId) return;

    const isPaying = mapStripeStatus(params.subscription.status) === 'ACTIVE';
    logInfo('[Affiliate] recordCouponRedemption: attributing', {
      subscriptionId: sub?.id,
      affiliateCode: affiliate.code,
      via,
      isPaying,
    });
    const existing = await prisma.affiliateReferral.findUnique({
      where: { affiliateId_referredUserId: { affiliateId: affiliate.id, referredUserId: params.userId } },
    });

    if (!existing) {
      await prisma.affiliateReferral.create({
        data: {
          affiliateId: affiliate.id,
          referredUserId: params.userId,
          couponRedeemed: true,
          couponRedeemedAt: new Date(),
          stripeSubscriptionId: params.subscription.id,
          firstPaidAt: isPaying ? new Date() : null,
        },
      });
      return;
    }

    await prisma.affiliateReferral.update({
      where: { id: existing.id },
      data: {
        couponRedeemed: true,
        couponRedeemedAt: existing.couponRedeemedAt ?? new Date(),
        stripeSubscriptionId: params.subscription.id,
        firstPaidAt: existing.firstPaidAt ?? (isPaying ? new Date() : null),
      },
    });
  } catch (error) {
    logError('[Affiliate] recordCouponRedemption failed', error);
  }
};

/**
 * Resolves an affiliate from a raw ref/code, for checkout. Returns the Stripe
 * promotion code id to pre-apply and the affiliate id to stamp on the
 * subscription metadata. Null when the ref is missing, unknown, or disabled.
 */
export const resolveAffiliateForCheckout = async (
  ref?: string | null,
): Promise<{ promotionCodeId: string; affiliateId: string } | null> => {
  const code = normalizeAffiliateCode(ref);
  if (!code) return null;
  const affiliate = await prisma.affiliate.findUnique({ where: { code } });
  if (!affiliate || affiliate.status !== 'ACTIVE' || !affiliate.stripePromotionCodeId) {
    if (ref) {
      logInfo('[Affiliate] resolveAffiliateForCheckout: no usable affiliate for ref', {
        ref,
        found: Boolean(affiliate),
        status: affiliate?.status,
      });
    }
    return null;
  }
  return { promotionCodeId: affiliate.stripePromotionCodeId, affiliateId: affiliate.id };
};

export const listAffiliatesForAdmin = async (params: { page?: number; pageSize?: number; q?: string }) => {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const q = params.q?.trim();

  const where: Prisma.AffiliateWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.affiliate.count({ where }),
    prisma.affiliate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { referrals: true } },
      },
    }),
  ]);

  const withStats = await Promise.all(
    rows.map(async (row) => {
      const [linkSignups, couponTrialing, couponPaying] = await Promise.all([
        prisma.affiliateReferral.count({ where: { affiliateId: row.id, viaLink: true } }),
        prisma.affiliateReferral.count({
          where: { affiliateId: row.id, couponRedeemed: true, referredUser: { subscriptionStatus: 'TRIALING' } },
        }),
        prisma.affiliateReferral.count({
          where: { affiliateId: row.id, couponRedeemed: true, referredUser: { subscriptionStatus: 'ACTIVE' } },
        }),
      ]);
      return {
        id: row.id,
        code: row.code,
        status: row.status,
        name: row.user.name,
        email: row.user.email,
        createdAt: row.createdAt,
        stats: { linkSignups, couponTrialing, couponPaying, totalReferrals: row._count.referrals },
      };
    }),
  );

  return {
    items: withStats,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};
