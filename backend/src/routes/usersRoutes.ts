import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { getProfile, updateProfile, verifyEmail, resendVerification } from '../controllers/userController';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many login attempts, please try again later'
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

router.get('/verify-email', verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);
// Profile routes
router.get('/me', authenticateToken as any, getProfile as any);
router.put('/me', authenticateToken as any, updateProfile as any);

export default router;
