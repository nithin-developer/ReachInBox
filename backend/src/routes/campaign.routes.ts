import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  scheduleCampaign,
  getScheduled,
  getSent,
  getEmailDetail,
  toggleStar,
  getMetrics,
} from '../controllers/campaign.controller.js';

export const campaignRouter = Router();

// Apply requireAuth to all campaign and email routes
campaignRouter.use(requireAuth);

// Schedule Campaign
campaignRouter.post('/schedule', scheduleCampaign);

// Email List Queries
campaignRouter.get('/scheduled', getScheduled);
campaignRouter.get('/sent', getSent);
campaignRouter.get('/metrics', getMetrics);

// Single Email Operations
campaignRouter.get('/:id', getEmailDetail);
campaignRouter.patch('/:id/star', toggleStar);
