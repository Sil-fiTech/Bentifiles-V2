import { Router } from 'express';
import * as billingController from '../controllers/billingController';
import * as subscriptionSeatController from '../controllers/subscriptionSeatController';
import { authenticateToken } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

/**
 * Apply rate limiting to checkout creation to prevent abuse
 */
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per window
  message: 'Muitas tentativas de checkout, por favor tente novamente mais tarde.'
});

// All billing routes are protected
router.use(authenticateToken as any);

router.post('/create-checkout-session', checkoutLimiter, billingController.createCheckoutSession as any);
router.get('/access-status', billingController.getAccessStatus as any);
router.post('/sync-subscription', billingController.syncSubscription as any);
router.post('/create-portal-session', billingController.createPortalSession as any);
router.get('/subscription', billingController.getSubscriptionDetails as any);
router.post('/cancel-subscription', billingController.cancelSubscription as any);
router.post('/reactivate-subscription', billingController.reactivateSubscription as any);
router.get('/subscription/office', subscriptionSeatController.getOfficeSubscriptionManagementData as any);
router.post('/subscription/leave', subscriptionSeatController.leaveMembership as any);
router.post('/subscription/invites', subscriptionSeatController.createInvite as any);
router.get('/subscription/invites', subscriptionSeatController.getInvites as any);
router.post('/subscription/invites/accept', subscriptionSeatController.acceptInvite as any);
router.delete('/subscription/invites/:id', subscriptionSeatController.revokeInvite as any);
router.delete('/subscription/members/:id', subscriptionSeatController.deleteMember as any);

export default router;
