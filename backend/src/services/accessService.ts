import { User } from '@prisma/client';

/**
 * computeSystemAccess(user)
 * 
 * Rules:
 * - return true if subscriptionStatus is ACTIVE
 * - return true if subscriptionStatus is TRIALING and subscriptionTrialEndsAt has not expired
 * - return false in any other case
 */
export const computeSystemAccess = (user: User): boolean => {
  if (user.subscriptionStatus === 'ACTIVE') {
    return true;
  }

  if (user.subscriptionStatus === 'TRIALING' && user.subscriptionTrialEndsAt) {
    return user.subscriptionTrialEndsAt.getTime() > Date.now();
  }

  return false;
};

/**
 * getAccessRedirect(user)
 * 
 * Rules:
 * - Everyone is allowed into the dashboard now.
 * - Redirects are specialized for premium feature triggers instead of global gates.
 */
export const getAccessRedirect = (user: User): string | null => {
  if (!computeSystemAccess(user)) {
    return '/plans';
  }

  return null;
};
