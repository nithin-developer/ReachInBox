import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  getSlackUrl,
  handleCallback,
  getSlackStatus,
  disconnectSlack,
} from '../controllers/slack.controller.js';

export const slackRouter = Router();

// OAuth callback is called by Slack redirect (public)
slackRouter.get('/callback', handleCallback);

// Protected routes (require user session)
slackRouter.get('/auth-url', requireAuth, getSlackUrl);
slackRouter.get('/status', requireAuth, getSlackStatus);
slackRouter.post('/disconnect', requireAuth, disconnectSlack);
