import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { env } from './env.js';
import { logger } from './logger.js';

export const EMAIL_QUEUE_NAME = 'email-send';

export interface EmailJobPayload {
  emailJobId: string;
  campaignId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  attachments?: any[];
  hourlyLimit: number;
}

// Reusable Redis connection options for BullMQ
export const bullmqRedisConnection = {
  host: new URL(env.REDIS_URL).hostname || 'localhost',
  port: Number(new URL(env.REDIS_URL).port) || 6379,
  password: new URL(env.REDIS_URL).password || undefined,
  maxRetriesPerRequest: null,
};

// Initialize BullMQ Queue
export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: bullmqRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600 * 24, // keep for 24h
      count: 1000,
    },
    removeOnFail: {
      age: 3600 * 24 * 3, // keep for 3 days
    },
  },
});

emailQueue.on('error', (error) => {
  logger.error({ error: error.message }, 'BullMQ Queue Error');
});

// Setup Bull-Board Dashboard Adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();
