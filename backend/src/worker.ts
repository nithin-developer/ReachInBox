import { Worker, Job } from 'bullmq';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma, checkDatabaseConnection } from './config/db.js';
import {
  EMAIL_QUEUE_NAME,
  EmailJobPayload,
  bullmqRedisConnection,
  emailQueue,
} from './config/queue.js';
import { sendEmail, getEmailTransporter } from './services/email.service.js';
import {
  checkAndIncrementSenderLimit,
  acquireRateLimitAlertLock,
} from './services/rate-limiter.service.js';
import { sendSlackRateLimitAlert } from './services/slack.service.js';
import { indexEmailDocument } from './services/search.service.js';
import { checkElasticsearchConnection, initElasticsearchIndex } from './config/elasticsearch.js';
import { EmailJobStatus } from '@prisma/client';

/**
 * Boot Reconciliation:
 * On worker startup, scan for any SCHEDULED or RESCHEDULED jobs in Postgres
 * and ensure they are enqueued in BullMQ. Deterministic jobIds prevent duplicates.
 */
export const reconcileScheduledJobs = async (): Promise<number> => {
  logger.info('[Reconciliation] Running boot reconciliation for scheduled email jobs...');

  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
    },
    include: {
      campaign: true,
    },
    orderBy: { scheduledFor: 'asc' },
  });

  if (pendingJobs.length === 0) {
    logger.info('[Reconciliation] Complete: No pending jobs found.');
    return 0;
  }

  const bulkJobs = pendingJobs.map((job) => {
    const delayMs = Math.max(0, new Date(job.scheduledFor).getTime() - Date.now());

    return {
      name: 'send-email',
      data: {
        emailJobId: job.id,
        campaignId: job.campaignId,
        userId: job.campaign.userId,
        senderEmail: job.senderEmail,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
        hourlyLimit: job.campaign.hourlyLimit,
      } as EmailJobPayload,
      opts: {
        jobId: `emailJob-${job.id}`, // Deterministic ID ensures deduplication
        delay: delayMs,
      },
    };
  });

  await emailQueue.addBulk(bulkJobs);
  logger.info(
    { reconciledCount: bulkJobs.length },
    '[Reconciliation] Complete: jobs verified in BullMQ'
  );
  return bulkJobs.length;
};

/**
 * Core Job Execution Handler
 */
export const processEmailJob = async (job: Job<EmailJobPayload>) => {
  const { emailJobId, campaignId, userId, senderEmail, recipientEmail, subject, body, hourlyLimit } = job.data;

  logger.info({ jobId: job.id, emailJobId, recipientEmail }, 'Processing email send job...');

  // 1. Atomic Compare-and-Set: Transition status from SCHEDULED/RESCHEDULED to SENDING
  const transition = await prisma.emailJob.updateMany({
    where: {
      id: emailJobId,
      status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
    },
    data: {
      status: EmailJobStatus.SENDING,
      attempts: { increment: 1 },
    },
  });

  if (transition.count === 0) {
    logger.warn(
      { emailJobId },
      'Job already processed or locked by another worker. Skipping.'
    );
    return;
  }

  try {
    // 2. Distributed Hour-Aligned Rate Limiter Check (Atomic Lua Script)
    const effectiveHourlyLimit = hourlyLimit || env.DEFAULT_HOURLY_LIMIT;
    const rateLimit = await checkAndIncrementSenderLimit(senderEmail, effectiveHourlyLimit);

    if (!rateLimit.allowed) {
      // Rate limit exceeded: reschedule job to next hour window
      const now = new Date();
      const rescheduledJob = await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: EmailJobStatus.RESCHEDULED,
          rescheduledAt: now,
          scheduledFor: rateLimit.nextWindowTime,
          lastError: `Hourly rate limit of ${effectiveHourlyLimit} reached (${rateLimit.currentCount}/${effectiveHourlyLimit}). Rescheduled for next hour window.`,
        },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          rescheduledCount: { increment: 1 },
        },
      });

      // Update in Elasticsearch
      indexEmailDocument(rescheduledJob, userId).catch(() => {});

      // Re-enqueue in BullMQ for the next window with delay
      const delayMs = Math.max(1000, rateLimit.retryAfterSeconds * 1000);
      await emailQueue.add(
        'send-email',
        job.data,
        {
          jobId: `emailJob-${emailJobId}-rescheduled-${rateLimit.nextWindowTime.getTime()}`,
          delay: delayMs,
        }
      );

      // Acquire one-time Slack alert lock for this sender in the current hour window
      const shouldSendSlackAlert = await acquireRateLimitAlertLock(senderEmail, rateLimit.windowKey);
      if (shouldSendSlackAlert) {
        // Query pending / queued count for this campaign
        const queuedCount = await prisma.emailJob.count({
          where: {
            campaignId,
            status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
          },
        });

        await sendSlackRateLimitAlert(
          userId,
          senderEmail,
          rateLimit.currentCount,
          effectiveHourlyLimit,
          rateLimit.nextWindowTime,
          recipientEmail,
          queuedCount
        );
        logger.info(
          { senderEmail, windowKey: rateLimit.windowKey, queuedCount },
          'Slack rate-limit notification sent (single alert locked for window)'
        );
      } else {
        logger.debug(
          { senderEmail, windowKey: rateLimit.windowKey },
          'Slack notification suppressed (alert already dispatched for this window)'
        );
      }

      logger.warn(
        { emailJobId, senderEmail, nextWindow: rateLimit.nextWindowTime.toISOString() },
        'Job rescheduled to next hourly window due to sender limit'
      );
      return;
    }

    // 3. Send email via Ethereal SMTP
    const sendResult = await sendEmail({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: body,
      attachments: job.data.attachments,
    });

    // 4. Atomically update EmailJob to SENT
    const now = new Date();
    const sentJob = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailJobStatus.SENT,
        sentAt: now,
        etherealMessageId: sendResult.messageId,
        etherealPreviewUrl: sendResult.previewUrl || null,
        lastError: null,
      },
    });

    // Update in Elasticsearch
    indexEmailDocument(sentJob, userId).catch(() => {});

    // 5. Update Campaign statistics
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: { increment: 1 },
        status: 'PROCESSING',
      },
    });

    // Check if campaign is finished
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { totalCount: true, sentCount: true, failedCount: true },
    });

    if (campaign && campaign.sentCount + campaign.failedCount >= campaign.totalCount) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      });
      logger.info({ campaignId }, 'Campaign completed all sends');
    }

    logger.info(
      { emailJobId, recipientEmail, previewUrl: sendResult.previewUrl },
      'Email sent and recorded successfully'
    );
  } catch (error: any) {
    logger.error({ emailJobId, error: error.message }, 'Failed to send email');

    // Update job with error status
    const failedJob = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailJobStatus.FAILED,
        lastError: error.message || 'Unknown SMTP send failure',
      },
    });

    // Update in Elasticsearch
    indexEmailDocument(failedJob, userId).catch(() => {});

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: 1 } },
    });

    throw error;
  }
};

/**
 * Worker Process Lifecycle
 */
export const startWorker = async () => {
  logger.info(`Initializing ReachInbox Worker Process (Concurrency: ${env.WORKER_CONCURRENCY})...`);

  // Verify Database connection
  await checkDatabaseConnection();

  // Verify / Initialize Elasticsearch
  await checkElasticsearchConnection();
  await initElasticsearchIndex();

  // Initialize SMTP Transporter
  await getEmailTransporter();

  // Reconcile pending jobs on boot
  await reconcileScheduledJobs();

  // Create BullMQ Worker
  const worker = new Worker<EmailJobPayload>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: bullmqRedisConnection,
    concurrency: env.WORKER_CONCURRENCY,
    limiter: {
      max: 10,
      duration: env.MIN_DELAY_BETWEEN_SENDS_MS,
    },
  });

  worker.on('active', (job) => {
    logger.debug({ jobId: job.id }, 'Job is now active');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Job failed');
  });

  logger.info('ReachInbox Worker is active and listening for jobs');

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully shutting down worker...`);
    await worker.close();
    await emailQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return worker;
};

// Auto-start worker when run directly
startWorker().catch((error) => {
  logger.fatal({ error }, 'Fatal error starting worker');
  process.exit(1);
});
