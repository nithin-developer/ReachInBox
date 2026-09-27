import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  signJwtToken,
  setAuthCookie,
  clearAuthCookie,
} from '../services/auth.service.js';
import { AuthRequest } from '../types/auth.types.js';

export const getGoogleUrl = (_req: Request, res: Response): void => {
  try {
    const url = getGoogleAuthUrl();
    res.json({ url });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to generate Google OAuth URL');
    res.status(500).json({
      error: 'Configuration Error',
      message: error.message || 'Google OAuth credentials not configured',
    });
  }
};

export const redirectToGoogle = (_req: Request, res: Response): void => {
  try {
    const url = getGoogleAuthUrl();
    res.redirect(url);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to redirect to Google OAuth');
    res.status(500).json({
      error: 'Configuration Error',
      message: error.message || 'Google OAuth credentials not configured',
    });
  }
};

export const handleGoogleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    const user = await handleGoogleCallback(code);
    const token = signJwtToken(user.id, user.email);

    setAuthCookie(res, token);
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error in Google OAuth callback');
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'auth_failed')}`);
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    return;
  }

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
      senderAccounts: req.user.senderAccounts || [],
      slackIntegration: req.user.slackIntegration || null,
      createdAt: req.user.createdAt,
    },
  });
};

export const logout = (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully' });
};

/**
 * Dev/Demo Login Endpoint
 * Allows instant local testing by logging into the default "Oliver Brown" demo user.
 */
export const devLogin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const email = 'oliver.brown@domain.io';
    const name = 'Oliver Brown';
    const avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, avatarUrl },
      create: {
        email,
        name,
        avatarUrl,
        googleId: 'demo-google-id',
        senderAccounts: {
          create: [
            {
              email,
              name: 'Oliver Brown (Default)',
              hourlyLimit: env.DEFAULT_HOURLY_LIMIT,
            },
          ],
        },
      },
      include: {
        senderAccounts: true,
        slackIntegration: true,
      },
    });

    const token = signJwtToken(user.id, user.email);
    setAuthCookie(res, token);

    res.json({
      message: 'Demo login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        senderAccounts: user.senderAccounts,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error in demo login');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
