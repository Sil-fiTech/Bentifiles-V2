import prisma from '../prisma';
import { stripe, getPlanFromPriceId, mapStripeStatus, fromStripeUnixTimestamp } from '../lib/stripe';
import Stripe from 'stripe';
import { computeSystemAccess, getAccessRedirect } from './accessService';
import { SubscriptionPlan } from '@prisma/client';
import { getBillingEntitlements } from './billingAccessService';

/**
 * createCheckoutSession(userId, plan)
 */
export const createCheckoutSession = async (


  userId: string,
  plan: SubscriptionPlan,
  interval: 'monthly' | 'yearly' = 'monthly',
  quantity: number = 1
) => {
  console.log("Aqui");
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Map local plan to Stripe Price ID based on interval
  let priceId: string | undefined;
  console.log(priceId)


  if (interval === 'yearly') {
    switch (plan) {
      case 'INDIVIDUAL': priceId = process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY; break;
      case 'OFFICE': priceId = process.env.STRIPE_PRICE_OFFICE_YEARLY; break;
      case 'ENTERPRISE': priceId = process.env.STRIPE_PRICE_ENTERPRISE_YEARLY; break;
    }
  } else {
    switch (plan) {
      case 'INDIVIDUAL': priceId = process.env.STRIPE_PRICE_INDIVIDUAL; break;
      case 'OFFICE': priceId = process.env.STRIPE_PRICE_OFFICE; break;
      case 'ENTERPRISE': priceId = process.env.STRIPE_PRICE_ENTERPRISE; break;
    }
  }

  if (!priceId) {
    throw new Error('Plano inválido ou ID de preço não configurado');
  }

  // Create or reuse stripeCustomerId
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity }],
    subscription_data: {
      trial_period_days: 10,
      metadata: { userId, plan },
    },
    success_url: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/billing/success',
    cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/billing/cancel',
    metadata: { userId, plan },
  });

  return session.url;
};

/**
 * syncUserSubscriptionFromStripe(params)
 */
export const syncUserSubscriptionFromStripe = async (params: {
  userId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) => {
  let subscription;

  // If we only have userId, find the stripeCustomerId in our DB first
  if (params.userId && !params.stripeCustomerId && !params.stripeSubscriptionId) {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (user?.stripeCustomerId) {
      params.stripeCustomerId = user.stripeCustomerId;
    }
  }

  if (params.stripeSubscriptionId) {
    subscription = await stripe.subscriptions.retrieve(params.stripeSubscriptionId);
  } else if (params.stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: params.stripeCustomerId,
      limit: 1,
    });
    subscription = subscriptions.data[0];
  }

  if (!subscription || (subscription as any).deleted) return;

  const sub = subscription as any;

  const customerId = sub.customer as string;
  let user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  // Fallback to userId in subscription metadata if available and customerId match failed
  if (!user && sub.metadata?.userId) {
    console.log(`[Billing] User not found by customerId ${customerId}. Trying metadata userId: ${sub.metadata.userId}`);
    user = await prisma.user.findUnique({
      where: { id: sub.metadata.userId },
    });
  }

  if (!user) {
    console.error(`[Billing] Could not find user for customer ${customerId} or subscription metadata ${sub.metadata?.userId}`);
    return;
  }

  const status = mapStripeStatus(sub.status);
  const priceId = sub.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  console.log(`[Billing Sync] Subscription ID: ${sub.id}`);
  console.log(`[Billing Sync] Stripe Status: ${sub.status} -> Mapped Status: ${status}`);
  console.log(`[Billing Sync] Stripe Price ID: ${priceId} -> Mapped Plan: ${plan}`);

  const trialEnd = fromStripeUnixTimestamp(sub.trial_end);
  const currentPeriodEnd = fromStripeUnixTimestamp(sub.current_period_end);

  console.log(`[Billing Sync] trialEnd: ${trialEnd}, currentPeriodEnd: ${currentPeriodEnd}`);

  console.log(`[Billing Sync] Updating user ${user.id} with status ${status} and plan ${plan}`);

  // Update user with subscription data
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: status,
      subscriptionPlan: plan,
      subscriptionTrialEndsAt: trialEnd,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
      subscriptionCancelAtPeriodEnd: sub.cancel_at_period_end,
      hasSelectedPlan: true,
    },
  });

  console.log(`[Billing Sync] Update successful. New DB Status: ${updatedUser.subscriptionStatus}`);

  // Re-calculate system access
  const hasAccess = computeSystemAccess(updatedUser);
  await prisma.user.update({
    where: { id: user.id },
    data: { hasSystemAccess: hasAccess },
  });

  console.log(`[Billing Sync] systemAccess updated to: ${hasAccess}`);
};

/**
 * markUserSubscriptionCanceled(user)
 */
export const markUserSubscriptionCanceled = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'CANCELED',
      hasSystemAccess: false,
    },
  });
};

/**
 * getUserAccessStatus(userId)
 */
export const getUserAccessStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const entitlements = getBillingEntitlements(user);

  return {
    authenticated: true,
    ...entitlements,
  };
};

/**
 * getSubscriptionDetails(userId)
 */
export const getSubscriptionDetails = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuário não encontrado');

  const defaultPayload = {
    subscriptionStatus: user.subscriptionStatus.toLowerCase(),
    planId: user.subscriptionPlan,
    planName: user.subscriptionPlan === 'INDIVIDUAL' ? 'Individual' : user.subscriptionPlan === 'OFFICE' ? 'Office' : user.subscriptionPlan === 'ENTERPRISE' ? 'Enterprise' : 'Sem Plano',
    billingInterval: 'monthly',
    amount: 0,
    currency: 'BRL',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd?.toISOString() || new Date().toISOString(),
    cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
    trialEnd: user.subscriptionTrialEndsAt?.toISOString() || null,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    paymentMethodSummary: 'Nenhum cartão cadastrado',
    invoices: [] as any[]
  };

  if (!user.stripeCustomerId) {
    return defaultPayload;
  }

  let subscriptionId = user.stripeSubscriptionId;

  if (!subscriptionId) {
    try {
      const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, limit: 1 });
      if (subs.data.length > 0) {
        subscriptionId = subs.data[0]!.id;
        await prisma.user.update({
          where: { id: userId },
          data: { stripeSubscriptionId: subscriptionId }
        });
      } else {
        return defaultPayload;
      }
    } catch (e) {
      return defaultPayload;
    }
  }

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    let pmSummary = 'Nenhum cartão cadastrado';

    // Get default payment method from subscription or customer
    let defaultPmId = sub.default_payment_method as string;
    if (!defaultPmId) {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!(customer as any).deleted) {
        defaultPmId = (customer as any).invoice_settings?.default_payment_method as string;
      }
    }

    if (defaultPmId) {
      const pm = await stripe.paymentMethods.retrieve(defaultPmId);
      if (pm.card) {
        pmSummary = `${pm.card.brand.toUpperCase()} •••• ${pm.card.last4}`;
      }
    } else {
      // fetch list of PMs just in case
      const pms = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card', limit: 1 });
      const firstPm = pms.data[0];
      if (firstPm?.card) {
        pmSummary = `${firstPm.card.brand.toUpperCase()} •••• ${firstPm.card.last4}`;
      }
    }

    const price = sub.items.data[0]?.price;
    
    const isYearly = price?.recurring?.interval === 'year';
    const amountStr = price?.unit_amount ? (price.unit_amount / 100) : 0;
    const subPlanId = getPlanFromPriceId(price?.id);

    const periodStartTimestamp = (sub as any).current_period_start || sub.items?.data[0]?.current_period_start;
    const periodEndTimestamp = (sub as any).current_period_end || sub.items?.data[0]?.current_period_end;

    // Get true upcoming amount from Stripe if possible (solves tiered pricing returning null unit_amount)
    let nextBillingAmount = amountStr;
    try {
      const upcoming = await (stripe.invoices as any).createPreview({ customer: user.stripeCustomerId });
      nextBillingAmount = upcoming.amount_due / 100;
    } catch (e: any) {
      // Ignore if no upcoming invoice can be generated
      console.warn("Could not fetch upcoming invoice:", e.message);
    }

    const subQuantity = (sub as any).quantity || sub.items?.data[0]?.quantity || 1;

    if (nextBillingAmount === 0 && subPlanId) {
      if (subPlanId === 'INDIVIDUAL') nextBillingAmount = (isYearly ? 599.76 : 64.98) * subQuantity;
      if (subPlanId === 'OFFICE') nextBillingAmount = (isYearly ? 539.76 : 49.98) * subQuantity;
    }

    // Fetch invoices
    const invoices = await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 10 });
    const formattedInvoices = invoices.data.map(inv => ({
      id: inv.id,
      amountDue: inv.amount_due / 100,
      amountPaid: inv.amount_paid / 100,
      status: inv.status,
      created: new Date(inv.created * 1000).toISOString(),
      pdfUrl: inv.hosted_invoice_url || inv.invoice_pdf || '#'
    }));

    return {
      subscriptionStatus: mapStripeStatus(sub.status).toLowerCase(),
      planId: subPlanId,
      planName: subPlanId === 'INDIVIDUAL' ? 'Individual' : subPlanId === 'OFFICE' ? 'Office' : subPlanId === 'ENTERPRISE' ? 'Enterprise' : 'Sem Plano',
      billingInterval: isYearly ? 'yearly' : 'monthly',
      amount: nextBillingAmount,
      quantity: subQuantity,
      currency: price?.currency?.toUpperCase() || 'BRL',
      currentPeriodStart: periodStartTimestamp ? new Date(periodStartTimestamp * 1000).toISOString() : new Date().toISOString(),
      currentPeriodEnd: periodEndTimestamp ? new Date(periodEndTimestamp * 1000).toISOString() : new Date().toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      paymentMethodSummary: pmSummary,
      invoices: formattedInvoices
    };

  } catch (error) {
    console.error('Error fetching stripe details', error);
    return defaultPayload;
  }
};

/**
 * cancelUserSubscription(userId)
 */
export const cancelUserSubscription = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.stripeSubscriptionId) throw new Error('Assinatura não encontrada');

  const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true
  });

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionCancelAtPeriodEnd: true }
  });

  return sub;
};

/**
 * reactivateUserSubscription(userId)
 */
export const reactivateUserSubscription = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.stripeSubscriptionId) throw new Error('Assinatura não encontrada');

  const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: false
  });

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionCancelAtPeriodEnd: false }
  });

  return sub;
};
