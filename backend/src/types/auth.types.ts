import { Request } from 'express';
import { User, SenderAccount } from '@prisma/client';

export interface SanitizedSlackIntegration {
  id: string;
  teamId: string;
  teamName: string | null;
  channelId: string;
  channelName: string | null;
  isConnected: boolean;
  createdAt: Date;
}

export interface AuthenticatedUser extends User {
  senderAccounts?: SenderAccount[];
  slackIntegration?: SanitizedSlackIntegration | null;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}
