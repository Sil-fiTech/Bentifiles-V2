import axios from 'axios';

export interface AccessStatus {
  authenticated: boolean;
  canCreateProject: boolean;
  canManageBilling: boolean;
  subscriptionStatus: string;
  subscriptionPlan: string;
  hasSelectedPlan: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasSystemAccess?: boolean; // Keep for compatibility if needed
  redirectTo?: string | null; // Keep for compatibility if needed
  token: string | null;
}

/**
 * Fetch current user access status from backend
 */
export const getAccessStatus = async (providedToken?: string): Promise<AccessStatus | null> => {
  try {
    const token = providedToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) return null;

    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/access-status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return { ...response.data, token };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.warn('Unauthorized access status check - token might be invalid');
    } else {
        console.error('Error fetching access status:', error);
    }
    return null;
  }
};
