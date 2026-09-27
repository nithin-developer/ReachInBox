import { esClient, EMAIL_INDEX } from '../config/elasticsearch.js';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { EmailJob, EmailJobStatus } from '@prisma/client';

export interface SearchEmailOptions {
  userId: string;
  query: string;
  status?: EmailJobStatus | string;
  page?: number;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  campaignId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledFor: Date | string;
  sentAt?: Date | string | null;
  rescheduledAt?: Date | string | null;
  isStarred: boolean;
  etherealPreviewUrl?: string | null;
  createdAt: Date | string;
}

export interface SearchResponse {
  source: 'elasticsearch' | 'database_fallback';
  items: SearchResultItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Index a single EmailJob into Elasticsearch
 */
export const indexEmailDocument = async (job: Partial<EmailJob> & { id: string }, userId: string): Promise<void> => {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: job.id,
      document: {
        id: job.id,
        campaignId: job.campaignId,
        userId,
        senderEmail: job.senderEmail,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledFor: job.scheduledFor,
        sentAt: job.sentAt,
        rescheduledAt: job.rescheduledAt,
        isStarred: job.isStarred || false,
        etherealPreviewUrl: job.etherealPreviewUrl,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
    logger.debug({ id: job.id }, 'Indexed email document in Elasticsearch');
  } catch (error: any) {
    logger.debug({ id: job.id, error: error.message }, 'Failed to index document in Elasticsearch (non-blocking)');
  }
};

/**
 * Bulk index multiple EmailJobs into Elasticsearch
 */
export const bulkIndexEmailDocuments = async (jobs: (EmailJob & { campaign?: { userId: string } })[], userId: string): Promise<void> => {
  if (jobs.length === 0) return;

  try {
    const operations = jobs.flatMap((job) => [
      { index: { _index: EMAIL_INDEX, _id: job.id } },
      {
        id: job.id,
        campaignId: job.campaignId,
        userId: job.campaign?.userId || userId,
        senderEmail: job.senderEmail,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledFor: job.scheduledFor,
        sentAt: job.sentAt,
        rescheduledAt: job.rescheduledAt,
        isStarred: job.isStarred,
        etherealPreviewUrl: job.etherealPreviewUrl,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    ]);

    await esClient.bulk({ refresh: true, operations });
    logger.info({ count: jobs.length }, 'Bulk indexed email documents in Elasticsearch');
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Failed to bulk index in Elasticsearch (non-blocking)');
  }
};

/**
 * Search emails with Elasticsearch and automatic PostgreSQL fallback
 */
export const searchEmailsWithFallback = async (options: SearchEmailOptions): Promise<SearchResponse> => {
  const { userId, query, status, page = 1, limit = 100 } = options;
  const skip = (page - 1) * limit;

  // 1. Try Elasticsearch First
  try {
    const mustQueries: any[] = [];
    const filterQueries: any[] = [{ term: { userId } }];

    if (query && query.trim()) {
      const q = query.trim();
      mustQueries.push({
        bool: {
          should: [
            {
              multi_match: {
                query: q,
                fields: ['recipientEmail^4', 'senderEmail^3', 'subject^3', 'body'],
                type: 'best_fields',
                fuzziness: 'AUTO',
                operator: 'or',
              },
            },
            {
              query_string: {
                query: `*${q.toLowerCase()}*`,
                fields: ['recipientEmail', 'senderEmail', 'subject', 'body'],
                default_operator: 'OR',
                analyze_wildcard: true,
              },
            },
            {
              wildcard: {
                'recipientEmail.keyword': {
                  value: `*${q.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                senderEmail: {
                  value: `*${q.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                'subject.keyword': {
                  value: `*${q.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    if (status && status !== 'ALL') {
      if (status === 'SCHEDULED_ALL') {
        filterQueries.push({
          terms: { status: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] },
        });
      } else {
        filterQueries.push({ term: { status } });
      }
    }

    const response = await esClient.search({
      index: EMAIL_INDEX,
      from: skip,
      size: limit,
      query: {
        bool: {
          must: mustQueries,
          filter: filterQueries,
        },
      },
      sort: [
        { sentAt: { order: 'desc', missing: '_last', unmapped_type: 'date' } },
        { scheduledFor: { order: 'asc', missing: '_last', unmapped_type: 'date' } },
        { createdAt: { order: 'desc' } },
      ],
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;

    const items: SearchResultItem[] = hits.map((hit) => hit._source as SearchResultItem);

    logger.info({ query, totalHits: total, source: 'elasticsearch' }, 'Search executed via Elasticsearch');

    return {
      source: 'elasticsearch',
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (esError: any) {
    // 2. Fallback to PostgreSQL on Elasticsearch failure
    logger.warn({ error: esError.message }, 'Elasticsearch search failed. Falling back to PostgreSQL.');

    const whereClause: any = {
      campaign: { userId },
    };

    if (query && query.trim()) {
      whereClause.OR = [
        { recipientEmail: { contains: query.trim(), mode: 'insensitive' } },
        { senderEmail: { contains: query.trim(), mode: 'insensitive' } },
        { subject: { contains: query.trim(), mode: 'insensitive' } },
        { body: { contains: query.trim(), mode: 'insensitive' } },
      ];
    }

    if (status && status !== 'ALL') {
      if (status === 'SCHEDULED_ALL') {
        whereClause.status = { in: [EmailJobStatus.SCHEDULED, EmailJobStatus.RESCHEDULED] };
      } else {
        whereClause.status = status as EmailJobStatus;
      }
    }

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: whereClause,
        orderBy: [{ sentAt: 'desc' }, { scheduledFor: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.emailJob.count({ where: whereClause }),
    ]);

    return {
      source: 'database_fallback',
      items: items as SearchResultItem[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
};
