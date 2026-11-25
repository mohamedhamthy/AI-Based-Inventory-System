import express from 'express';
import rateLimit from 'express-rate-limit';
import { changePassword, getMe, login, logout, rejectPublicRegistration } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { preventDemoWrites, requireTrustedOrigin, verifyCsrfToken } from '../middleware/demoAccessMiddleware.js';
import { validate, validateChangePassword, validateLogin } from '../validators/validation.js';

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Try again later.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Try again later.' },
});

router.post('/register', registerLimiter, requireTrustedOrigin, rejectPublicRegistration);
router.post('/login', loginLimiter, requireTrustedOrigin, validateLogin, validate, login);
router.get('/me', protect, getMe);
router.post('/logout', protect, verifyCsrfToken, logout);
router.post('/change-password', protect, preventDemoWrites, verifyCsrfToken, validateChangePassword, validate, changePassword);

export default router;
