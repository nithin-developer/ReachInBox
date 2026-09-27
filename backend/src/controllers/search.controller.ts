import { Response } from 'express';
import { AuthRequest } from '../types/auth.types.js';
import { searchEmailsWithFallback } from '../services/search.service.js';
import { logger } from '../config/logger.js';

export const searchEmails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = (req.query.q as string) || '';
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await searchEmailsWithFallback({
      userId: req.user.id,
      query,
      status,
      page,
      limit,
    });

    res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to execute email search');
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
