import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/authClient';

export type SystemRole = 'USER' | 'SUPPORT' | 'SUPER_ADMIN';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  systemRole: SystemRole;
  subscriptionPlan?: 'NONE' | 'INDIVIDUAL' | 'OFFICE' | 'ENTERPRISE';
  subscriptionStatus?: 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'UNPAID';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
}

export interface ListAdminUsersResponse {
  items: AdminUserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const listAdminUsers = async (
  params: {
    q?: string;
    role?: SystemRole | 'ALL';
    page?: number;
    pageSize?: number;
  },
  token?: string | null
) => {
  const res = await api.get<ListAdminUsersResponse>('/api/admin/users', {
    params,
    headers: getAuthHeaders(token),
  });
  return res.data;
};

export const updateAdminUserSystemRole = async (id: string, systemRole: SystemRole, token?: string | null) => {
  const res = await api.patch<{ user: AdminUserRow }>(
    `/api/admin/users/${id}/system-role`,
    { systemRole },
    { headers: getAuthHeaders(token) }
  );
  return res.data.user;
};

export const updateAdminUserSubscription = async (
  id: string,
  body: {
    plan: 'NONE' | 'INDIVIDUAL' | 'OFFICE' | 'ENTERPRISE';
    status: 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'UNPAID';
    billingInterval?: string | null;
    totalSeats?: number;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
    cancelAtPeriodEnd?: boolean;
  },
  token?: string | null
) => {
  const res = await api.patch<{ user: AdminUserRow }>(`/api/admin/users/${id}/subscription`, body, {
    headers: getAuthHeaders(token),
  });
  return res.data.user;
};

export const getAdminUserDetails = async (id: string, token?: string | null) => {
  const res = await api.get(`/api/admin/users/${id}`, { headers: getAuthHeaders(token) });
  return res.data;
};
