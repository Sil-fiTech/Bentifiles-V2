import Stripe from 'stripe';
import { syncUserSubscriptionFromStripe, markUserSubscriptionCanceled } from './billingService';
import prisma from '../prisma';

/**
 * handleStripeWebhook(event)
 */
export const handleStripeWebhook = async (event: any) => {
  console.log(`[Webhook] Processing event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as any);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as any);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as any);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as any);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as any);
      break;

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }
};

/**
 * Handlers
 */

const handleCheckoutSessionCompleted = async (session: any) => {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('[Webhook] checkout.session.completed: Missing userId in metadata');
    return;
  }

  console.log(`[Webhook] Checkout completed for user ${userId}, plan ${plan}`);

  // Mark user as having selected a plan
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      hasSelectedPlan: true,
    },
  });

  // Sync subscription data
  await syncUserSubscriptionFromStripe({ stripeSubscriptionId: subscriptionId });
};

const handleSubscriptionUpdated = async (subscription: any) => {
  console.log(`[Webhook] Subscription updated: ${subscription.id}`);
  await syncUserSubscriptionFromStripe({ stripeSubscriptionId: subscription.id });
};

const handleInvoicePaymentSucceeded = async (invoice: any) => {
  if (!invoice.subscription) return;
  console.log(`[Webhook] Invoice payment succeeded: ${invoice.id}`);
  
  await syncUserSubscriptionFromStripe({ 
    stripeSubscriptionId: invoice.subscription as string 
  });
};

const handleInvoicePaymentFailed = async (invoice: any) => {
  if (!invoice.subscription) return;
  console.log(`[Webhook] Invoice payment failed: ${invoice.id}`);

  // Sync will recalculate system access (which might block the user)
  await syncUserSubscriptionFromStripe({ 
    stripeSubscriptionId: invoice.subscription as string 
  });
};

const handleSubscriptionDeleted = async (subscription: any) => {
  console.log(`[Webhook] Subscription deleted: ${subscription.id}`);

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (user) {
    await markUserSubscriptionCanceled(user.id);
  }
};
