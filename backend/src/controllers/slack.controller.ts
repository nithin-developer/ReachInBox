import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth.types.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { getSlackAuthUrl, handleSlackCallback } from '../services/slack.service.js';

export const getSlackUrl = (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const url = getSlackAuthUrl(req.user.id);
    res.json({ url });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to generate Slack OAuth URL');
    res.status(500).json({ error: 'Configuration Error', message: error.message });
  }
};

export const handleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=missing_params`);
      return;
    }

    await handleSlackCallback(code, userId);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error in Slack OAuth callback');
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=${encodeURIComponent(error.message)}`);
  }
};

export const getSlackStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: req.user.id },
      select: {
        id: true,
        teamId: true,
        teamName: true,
        channelId: true,
        channelName: true,
        isConnected: true,
        createdAt: true,
      },
    });

    res.json({ isConnected: !!integration?.isConnected, integration });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get Slack status');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const disconnectSlack = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await prisma.slackIntegration.updateMany({
      where: { userId: req.user.id },
      data: { isConnected: false },
    });

    res.json({ message: 'Slack disconnected successfully' });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to disconnect Slack');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
