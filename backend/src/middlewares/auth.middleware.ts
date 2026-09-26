import { Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { verifyJwtToken, COOKIE_NAME } from '../services/auth.service.js';
import { AuthRequest } from '../types/auth.types.js';

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from cookie or Authorization header
    let token = req.cookies?.[COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.',
      });
      return;
    }

    // 2. Verify token
    const decoded = verifyJwtToken(token);
    if (!decoded || !decoded.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Session has expired or is invalid. Please sign in again.',
      });
      return;
    }

    // 3. Retrieve user from database with relations
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        senderAccounts: true,
        slackIntegration: {
          select: {
            id: true,
            teamId: true,
            teamName: true,
            channelId: true,
            channelName: true,
            isConnected: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account not found.',
      });
      return;
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate user',
    });
  }
};
