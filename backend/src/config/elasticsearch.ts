import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';
import { logger } from './logger.js';

export const EMAIL_INDEX = 'email_jobs';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  maxRetries: 3,
  requestTimeout: 5000,
});

/**
 * Check Elasticsearch Health & Connection
 */
export const checkElasticsearchConnection = async (): Promise<boolean> => {
  try {
    const health = await esClient.cluster.health({});
    logger.info({ clusterStatus: health.status }, 'Elasticsearch connected successfully');
    return true;
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Elasticsearch connection failed (running in DB fallback mode)');
    return false;
  }
};

/**
 * Initialize Elasticsearch index with proper mappings
 */
export const initElasticsearchIndex = async (): Promise<void> => {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });

    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                email_analyzer: {
                  type: 'custom',
                  tokenizer: 'uax_url_email',
                  filter: ['lowercase'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipientEmail: {
                type: 'text',
                analyzer: 'email_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              subject: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledFor: { type: 'date' },
              sentAt: { type: 'date' },
              rescheduledAt: { type: 'date' },
              isStarred: { type: 'boolean' },
              etherealPreviewUrl: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      });
      logger.info({ index: EMAIL_INDEX }, 'Created Elasticsearch index with mappings');
    }
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Could not initialize Elasticsearch index (non-blocking)');
  }
};
