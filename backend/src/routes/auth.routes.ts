import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getGoogleUrl,
  redirectToGoogle,
  handleGoogleOAuthCallback,
  getMe,
  logout,
  devLogin,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

// Rate limiter for auth endpoints (prevent abuse)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts from this IP. Please try again later.',
  },
});

// OAuth Routes
authRouter.get('/google', authLimiter, redirectToGoogle);
authRouter.get('/google/url', authLimiter, getGoogleUrl);
authRouter.get('/google/callback', authLimiter, handleGoogleOAuthCallback);

// Session Routes
authRouter.get('/me', requireAuth, getMe);
authRouter.post('/logout', logout);

// Dev / Testing Route
authRouter.post('/dev-login', devLogin);
