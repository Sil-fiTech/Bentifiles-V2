import { User } from '@prisma/client';
import { computeSystemAccess } from './accessService';

type BillingEntitlementOverrides = {
  canCreateProject?: boolean;
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
};

export const canCreateProject = (user: User): boolean => {
  return user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'TRIALING';
};

export const canUsePremiumFeatures = (user: User): boolean => {
  return canCreateProject(user);
};

export const getBillingEntitlements = (
  user: User,
  overrides: BillingEntitlementOverrides = {}
) => {
  return {
    hasSystemAccess: computeSystemAccess(user) || Boolean(overrides.officeSeatAccess),
    canCreateProject: overrides.canCreateProject ?? canCreateProject(user),
    canManageBilling: true,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPlan: user.subscriptionPlan,
    hasSelectedPlan: user.hasSelectedPlan,
    trialEndsAt: user.subscriptionTrialEndsAt,
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    officeSeatAccess: overrides.officeSeatAccess ?? null,
  };
};
