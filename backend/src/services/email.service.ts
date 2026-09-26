import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter: Transporter | null = null;

export interface EmailAttachment {
  filename: string;
  content?: string; // base64 or raw string
  path?: string;
  contentType?: string;
  encoding?: string;
  size?: number;
}

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
}

/**
 * Initialize or get Ethereal SMTP Transporter
 */
export const getEmailTransporter = async (): Promise<Transporter> => {
  if (transporter) {
    return transporter;
  }

  let user = env.ETHEREAL_USER;
  let pass = env.ETHEREAL_PASS;
  let host = env.ETHEREAL_HOST;
  let port = env.ETHEREAL_PORT;

  // Auto-generate test Ethereal account if not provided
  if (!user || !pass) {
    logger.info('Creating dynamic Ethereal test account for SMTP...');
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    host = testAccount.smtp.host;
    port = testAccount.smtp.port;
    logger.info({ user, host, port }, 'Dynamic Ethereal test account created');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

/**
 * Send email via Ethereal SMTP
 */
export const sendEmail = async (options: SendMailOptions): Promise<SendMailResult> => {
  const mailer = await getEmailTransporter();

  // Convert base64 attachments if present
  const formattedAttachments = options.attachments?.map((att) => {
    if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
      // Data URI: data:image/png;base64,iVBORw0KGgo...
      const matches = att.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[2]) {
        return {
          filename: att.filename,
          content: Buffer.from(matches[2], 'base64'),
          contentType: matches[1] || att.contentType,
        };
      }
    }
    return {
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    };
  });

  const info = await mailer.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: formattedAttachments,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  logger.info(
    {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      attachmentsCount: options.attachments?.length || 0,
      previewUrl,
    },
    'Email sent via Ethereal SMTP'
  );

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  };
};
