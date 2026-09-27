import { prisma } from '../config/db.js';
import { emailQueue, EmailJobPayload } from '../config/queue.js';
import { logger } from '../config/logger.js';
import { EmailJobStatus } from '@prisma/client';
import { bulkIndexEmailDocuments } from './search.service.js';

export interface CreateCampaignInput {
  userId: string;
  senderAccountId?: string;
  name: string;
  subject: string;
  body: string;
  recipients: string[];
  attachments?: any[];
  scheduledStartTime?: string | Date;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
}

/**
 * Schedule a new email campaign and enqueue BullMQ delayed jobs
 */
export const createAndScheduleCampaign = async (input: CreateCampaignInput) => {
  const {
    userId,
    senderAccountId,
    name,
    subject,
    body,
    recipients,
    attachments,
    scheduledStartTime = new Date(),
    delayBetweenEmailsSeconds = 0,
    hourlyLimit = 50,
  } = input;

  if (!recipients || recipients.length === 0) {
    throw new Error('At least one recipient email address is required');
  }

  // 1. Resolve Sender Account
  let senderAccount = senderAccountId
    ? await prisma.senderAccount.findFirst({
        where: { id: senderAccountId, userId },
      })
    : await prisma.senderAccount.findFirst({
        where: { userId },
      });

  if (!senderAccount) {
    // Auto-create a default sender account for the user's primary email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    senderAccount = await prisma.senderAccount.create({
      data: {
        userId,
        email: user.email,
        name: user.name ? `${user.name} (Default)` : 'Default Sender',
        hourlyLimit,
      },
    });
  }

  const startTime = new Date(scheduledStartTime);
  const now = new Date();
  const baseTime = startTime.getTime() > now.getTime() ? startTime : now;

  // 2. Perform transactional database write
  const campaign = await prisma.$transaction(async (tx) => {
    // Create Campaign
    const createdCampaign = await tx.campaign.create({
      data: {
        userId,
        senderAccountId: senderAccount.id,
        name: name || subject,
        subject,
        body,
        attachments: attachments || undefined,
        delayBetweenEmailsSeconds,
        hourlyLimit,
        scheduledStartTime: startTime,
        status: 'PENDING',
        totalCount: recipients.length,
      },
    });

    // Generate EmailJob records with staggered timestamps
    const emailJobsData = recipients.map((recipientEmail, index) => {
      const scheduledFor = new Date(
        baseTime.getTime() + index * delayBetweenEmailsSeconds * 1000
      );

      return {
        campaignId: createdCampaign.id,
        senderEmail: senderAccount.email,
        recipientEmail: recipientEmail.trim().toLowerCase(),
        subject,
        body,
        attachments: attachments || undefined,
        status: EmailJobStatus.SCHEDULED,
        scheduledFor,
      };
    });

    await tx.emailJob.createMany({
      data: emailJobsData,
    });

    return createdCampaign;
  });

  // 3. Fetch created jobs with IDs to enqueue into BullMQ
  const createdJobs = await prisma.emailJob.findMany({
    where: { campaignId: campaign.id },
    orderBy: { scheduledFor: 'asc' },
  });

  // 4. Enqueue deterministic BullMQ delayed jobs in bulk
  const bullmqBulkJobs = createdJobs.map((job) => {
    const delayMs = Math.max(0, new Date(job.scheduledFor).getTime() - Date.now());

    return {
      name: 'send-email',
      data: {
        emailJobId: job.id,
        campaignId: campaign.id,
        userId,
        senderEmail: job.senderEmail,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
        attachments: attachments || (job.attachments as any[] | undefined),
        hourlyLimit,
      } as EmailJobPayload,
      opts: {
        jobId: `emailJob-${job.id}`, // Deterministic ID for idempotency & deduplication
        delay: delayMs,
      },
    };
  });

  await emailQueue.addBulk(bullmqBulkJobs);

  // 5. Index newly scheduled jobs in Elasticsearch (async non-blocking)
  bulkIndexEmailDocuments(createdJobs, userId).catch((err) => {
    logger.debug({ err: err.message }, 'Background bulk indexing failed');
  });

  logger.info(
    { campaignId: campaign.id, jobsEnqueued: bullmqBulkJobs.length },
    'Campaign created and BullMQ delayed jobs enqueued'
  );

  return {
    campaign,
    totalScheduled: createdJobs.length,
    firstScheduledFor: createdJobs[0]?.scheduledFor,
    lastScheduledFor: createdJobs[createdJobs.length - 1]?.scheduledFor,
  };
};

/**
 * Get Scheduled & Rescheduled Emails
 */
export const getScheduledEmails = async (
  userId: string,
  options: { page?: number; limit?: number; search?: string }
) => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(1000, Math.max(1, options.limit || 100));
  const skip = (page - 1) * limit;

  const whereClause: any = {
    campaign: { userId },
    status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
  };

  if (options.search) {
    whereClause.OR = [
      { recipientEmail: { contains: options.search, mode: 'insensitive' } },
      { subject: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { scheduledFor: 'asc' },
      skip,
      take: limit,
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.emailJob.count({ where: whereClause }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get Sent Emails
 */
export const getSentEmails = async (
  userId: string,
  options: { page?: number; limit?: number; search?: string }
) => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(1000, Math.max(1, options.limit || 100));
  const skip = (page - 1) * limit;

  const whereClause: any = {
    campaign: { userId },
    status: EmailJobStatus.SENT,
  };

  if (options.search) {
    whereClause.OR = [
      { recipientEmail: { contains: options.search, mode: 'insensitive' } },
      { subject: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.emailJob.count({ where: whereClause }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get Single Email Job Detail
 */
export const getEmailJobById = async (emailJobId: string, userId: string) => {
  const job = await prisma.emailJob.findFirst({
    where: {
      id: emailJobId,
      campaign: { userId },
    },
    include: {
      campaign: true,
    },
  });

  return job;
};

/**
 * Toggle Star on Email
 */
export const toggleStarEmailJob = async (emailJobId: string, userId: string) => {
  const existing = await prisma.emailJob.findFirst({
    where: {
      id: emailJobId,
      campaign: { userId },
    },
  });

  if (!existing) {
    throw new Error('Email job not found');
  }

  const updated = await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { isStarred: !existing.isStarred },
  });

  return updated;
};

/**
 * Get Dashboard Counts and Real Rate Limit Metrics
 */
export const getDashboardMetrics = async (userId: string) => {
  const now = new Date();
  const startOfCurrentHour = new Date(now);
  startOfCurrentHour.setMinutes(0, 0, 0);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    scheduledCount,
    sentCount,
    sentThisHourRaw,
    sentWeekCount,
    sentMonthCount,
    latestCampaign,
    senderAccount,
  ] = await Promise.all([
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
      },
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: EmailJobStatus.SENT,
      },
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: EmailJobStatus.SENT,
        sentAt: { gte: startOfCurrentHour },
      },
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: EmailJobStatus.SENT,
        sentAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: EmailJobStatus.SENT,
        sentAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.campaign.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { hourlyLimit: true },
    }),
    prisma.senderAccount.findFirst({
      where: { userId },
      select: { hourlyLimit: true },
    }),
  ]);

  const hourlyLimit = latestCampaign?.hourlyLimit || senderAccount?.hourlyLimit || 20;
  const sentThisHour = Math.min(hourlyLimit, sentThisHourRaw);

  return {
    scheduledCount,
    sentCount,
    sentThisHour,
    hourlyLimit,
    sentWeekCount,
    sentMonthCount,
  };
};
