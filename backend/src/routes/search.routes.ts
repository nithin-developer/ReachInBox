import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { searchEmails } from '../controllers/search.controller.js';

export const searchRouter = Router();

// Protected search endpoint
searchRouter.get('/search', requireAuth, searchEmails);
