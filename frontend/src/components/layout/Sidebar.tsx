import React from 'react';
import { Button } from '@/components/ui/button';
import { IconPlus, IconClock, IconSend } from '@tabler/icons-react';

export interface SidebarProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenCompose,
  scheduledCount,
  sentCount,
}) => {
  return (
    <aside className="w-64 border-r border-border/70 p-4 flex flex-col justify-between shrink-0 bg-sidebar">
      <div className="space-y-4">
        {/* Compose Action Button */}
        <Button
          onClick={onOpenCompose}
          className="w-full h-11 rounded-xl bg-[#009A49] hover:bg-[#00823e] text-white font-heading font-semibold shadow-md flex items-center justify-center gap-2 text-sm transition-all"
        >
          <IconPlus className="h-4 w-4 stroke-[2.5]" />
          <span>Compose Campaign</span>
        </Button>

        {/* Navigation Tabs */}
        <nav className="space-y-1.5 pt-2">
          <div className="pl-1 pb-2 pt-2 text-xs font-semibold text-muted-foreground">
            FEATURES
          </div>
          <button
            onClick={() => onTabChange('scheduled')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'scheduled'
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-[#009A49] dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <IconClock
                className={`h-4 w-4 ${
                  activeTab === 'scheduled'
                    ? 'text-[#009A49] dark:text-emerald-400 stroke-[2.5]'
                    : 'text-muted-foreground'
                }`}
              />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-sm px-2.5 py-0.5 rounded-full transition-colors ${
                activeTab === 'scheduled'
                  ? 'bg-[#009A49] text-white font-bold'
                  : 'bg-muted/80 border border-border/60 text-muted-foreground font-medium'
              }`}
            >
              {scheduledCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('sent')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'sent'
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-[#009A49] dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <IconSend
                className={`h-4.5 w-4.5 ${
                  activeTab === 'sent'
                    ? 'text-[#009A49] dark:text-emerald-400 stroke-[2.5]'
                    : 'text-muted-foreground'
                }`}
              />
              <span>Sent</span>
            </div>
            <span
              className={`text-sm px-2.5 py-0.5 rounded-full transition-colors ${
                activeTab === 'sent'
                  ? 'bg-[#009A49] text-white font-bold'
                  : 'bg-muted/80 border border-border/60 text-muted-foreground font-medium'
              }`}
            >
              {sentCount}
            </span>
          </button>
        </nav>
      </div>
    </aside>
  );
};
