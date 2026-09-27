import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/db.js';
import { checkRedisConnection } from '../config/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
  ]);

  const status = dbOk && redisOk ? 'ok' : 'degraded';
  const statusCode = dbOk && redisOk ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'healthy' : 'unhealthy',
      redis: redisOk ? 'healthy' : 'unhealthy',
    },
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
  });
});
