import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { EmailItem } from '@/lib/api';
import {
  IconClock,
  IconPaperclip,
  IconExternalLink,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';

export interface EmailListItemProps {
  email: EmailItem;
  activeTab: 'scheduled' | 'sent';
  onSelect: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}

export const EmailListItem: React.FC<EmailListItemProps> = ({
  email,
  activeTab,
  onSelect,
  onToggleStar,
}) => {
  const formatScheduledTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      onClick={onSelect}
      className="group flex items-center justify-between px-4 py-3 rounded-xl border border-border/50 hover:border-ring/60 bg-card hover:shadow-xs transition-all cursor-pointer"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
        {/* Recipient */}
        <div className="w-44 shrink-0 text-sm font-bold text-foreground truncate">
          To: {email.recipientEmail.split('@')[0]}
        </div>

        {/* Status Pill Badge */}
        {activeTab === 'scheduled' ? (
          email.status === 'RESCHEDULED' ? (
            <Badge variant="rescheduled" className="shrink-0 flex items-center gap-1.5 text-xs py-1">
              <IconClock className="h-3.5 w-3.5" />
              <span>Rescheduled: {formatScheduledTime(email.scheduledFor)}</span>
            </Badge>
          ) : (
            <Badge variant="scheduled" className="shrink-0 flex items-center gap-1.5 text-xs py-1">
              <IconClock className="h-3.5 w-3.5" />
              <span>{formatScheduledTime(email.scheduledFor)}</span>
            </Badge>
          )
        ) : (
          <Badge variant="sent" className="shrink-0 text-xs font-semibold py-1">
            Sent
          </Badge>
        )}

        {/* Subject & Snippet Preview */}
        <div className="flex items-center gap-2 truncate text-sm">
          <span className="font-bold text-foreground truncate text-sm">
            {email.subject}
          </span>
          <span className="text-muted-foreground truncate text-sm">
            - {email.body.replace(/<[^>]*>?/gm, '').slice(0, 90)}...
          </span>
        </div>

        {/* Real Attachments Indicator */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="shrink-0 flex items-center gap-1 text-muted-foreground text-xs bg-muted/60 px-2.5 py-1 rounded-md">
            <IconPaperclip className="h-3.5 w-3.5" />
            <span>{email.attachments.length}</span>
          </div>
        )}
      </div>

      {/* Actions: Ethereal Link + Star */}
      <div className="flex items-center gap-3 shrink-0">
        {email.etherealPreviewUrl && (
          <a
            href={email.etherealPreviewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open Ethereal HTML Preview"
            className="text-xs text-muted-foreground hover:text-emerald-600 p-1 transition-colors"
          >
            <IconExternalLink className="h-4 w-4" />
          </a>
        )}

        <button
          onClick={onToggleStar}
          className="p-1 rounded text-muted-foreground/40 hover:text-amber-500 transition-colors focus:outline-none"
        >
          {email.isStarred ? (
            <IconStarFilled className="h-4 w-4 text-amber-500 fill-amber-500" />
          ) : (
            <IconStar className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
};
