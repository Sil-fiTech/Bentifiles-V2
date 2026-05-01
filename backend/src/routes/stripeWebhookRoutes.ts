import express, { Request, Response, Router } from 'express';
import { stripe } from '../lib/stripe';
import { handleStripeWebhook } from '../services/stripeWebhookService';
import { logError, logInfo } from '../utils/logger';

const router = Router();

// This endpoint needs the raw body to verify the Stripe signature.
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    logInfo('Stripe webhook received', {
        requestId: req.requestId,
        ip: req.ip,
        path: req.originalUrl,
        hasSignature: Boolean(sig),
    });

    if (!sig || !webhookSecret) {
        logError('Stripe webhook missing signature or secret', undefined, {
            requestId: req.requestId,
        });
        return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event: any;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        logError('Stripe webhook signature verification failed', err, {
            requestId: req.requestId,
        });
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        await handleStripeWebhook(event);
        return res.json({ received: true });
    } catch (err: any) {
        logError('Stripe webhook handler failed', err, {
            requestId: req.requestId,
            eventType: event?.type,
        });
        return res.status(500).send(`Webhook Error: ${err.message}`);
    }
});

export default router;
