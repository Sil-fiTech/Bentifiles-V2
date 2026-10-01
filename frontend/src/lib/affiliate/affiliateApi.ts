import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/authClient';

export type ReferralList = 'link' | 'trial' | 'paying';

export type SubscriptionStatus =
  | 'NONE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'INCOMPLETE'
  | 'UNPAID';

export interface AffiliateStats {
  linkSignups: number;
  couponTrialing: number;
  couponPaying: number;
}

export interface AffiliateOverview {
  enrolled: boolean;
  code?: string;
  signupLink?: string;
  discountPercent?: number;
  discountDurationMonths?: number;
  status?: 'ACTIVE' | 'DISABLED';
  stats?: AffiliateStats;
}

export interface ReferralRow {
  id: string;
  name: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: string;
  trialEndsAt: string | null;
  viaLink: boolean;
  couponRedeemed: boolean;
  couponRedeemedAt: string | null;
  firstPaidAt: string | null;
  signedUpAt: string;
}

export interface ReferralPage {
  items: ReferralRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminAffiliateRow {
  id: string;
  code: string;
  status: 'ACTIVE' | 'DISABLED';
  name: string;
  email: string;
  createdAt: string;
  stats: AffiliateStats & { totalReferrals: number };
}

export interface AdminAffiliatePage {
  items: AdminAffiliateRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const getAffiliateMe = async (token?: string | null) => {
  const res = await api.get<AffiliateOverview>('/api/affiliate/me', { headers: getAuthHeaders(token) });
  return res.data;
};

export const enrollAffiliate = async (token?: string | null) => {
  const res = await api.post<AffiliateOverview>('/api/affiliate/enroll', {}, { headers: getAuthHeaders(token) });
  return res.data;
};

export const listMyReferrals = async (
  params: { list: ReferralList; page?: number; pageSize?: number },
  token?: string | null,
) => {
  const res = await api.get<ReferralPage>('/api/affiliate/me/referrals', {
    params,
    headers: getAuthHeaders(token),
  });
  return res.data;
};

export const trackAffiliateRef = async (ref: string, token?: string | null) => {
  const res = await api.post<{ ok: boolean; reason?: string }>(
    '/api/affiliate/track',
    { ref },
    { headers: getAuthHeaders(token) },
  );
  return res.data;
};

export const PENDING_AFFILIATE_REF_KEY = 'pendingAffiliateRef';

// Rejections where keeping the ref around for checkout would be pointless.
const DISCARD_TRACK_REASONS = new Set(['self_referral', 'unknown_code', 'no_ref']);

const safeGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
};

/**
 * Sends any stored `?ref` to the backend once the visitor is authenticated.
 * The backend `track` endpoint is idempotent (first-touch), so calling this on
 * every post-auth code path (login, e-mail verification, Google session) is
 * safe. The ref is KEPT in storage on success so the checkout call can still
 * pre-apply the affiliate's coupon; it's dropped only when it can never match.
 */
export const flushPendingAffiliateRef = async (token?: string | null) => {
  if (typeof window === 'undefined') return;

  const ref = safeGet(PENDING_AFFILIATE_REF_KEY);
  if (!ref) return;

  try {
    const result = await trackAffiliateRef(ref, token);
    if (result.reason && DISCARD_TRACK_REASONS.has(result.reason)) {
      safeRemove(PENDING_AFFILIATE_REF_KEY);
    }
  } catch {
    /* transient failure — a later call will retry */
  }
};

export const listAdminAffiliates = async (
  params: { page?: number; pageSize?: number; q?: string },
  token?: string | null,
) => {
  const res = await api.get<AdminAffiliatePage>('/api/affiliate/admin', {
    params,
    headers: getAuthHeaders(token),
  });
  return res.data;
};

export const listAdminAffiliateReferrals = async (
  id: string,
  params: { list: ReferralList; page?: number; pageSize?: number },
  token?: string | null,
) => {
  const res = await api.get<ReferralPage>(`/api/affiliate/admin/${id}/referrals`, {
    params,
    headers: getAuthHeaders(token),
  });
  return res.data;
};
