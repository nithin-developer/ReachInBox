const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  senderAccounts: SenderAccount[];
  slackIntegration?: SlackIntegration | null;
}

export interface SenderAccount {
  id: string;
  email: string;
  name?: string | null;
  hourlyLimit: number;
}

export interface SlackIntegration {
  id: string;
  teamId: string;
  teamName?: string | null;
  channelId: string;
  channelName?: string | null;
  isConnected: boolean;
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
  size?: number;
}

export interface EmailItem {
  id: string;
  campaignId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[] | null;
  status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'RESCHEDULED' | 'FAILED';
  scheduledFor: string;
  sentAt?: string | null;
  rescheduledAt?: string | null;
  isStarred: boolean;
  etherealPreviewUrl?: string | null;
  lastError?: string | null;
  createdAt: string;
  campaign?: {
    id: string;
    name: string;
  };
}

export interface DashboardMetrics {
  scheduledCount: number;
  sentCount: number;
  sentThisHour?: number;
  hourlyLimit?: number;
  sentWeekCount?: number;
  sentMonthCount?: number;
}

export interface ScheduleCampaignPayload {
  name?: string;
  subject: string;
  body: string;
  recipients: string[];
  attachments?: EmailAttachment[];
  senderAccountId?: string;
  scheduledStartTime?: string;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  getMe: () => request<{ user: User }>('/auth/me'),
  getGoogleAuthUrl: () => request<{ url: string }>('/auth/google/url'),
  devLogin: () => request<{ user: User }>('/auth/dev-login', { method: 'POST' }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // Slack
  getSlackAuthUrl: () => request<{ url: string }>('/slack/auth-url'),
  getSlackStatus: () => request<{ isConnected: boolean; integration: SlackIntegration | null }>('/slack/status'),
  disconnectSlack: () => request<{ message: string }>('/slack/disconnect', { method: 'POST' }),

  // Campaigns & Emails
  scheduleCampaign: (payload: ScheduleCampaignPayload) =>
    request<{ message: string; data: any }>('/campaigns/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getScheduledEmails: (params: { page?: number; limit?: number; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    q.append('limit', (params.limit || 500).toString());
    if (params.search) q.append('search', params.search);
    return request<{ items: EmailItem[]; pagination: any }>(`/emails/scheduled?${q.toString()}`);
  },
  getSentEmails: (params: { page?: number; limit?: number; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    q.append('limit', (params.limit || 500).toString());
    if (params.search) q.append('search', params.search);
    return request<{ items: EmailItem[]; pagination: any }>(`/emails/sent?${q.toString()}`);
  },
  getEmailDetail: (id: string) => request<{ email: EmailItem }>(`/emails/${id}`),
  toggleStar: (id: string) => request<{ email: EmailItem }>(`/emails/${id}/star`, { method: 'PATCH' }),
  getMetrics: () => request<DashboardMetrics>('/emails/metrics'),
  searchEmails: (query: string, status?: string) => {
    const q = new URLSearchParams({ q: query, limit: '500' });
    if (status) q.append('status', status);
    return request<{ source: string; items: EmailItem[]; pagination: any }>(`/emails/search?${q.toString()}`);
  },
};
