import api from '../api';

export interface AccessStatus {
  authenticated: boolean;
  canCreateProject: boolean;
  canManageBilling: boolean;
  subscriptionStatus: string;
  subscriptionPlan: string;
  hasSelectedPlan: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  officeSeatAccess?: {
    subscriptionId: string;
    owner: {
      id: string;
      name: string;
      email: string;
    };
    seatType: string;
    plan: string;
    status: string;
    totalSeats: number;
    usedSeats: number;
    availableSeats: number;
  } | null;
  hasSystemAccess?: boolean; // Keep for compatibility if needed
  redirectTo?: string | null; // Keep for compatibility if needed
  token: string | null;
}

/**
 * Fetch current user access status from backend
 */
export const getAccessStatus = async (providedToken?: string): Promise<AccessStatus | null> => {
  try {
    const token = providedToken || null;
    const response = await api.get('/api/billing/access-status', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return { ...response.data, token };
  } catch (error) {
    if ((error as any)?.response?.status === 401) {
        console.warn('Unauthorized access status check - token might be invalid');
    } else {
        console.error('Error fetching access status:', error);
    }
    return null;
  }
};
