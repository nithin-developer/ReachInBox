import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { JwtPayload } from '../types/auth.types.js';

export const COOKIE_NAME = 'reachinbox_token';
export const TOKEN_EXPIRY_DAYS = 7;

// Initialize Google OAuth2 client
const googleClient = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_CALLBACK_URL,
});

/**
 * Generate Google OAuth authorization URL
 */
export const getGoogleAuthUrl = (): string => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured in environment');
  }

  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ],
    prompt: 'consent',
  });
};

/**
 * Exchange Google authorization code for tokens and upsert user in database
 */
export const handleGoogleCallback = async (code: string) => {
  if (!code) {
    throw new Error('Authorization code missing');
  }

  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new Error('Failed to retrieve ID token from Google');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name || payload.given_name || 'User';
  const avatarUrl = payload.picture || null;

  // Upsert user in Postgres
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      avatarUrl,
      googleId,
    },
    create: {
      email,
      name,
      avatarUrl,
      googleId,
      senderAccounts: {
        create: [
          {
            email,
            name: `${name} (Default)`,
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

  logger.info({ userId: user.id, email: user.email }, 'User authenticated via Google OAuth');
  return user;
};

/**
 * Sign JWT token for user session
 */
export const signJwtToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email } as JwtPayload, env.JWT_SECRET, {
    expiresIn: `${TOKEN_EXPIRY_DAYS}d`,
  });
};

/**
 * Verify JWT token
 */
export const verifyJwtToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (err) {
    logger.debug({ err }, 'Invalid or expired JWT token');
    return null;
  }
};

/**
 * Set HTTP-Only authentication cookie
 */
export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

/**
 * Clear authentication cookie
 */
export const clearAuthCookie = (res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};
