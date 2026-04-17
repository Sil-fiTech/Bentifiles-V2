import express, { Router, Request, Response } from 'express';
import { handleStripeWebhook } from '../services/stripeWebhookService';
import { stripe } from '../lib/stripe';
import Stripe from 'stripe';

const router = Router();

/**
 * Stripe Webhook Endpoint
 * 
 * IMPORTANT: This endpoint needs the raw body to verify the signature.
 * Use express.raw({ type: 'application/json' }) before registering this route.
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  console.log(`[Webhook] Received POST request from ${req.ip} - URI: /webhooks/stripe`);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[Webhook] Missing signature or secret');
    return res.status(400).send('Webhook Error: Missing signature or secret');
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Webhook] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    await handleStripeWebhook(event);
    res.json({ received: true });
  } catch (err: any) {
    console.error(`[Webhook] Handler error: ${err.message}`);
    res.status(500).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
