import prisma from '../prisma';
import { notifyBillingEvent, notifyErrorEvent } from './discordAlertService';
import { logError, logInfo } from '../utils/logger';
import { markUserSubscriptionCanceled, syncUserSubscriptionFromStripe } from './billingService';

export const handleStripeWebhook = async (event: any) => {
    logInfo('Processing Stripe webhook event', { eventType: event.type });

    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object as any);
            break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object as any);
            break;
        case 'invoice.payment_succeeded':
        case 'invoice.paid':
            await handleInvoicePaymentSucceeded(event.data.object as any);
            break;
        case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(event.data.object as any);
            break;
        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object as any);
            break;
        default:
            logInfo('Unhandled Stripe webhook event', { eventType: event.type });
    }
};

const handleCheckoutSessionCompleted = async (session: any) => {
    const userId = session.metadata?.userId || session.client_reference_id;
    const plan = session.metadata?.plan;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!userId) {
        logError('Stripe checkout completed without userId metadata');
        return;
    }

    logInfo('Stripe checkout completed', { userId, plan });

    await prisma.user.update({
        where: { id: userId },
        data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            hasSelectedPlan: true,
        },
    });

    await syncUserSubscriptionFromStripe({ stripeSubscriptionId: subscriptionId });

};

const handleSubscriptionUpdated = async (subscription: any) => {
    logInfo('Stripe subscription updated', { subscriptionId: subscription.id });
    await syncUserSubscriptionFromStripe({ stripeSubscriptionId: subscription.id });

    notifyBillingEvent('Assinatura atualizada', [
        ['Evento', 'customer.subscription.updated'],
        ['Subscription ID', subscription.id],
        ['Status', subscription.status],
        ['Customer ID', subscription.customer],
    ]);
};

const handleInvoicePaymentSucceeded = async (invoice: any) => {
    if (!invoice.subscription) {
        return;
    }

    logInfo('Stripe invoice payment succeeded', { invoiceId: invoice.id });
    await syncUserSubscriptionFromStripe({
        stripeSubscriptionId: invoice.subscription as string,
    });

    notifyBillingEvent('Pagamento confirmado', [
        ['Evento', invoice.status === 'paid' ? 'invoice.paid' : 'invoice.payment_succeeded'],
        ['Invoice ID', invoice.id],
        ['Subscription ID', invoice.subscription],
        ['Customer ID', invoice.customer],
        ['Amount Paid', invoice.amount_paid],
        ['Currency', invoice.currency],
    ]);
};

const handleInvoicePaymentFailed = async (invoice: any) => {
    if (!invoice.subscription) {
        return;
    }

    logInfo('Stripe invoice payment failed', { invoiceId: invoice.id });
    await syncUserSubscriptionFromStripe({
        stripeSubscriptionId: invoice.subscription as string,
    });

    notifyErrorEvent('Pagamento Stripe falhou', new Error(`Invoice ${invoice.id} failed`), [
        ['Evento', 'invoice.payment_failed'],
        ['Invoice ID', invoice.id],
        ['Subscription ID', invoice.subscription],
        ['Customer ID', invoice.customer],
        ['Amount Due', invoice.amount_due],
        ['Currency', invoice.currency],
    ]);
};

const handleSubscriptionDeleted = async (subscription: any) => {
    logInfo('Stripe subscription deleted', { subscriptionId: subscription.id });

    const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
    });

    if (user) {
        await markUserSubscriptionCanceled(user.id);
    }

    notifyBillingEvent('Assinatura cancelada', [
        ['Evento', 'customer.subscription.deleted'],
        ['Subscription ID', subscription.id],
        ['Customer ID', subscription.customer],
        ['User ID', user?.id],
    ]);
};
