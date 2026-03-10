import { Router } from 'express';
import { register, login, googleLogin } from '../controllers/authController';
import rateLimit from 'express-rate-limit';

const router = Router();

// Apply strict rate limiting to auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
    message: { message: 'Muitas requisições deste IP, tente novamente em 15 minutos.' }
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleLogin);

export default router;
