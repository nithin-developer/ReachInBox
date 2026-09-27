import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types/auth.types.js';
import { logger } from '../config/logger.js';
import {
  createAndScheduleCampaign,
  getScheduledEmails,
  getSentEmails,
  getEmailJobById,
  toggleStarEmailJob,
  getDashboardMetrics,
} from '../services/campaign.service.js';

// Schema for scheduling a campaign
const scheduleCampaignSchema = z.object({
  name: z.string().optional().default('Untitled Campaign'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
  senderAccountId: z.string().optional(),
  scheduledStartTime: z.string().datetime().optional().or(z.string().optional()),
  delayBetweenEmailsSeconds: z.number().int().min(0).default(0),
  hourlyLimit: z.number().int().min(1).max(10000).default(50),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(),
        contentType: z.string().optional(),
        size: z.number().optional(),
      })
    )
    .optional(),
});

export const scheduleCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validation = scheduleCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: validation.error.format(),
      });
      return;
    }

    const result = await createAndScheduleCampaign({
      ...validation.data,
      userId: req.user.id,
    });

    res.status(201).json({
      message: 'Campaign scheduled successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to schedule campaign');
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to schedule campaign',
    });
  }
};

export const getScheduled = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = req.query.search as string | undefined;

    const result = await getScheduledEmails(req.user.id, { page, limit, search });
    res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch scheduled emails');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getSent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = req.query.search as string | undefined;

    const result = await getSentEmails(req.user.id, { page, limit, search });
    res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch sent emails');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getEmailDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const email = await getEmailJobById(id, req.user.id);

    if (!email) {
      res.status(404).json({ error: 'Not Found', message: 'Email not found' });
      return;
    }

    res.json({ email });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get email detail');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const toggleStar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const updated = await toggleStarEmailJob(id, req.user.id);
    res.json({ message: 'Star toggled', email: updated });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to toggle star');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const metrics = await getDashboardMetrics(req.user.id);
    res.json(metrics);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch metrics');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
