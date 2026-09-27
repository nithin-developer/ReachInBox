import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { campaignRouter } from './routes/campaign.routes.js';
import { slackRouter } from './routes/slack.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { bullBoardRouter } from './config/queue.js';
import { checkDatabaseConnection } from './config/db.js';
import { checkRedisConnection } from './config/redis.js';
import { checkElasticsearchConnection, initElasticsearchIndex } from './config/elasticsearch.js';

const app = express();

// Security & Parsing Middlewares
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request Logging (skip admin queue polling logs for cleanliness)
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.url.startsWith('/admin/queues')) {
    logger.info({ method: req.method, url: req.url }, 'Incoming request');
  }
  next();
});

// Mount Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/emails', searchRouter); // Search queries
app.use('/api/emails', campaignRouter);
app.use('/api/slack', slackRouter);

// Bull-Board Live Dashboard
app.use('/admin/queues', bullBoardRouter);

// Root Route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'ReachInbox Email Scheduler API',
    version: '1.0.0',
    docs: '/api/health',
    queueDashboard: '/admin/queues',
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} does not exist`,
  });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled server error');
  res.status(500).json({
    error: 'Internal Server Error',
    message: env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

const startServer = async () => {
  logger.info(`Starting ReachInbox Backend on port ${env.PORT} (${env.NODE_ENV})...`);

  // Verify DB & Redis readiness
  await checkDatabaseConnection();
  await checkRedisConnection();

  // Initialize Elasticsearch (non-blocking fallback support)
  await checkElasticsearchConnection();
  await initElasticsearchIndex();

  app.listen(env.PORT, () => {
    logger.info(`API Server running at http://localhost:${env.PORT}`);
    logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
    logger.info(`BullMQ Dashboard available at http://localhost:${env.PORT}/admin/queues`);
  });
};

startServer().catch((error) => {
  logger.fatal({ error }, 'Fatal error during server startup');
  process.exit(1);
});
