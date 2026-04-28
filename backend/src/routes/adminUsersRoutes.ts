import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin';
import { getAdminUserDetails, listAdminUsers, updateUserSubscription, updateUserSystemRole } from '../controllers/adminUsersController';

const router = Router();

router.use(authenticateToken as any);
router.use(requireSuperAdmin as any);

router.get('/', listAdminUsers as any);
router.get('/:id', getAdminUserDetails as any);
router.patch('/:id/system-role', updateUserSystemRole as any);
router.patch('/:id/subscription', updateUserSubscription as any);

export default router;
