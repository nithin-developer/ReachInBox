import { WebClient } from '@slack/web-api';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { encrypt, decrypt } from '../utils/crypto.js';

/**
 * Generate Slack OAuth 2.0 Authorization URL
 */
export const getSlackAuthUrl = (userId: string): string => {
  if (!env.SLACK_CLIENT_ID) {
    throw new Error('SLACK_CLIENT_ID not configured in environment');
  }

  const scopes = ['chat:write', 'channels:read', 'chat:write.public'].join(',');
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: scopes,
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: userId, // Pass userId in state to associate on callback
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

/**
 * Exchange Slack authorization code and store encrypted bot token
 */
export const handleSlackCallback = async (code: string, userId: string) => {
  if (!code) {
    throw new Error('Slack authorization code is missing');
  }

  const client = new WebClient();
  const response = await client.oauth.v2.access({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });

  if (!response.ok || !response.access_token) {
    throw new Error(`Slack OAuth failed: ${response.error || 'Unknown error'}`);
  }

  const botToken = response.access_token;
  const teamId = response.team?.id || 'unknown';
  const teamName = response.team?.name || 'Slack Workspace';
  const channelId = response.incoming_webhook?.channel_id || 'general';
  const channelName = response.incoming_webhook?.channel || '#general';

  // Encrypt token before writing to PostgreSQL
  const { encryptedText, iv, authTag } = encrypt(botToken);

  const integration = await prisma.slackIntegration.upsert({
    where: { userId },
    update: {
      teamId,
      teamName,
      channelId,
      channelName,
      encryptedBotToken: encryptedText,
      iv,
      authTag,
      isConnected: true,
    },
    create: {
      userId,
      teamId,
      teamName,
      channelId,
      channelName,
      encryptedBotToken: encryptedText,
      iv,
      authTag,
      isConnected: true,
    },
  });

  // Determine target channel and post professional welcome notification
  try {
    const botClient = new WebClient(botToken);
    let targetChannel = channelId;
    let resolvedChannelName = channelName;

    if (!targetChannel || targetChannel === 'general') {
      try {
        const channelList = await botClient.conversations.list({ types: 'public_channel', limit: 20 });
        if (channelList.channels && channelList.channels.length > 0) {
          const generalChan = channelList.channels.find(
            (c) => c.name === 'general' || c.name === 'email-alerts' || c.is_general
          );
          const chosen = generalChan || channelList.channels[0];
          if (chosen.id) {
            targetChannel = chosen.id;
            resolvedChannelName = `#${chosen.name || 'general'}`;
          }
        }
      } catch (e: any) {
        logger.debug({ error: e.message }, 'conversations.list notice');
      }
    }

    // Try joining public channel if needed
    try {
      if (targetChannel && targetChannel !== 'general') {
        await botClient.conversations.join({ channel: targetChannel });
      }
    } catch (_) {
      // Ignore if already in channel
    }

    // Update integration with resolved channel
    if (targetChannel && targetChannel !== channelId) {
      await prisma.slackIntegration.update({
        where: { userId },
        data: { channelId: targetChannel, channelName: resolvedChannelName },
      });
    }

    await botClient.chat.postMessage({
      channel: targetChannel,
      text: '*ReachInbox Integration Connected Successfully*',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'ReachInbox Email Scheduler Connected',
            emoji: false,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Welcome to ReachInbox!* Your Slack workspace *${teamName}* is now officially connected.\n\n*Real-Time Rate-Limiting Protection:* Active\n*Notification Channel:* \`${resolvedChannelName}\`\n*Connected At:* <!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toISOString()}>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '*How it works:* If any sender hits their hourly quota, pending emails are automatically queued for the next window and you will receive an instant Slack notification here.',
            },
          ],
        },
      ],
    });
    logger.info({ targetChannel, teamName }, 'Dispatched Slack integration welcome message');
  } catch (notifyErr: any) {
    logger.warn({ error: notifyErr.message }, 'Could not post Slack welcome message (non-blocking)');
  }

  logger.info({ userId, teamName, channelName }, 'Slack OAuth integration successful');
  return integration;
};

/**
 * Send Slack Notification when Sender Hits Rate Limit
 */
export const sendSlackRateLimitAlert = async (
  userId: string,
  senderEmail: string,
  currentCount: number,
  limit: number,
  rescheduledTo: Date,
  recipientEmail: string,
  queuedCount?: number
): Promise<boolean> => {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.isConnected) {
      logger.debug({ userId }, 'Slack integration not connected. Skipping alert.');
      return false;
    }

    // Decrypt bot token
    const token = decrypt(
      integration.encryptedBotToken,
      integration.iv,
      integration.authTag
    );

    const client = new WebClient(token);

    const nextTimeStr = rescheduledTo.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });

    const sentCountFormatted = Math.min(currentCount, limit);
    const pendingText = typeof queuedCount === 'number' ? `${queuedCount} emails` : 'Remaining batch';

    await client.chat.postMessage({
      channel: integration.channelId,
      text: `ReachInbox Rate Limit Triggered: Sender ${senderEmail} reached ${sentCountFormatted}/${limit} emails. Dispatches will resume at ${nextTimeStr}. (${pendingText} queued for next window).`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'ReachInbox Rate Limit Triggered',
            emoji: false,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n<mailto:${senderEmail}|${senderEmail}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${limit} emails`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${sentCountFormatted} / ${limit} emails sent`,
            },
            {
              type: 'mrkdwn',
              text: `*Queued / Pending:*\n${typeof queuedCount === 'number' ? `${queuedCount} emails waiting in queue` : 'Queued for next window'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Resuming:*\n*${nextTimeStr}*`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '*Distributed Hour-Aligned Rate Limiter:* Remaining emails are safely queued and scheduled for the next hourly window without dropping.',
            },
          ],
        },
      ],
    });

    logger.info({ userId, senderEmail, channelId: integration.channelId, queuedCount }, 'Slack rate-limit alert dispatched');
    return true;
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Failed to send Slack alert (non-blocking)');
    return false;
  }
};
