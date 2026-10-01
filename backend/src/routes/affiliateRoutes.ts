import { Router } from 'express';
import * as affiliateController from '../controllers/affiliateController';
import { authenticateToken } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin';

const router = Router();

router.use(authenticateToken as any);

// Self-serve affiliate endpoints
router.get('/me', affiliateController.getMe as any);
router.post('/enroll', affiliateController.enroll as any);
router.get('/me/referrals', affiliateController.listMyReferrals as any);
router.post('/track', affiliateController.track as any);

// Admin (SUPER_ADMIN) endpoints
router.get('/admin', requireSuperAdmin as any, affiliateController.adminList as any);
router.get('/admin/:id/referrals', requireSuperAdmin as any, affiliateController.adminListReferrals as any);

export default router;
