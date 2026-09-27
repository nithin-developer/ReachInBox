import React from 'react';
import { type EmailItem, type User } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
  IconArrowLeft,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconExternalLink,
  IconFileText,
  IconMail,
} from '@tabler/icons-react';

export interface EmailDetailViewProps {
  email: EmailItem;
  user?: User | null;
  onBack: () => void;
  onToggleStar: (id: string) => void;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({
  email,
  user,
  onBack,
  onToggleStar,
}) => {
  const formattedDate = email.sentAt
    ? new Date(email.sentAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : new Date(email.scheduledFor).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  const getStatusBadge = () => {
    switch (email.status) {
      case 'SENT':
        return <Badge variant="sent">Sent</Badge>;
      case 'SCHEDULED':
        return <Badge variant="scheduled">Scheduled</Badge>;
      case 'RESCHEDULED':
        return <Badge variant="rescheduled">Rescheduled</Badge>;
      case 'FAILED':
        return <Badge variant="failed">Failed</Badge>;
      default:
        return <Badge variant="outline">{email.status}</Badge>;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isImageFile = (filename: string, contentType?: string) => {
    return (
      contentType?.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)
    );
  };

  // Resolve sender name and avatar
  const senderAccount = user?.senderAccounts?.find((a) => a.email === email.senderEmail);
  const senderName = senderAccount?.name || user?.name || email.senderEmail.split('@')[0];
  const senderAvatar = user?.avatarUrl;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8 font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-border/80">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
            title="Back to email list"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground truncate max-w-lg">
              {email.subject}
            </h1>
            {getStatusBadge()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleStar(email.id)}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
            title={email.isStarred ? 'Unstar' : 'Star'}
          >
            {email.isStarred ? (
              <IconStarFilled className="h-5 w-5 text-amber-500 fill-amber-500" />
            ) : (
              <IconStar className="h-5 w-5" />
            )}
          </button>
          <button
            className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus:outline-none"
            title="Delete"
          >
            <IconTrash className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Email Content Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
        {/* Sender Info Row */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-3.5">
            {/* Real Avatar of User or Sender Initial Circle */}
            {senderAvatar ? (
              <img
                src={senderAvatar}
                alt={senderName}
                className="h-11 w-11 rounded-full object-cover border border-border shadow-2xs shrink-0"
              />
            ) : (
              <div className="h-11 w-11 rounded-full bg-[#009A49] text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0">
                {senderName.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-foreground">{senderName}</span>
                <span className="text-sm text-muted-foreground">to {email.recipientEmail}</span>
              </div>
              <p className="text-xs text-muted-foreground">{email.senderEmail}</p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground font-medium">{formattedDate}</div>
        </div>

        {/* Ethereal SMTP Link Banner (if sent) */}
        {email.etherealPreviewUrl && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 text-sm text-emerald-900 dark:text-emerald-200">
              <IconMail className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <span className="font-bold">Delivered via Ethereal SMTP:</span> Inspect the live HTML rendering in Ethereal web inbox.
              </span>
            </div>
            <a
              href={email.etherealPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs shrink-0"
            >
              <span>View Ethereal Email</span>
              <IconExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

        {/* Subject Display Card */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Subject
          </span>
          <p className="text-base font-semibold text-foreground">{email.subject}</p>
        </div>

        {/* Message Body Content */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Message Body
          </span>
          <div
            className="prose dark:prose-invert max-w-none text-base leading-relaxed text-foreground p-5 rounded-xl bg-background border border-border/50"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />
        </div>

        {/* Real Attachments Section (Only shown if real attachments exist) */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="pt-4 border-t border-border/80">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Attachments ({email.attachments.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {email.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-xs hover:border-ring/60 transition-all flex flex-col justify-between"
                >
                  {isImageFile(att.filename, att.contentType) && att.content ? (
                    <div className="h-28 bg-muted/30 flex items-center justify-center overflow-hidden border-b border-border/60">
                      <img
                        src={att.content}
                        alt={att.filename}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-24 bg-muted/40 flex items-center justify-center text-muted-foreground border-b border-border/60">
                      <IconFileText className="h-10 w-10 text-emerald-600" />
                    </div>
                  )}

                  <div className="p-3 flex items-center justify-between">
                    <div className="truncate pr-2">
                      <p className="text-xs font-semibold text-foreground truncate">{att.filename}</p>
                      <p className="text-[11px] text-muted-foreground">{formatFileSize(att.size)}</p>
                    </div>

                    {att.content && (
                      <a
                        href={att.content}
                        download={att.filename}
                        className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors focus:outline-none"
                        title="Download Attachment"
                      >
                        <IconExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
