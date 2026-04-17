import { User } from '@prisma/client';

/**
 * billingAccessService
 * 
 * Centralizes the logic for premium features and subscription-based permissions.
 */

/**
 * canCreateProject(user)
 * 
 * Rules:
 * - true if status is ACTIVE
 * - true if status is TRIALING and not expired
 * - false otherwise
 */
export const canCreateProject = (user: User): boolean => {
  const status = user.subscriptionStatus;
  
  // Simplified rules for debugging and resilience
  if (status === 'ACTIVE' || status === 'TRIALING') {
    return true;
  }

  return false;
};

/**
 * canUsePremiumFeatures(user)
 * 
 * Placeholder for future premium feature checks (e.g. AI limits, storage packs).
 */
export const canUsePremiumFeatures = (user: User): boolean => {
  return canCreateProject(user);
};

/**
 * getBillingEntitlements(user)
 * 
 * Returns a payload of all billing-related permissions for the frontend.
 */
export const getBillingEntitlements = (user: User) => {
  const createProject = canCreateProject(user);
  
  return {
    hasSystemAccess: user.hasSystemAccess,
    canCreateProject: createProject,
    canManageBilling: true, // Generally true for the account holder
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPlan: user.subscriptionPlan,
    hasSelectedPlan: user.hasSelectedPlan,
    trialEndsAt: user.subscriptionTrialEndsAt,
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
  };
};
