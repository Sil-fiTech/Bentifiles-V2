import { SubscriptionPlan } from '@prisma/client';
import Stripe from 'stripe';
import { stripe, getPlanFromPriceId, mapStripeStatus, fromStripeUnixTimestamp } from '../lib/stripe';
import prisma from '../prisma';
import { computeSystemAccess } from './accessService';
import { getBillingEntitlements } from './billingAccessService';
import {
  canUserCreateProjects,
  getOfficeSeatAccessForUser,
  getOfficeSubscriptionManagement,
  syncOfficeSubscriptionFromBilling,
} from './officeSubscriptionService';
import { syncReminderDispatchesForUser } from './subscriptionReminderService';

const getSubscriptionQuantity = (subscription: any) => {
  const itemQuantity = subscription.items?.data?.[0]?.quantity;
  const metadataQuantity = Number(subscription.metadata?.selectedSeats || subscription.metadata?.quantity || 0);
  return Math.max(1, Number(itemQuantity || metadataQuantity || 1));
};

export const createCheckoutSession = async (
  userId: string,
  plan: SubscriptionPlan,
  interval: 'monthly' | 'yearly' = 'monthly',
  quantity: number = 1
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Usuario nao encontrado');
  }

  let priceId: string | undefined;
  if (interval === 'yearly') {
    switch (plan) {
      case 'INDIVIDUAL':
        priceId = process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY;
        break;
      case 'OFFICE':
        priceId = process.env.STRIPE_PRICE_OFFICE_YEARLY;
        break;
      case 'ENTERPRISE':
        priceId = process.env.STRIPE_PRICE_ENTERPRISE_YEARLY;
        break;
    }
  } else {
    switch (plan) {
      case 'INDIVIDUAL':
        priceId = process.env.STRIPE_PRICE_INDIVIDUAL;
        break;
      case 'OFFICE':
        priceId = process.env.STRIPE_PRICE_OFFICE;
        break;
      case 'ENTERPRISE':
        priceId = process.env.STRIPE_PRICE_ENTERPRISE;
        break;
    }
  }

  if (!priceId) {
    throw new Error('Plano invalido ou ID de preco nao configurado');
  }

  const normalizedQuantity = plan === 'OFFICE' ? Math.max(1, Number(quantity) || 1) : 1;

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


  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: normalizedQuantity }],
    subscription_data: {
      trial_period_days: 10,
      metadata: {
        userId,
        plan,
        selectedSeats: String(normalizedQuantity),
      },
    },
    success_url: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/billing/success',
    cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/billing/cancel',
    metadata: {
      userId,
      plan,
      selectedSeats: String(normalizedQuantity),
    },
  });

  
  return session.url;
};

export const syncUserSubscriptionFromStripe = async (params: {
  userId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) => {
  let subscription: any;

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

  if (!subscription || (subscription as any).deleted) {
    return;
  }

  const customerId = subscription.customer as string;
  let user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user && subscription.metadata?.userId) {
    user = await prisma.user.findUnique({
      where: { id: subscription.metadata.userId },
    });
  }

  if (!user) {
    console.error(`[Billing] Could not find user for customer ${customerId}`);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);
  const status = mapStripeStatus(subscription.status);
  const trialEnd = fromStripeUnixTimestamp(subscription.trial_end);
  const currentPeriodEnd = fromStripeUnixTimestamp(subscription.current_period_end);
  const totalSeats = getSubscriptionQuantity(subscription);
  const billingInterval = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionPlan: plan,
      subscriptionTrialEndsAt: trialEnd,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
      hasSelectedPlan: true,
    },
  });

  const hasAccess = computeSystemAccess(updatedUser);
  await prisma.user.update({
    where: { id: user.id },
    data: { hasSystemAccess: hasAccess },
  });

  await syncReminderDispatchesForUser(user.id);

  await syncOfficeSubscriptionFromBilling({
    ownerId: user.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    plan,
    status,
    billingInterval,
    totalSeats,
    currentPeriodEnd,
  });
};

export const markUserSubscriptionCanceled = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'CANCELED',
      hasSystemAccess: false,
    },
  });

  await syncOfficeSubscriptionFromBilling({
    ownerId: userId,
    plan: 'NONE',
    status: 'CANCELED',
    billingInterval: null,
    totalSeats: 0,
    currentPeriodEnd: null,
  });

  await syncReminderDispatchesForUser(userId);
};

export const getUserAccessStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Usuario nao encontrado');
  }

  const canCreateProject = await canUserCreateProjects(user.id, user.subscriptionStatus);
  const officeSeatAccess = await getOfficeSeatAccessForUser(user.id);

  return {
    authenticated: true,
    ...getBillingEntitlements(user, {
      canCreateProject,
      officeSeatAccess,
    }),
  };
};

export const getSubscriptionDetails = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Usuario nao encontrado');
  }

  const officeWorkspace = user.subscriptionPlan === 'OFFICE'
    ? await getOfficeSubscriptionManagement(user.id)
    : null;
  const officeSeatAccess = await getOfficeSeatAccessForUser(user.id);

  const defaultPayload = {
    subscriptionStatus: user.subscriptionStatus.toLowerCase(),
    planId: user.subscriptionPlan,
    planName:
      user.subscriptionPlan === 'INDIVIDUAL'
        ? 'Individual'
        : user.subscriptionPlan === 'OFFICE'
          ? 'Office'
          : user.subscriptionPlan === 'ENTERPRISE'
            ? 'Enterprise'
            : 'Sem Plano',
    billingInterval: 'monthly',
    amount: 0,
    currency: 'BRL',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd?.toISOString() || new Date().toISOString(),
    cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
    trialEnd: user.subscriptionTrialEndsAt?.toISOString() || null,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    paymentMethodSummary: 'Nenhum cartao cadastrado',
    invoices: [] as any[],
    officeWorkspace,
    officeSeatAccess,
  };

  if (!user.stripeCustomerId) {
    return defaultPayload;
  }

  let subscriptionId = user.stripeSubscriptionId;
  if (!subscriptionId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 1,
      });

      if (!subs.data.length) {
        return defaultPayload;
      }

      subscriptionId = subs.data[0]!.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeSubscriptionId: subscriptionId },
      });
    } catch {
      return defaultPayload;
    }
  }

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    let pmSummary = 'Nenhum cartao cadastrado';

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
      const pms = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
        limit: 1,
      });

      if (pms.data[0]?.card) {
        pmSummary = `${pms.data[0].card.brand.toUpperCase()} •••• ${pms.data[0].card.last4}`;
      }
    }

    const price = sub.items.data[0]?.price;
    const subPlanId = getPlanFromPriceId(price?.id);
    const isYearly = price?.recurring?.interval === 'year';
    const quantity = getSubscriptionQuantity(sub);
    const periodStartTimestamp = (sub as any).current_period_start || sub.items?.data[0]?.current_period_start;
    const periodEndTimestamp = (sub as any).current_period_end || sub.items?.data[0]?.current_period_end;

    let nextBillingAmount = price?.unit_amount ? price.unit_amount / 100 : 0;
    try {
      const upcoming = await (stripe.invoices as any).createPreview({
        customer: user.stripeCustomerId,
      });
      nextBillingAmount = upcoming.amount_due / 100;
    } catch (error: any) {
      console.warn('[Billing] Could not fetch upcoming invoice:', error.message);
    }

    if (nextBillingAmount === 0 && subPlanId) {
      if (subPlanId === 'INDIVIDUAL') {
        nextBillingAmount = (isYearly ? 599.76 : 64.98) * quantity;
      }
      if (subPlanId === 'OFFICE') {
        nextBillingAmount = (isYearly ? 539.76 : 49.98) * quantity;
      }
    }

    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 10,
    });

    return {
      subscriptionStatus: mapStripeStatus(sub.status).toLowerCase(),
      planId: subPlanId,
      planName:
        subPlanId === 'INDIVIDUAL'
          ? 'Individual'
          : subPlanId === 'OFFICE'
            ? 'Office'
            : subPlanId === 'ENTERPRISE'
              ? 'Enterprise'
              : 'Sem Plano',
      billingInterval: isYearly ? 'yearly' : 'monthly',
      amount: nextBillingAmount,
      quantity,
      currency: price?.currency?.toUpperCase() || 'BRL',
      currentPeriodStart: periodStartTimestamp
        ? new Date(periodStartTimestamp * 1000).toISOString()
        : new Date().toISOString(),
      currentPeriodEnd: periodEndTimestamp
        ? new Date(periodEndTimestamp * 1000).toISOString()
        : new Date().toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      paymentMethodSummary: pmSummary,
      invoices: invoices.data.map((invoice) => ({
        id: invoice.id,
        amountDue: invoice.amount_due / 100,
        amountPaid: invoice.amount_paid / 100,
        status: invoice.status,
        created: new Date(invoice.created * 1000).toISOString(),
        pdfUrl: invoice.hosted_invoice_url || invoice.invoice_pdf || '#',
      })),
      officeWorkspace,
      officeSeatAccess,
    };
  } catch (error) {
    console.error('[Billing] Error fetching stripe details', error);
    return defaultPayload;
  }
};

export const cancelUserSubscription = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.stripeSubscriptionId) {
    throw new Error('Assinatura nao encontrada');
  }

  const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionCancelAtPeriodEnd: true },
  });

  await syncReminderDispatchesForUser(userId);
  return sub;
};

export const reactivateUserSubscription = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.stripeSubscriptionId) {
    throw new Error('Assinatura nao encontrada');
  }

  const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionCancelAtPeriodEnd: false },
  });

  await syncReminderDispatchesForUser(userId);
  return sub;
};
