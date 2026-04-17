import Stripe from 'stripe';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be defined in environment variables');
}

/**
 * Configure Stripe instance
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia' as any,
  typescript: true,
});

/**
 * Maps Stripe Price IDs (from .env) to internal SubscriptionPlan enum
 */
export const getPlanFromPriceId = (priceId?: string | null): SubscriptionPlan => {
  if (!priceId) return SubscriptionPlan.NONE;

  // Monthly Prices
  if (priceId === process.env.STRIPE_PRICE_INDIVIDUAL) return SubscriptionPlan.INDIVIDUAL;
  if (priceId === process.env.STRIPE_PRICE_OFFICE) return SubscriptionPlan.OFFICE;
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return SubscriptionPlan.ENTERPRISE;

  // Yearly Prices
  if (priceId === process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY) return SubscriptionPlan.INDIVIDUAL;
  if (priceId === process.env.STRIPE_PRICE_OFFICE_YEARLY) return SubscriptionPlan.OFFICE;
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE_YEARLY) return SubscriptionPlan.ENTERPRISE;

  return SubscriptionPlan.NONE;
};

/**
 * Maps Stripe subscription status to internal SubscriptionStatus enum
 */
export const mapStripeStatus = (status: string): SubscriptionStatus => {
  switch (status) {
    case 'trialing': return SubscriptionStatus.TRIALING;
    case 'active': return SubscriptionStatus.ACTIVE;
    case 'past_due': return SubscriptionStatus.PAST_DUE;
    case 'canceled': return SubscriptionStatus.CANCELED;
    case 'unpaid': return SubscriptionStatus.UNPAID;
    case 'incomplete': return SubscriptionStatus.INCOMPLETE;
    default: return SubscriptionStatus.NONE;
  }
};

/**
 * Converts Stripe Unix timestamp to Javascript Date
 */
export const fromStripeUnixTimestamp = (timestamp?: number | null): Date | null => {
  if (!timestamp) return null;
  return new Date(timestamp * 1000);
};
