import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useClickOutside } from '@/hooks/use-click-outside';
import type { User, SlackIntegration } from '@/lib/api';
import {
  IconSearch,
  IconX,
  IconRefresh,
  IconChevronDown,
  IconBrandSlack,
  IconExternalLink,
  IconLogout,
  IconReportAnalytics,
} from '@tabler/icons-react';

export interface HeaderProps {
  user: User;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  slackStatus: SlackIntegration | null;
  onConnectSlack: () => void;
  onDisconnectSlack: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  searchQuery,
  onSearchChange,
  onRefresh,
  slackStatus,
  onConnectSlack,
  onDisconnectSlack,
  onLogout,
}) => {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = useClickOutside<HTMLDivElement>(() => setUserMenuOpen(false));

  const queueDashboardUrl =
    (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') +
    '/admin/queues';

  // Local state for immediate typing response
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Sync if external searchQuery changes
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounced notification to parent
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [localSearch, searchQuery, onSearchChange]);

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  return (
    <header className="h-16 border-b border-border/80 px-6 flex items-center justify-between bg-card shrink-0 select-none z-30">
      {/* Left: Brand / App Identifier */}
      <div className="flex items-center gap-8">
        <div className="flex items-center">
          <span className="font-heading font-black text-xl md:text-2xl tracking-tight text-foreground select-none">
            ReachInbox
          </span>
        </div>

        {/* Global Search Bar with Debouncing */}
        <div className="relative w-80 md:w-96">
          <div className="relative flex items-center">
            <IconSearch className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by recipient, subject, or content..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-16 text-sm rounded-full border border-border/70 bg-muted/30 focus:bg-background focus:outline-hidden focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground/60 transition-all shadow-2xs"
            />
            <div className="absolute right-3 flex items-center gap-1.5 text-muted-foreground">
              {localSearch && (
                <button
                  onClick={handleClear}
                  title="Clear search"
                  className="hover:text-foreground text-xs p-1 rounded transition-colors focus:outline-none"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={onRefresh}
                title="Refresh list"
                className="hover:text-foreground p-1 rounded transition-colors focus:outline-none"
              >
                <IconRefresh className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Slack Status + Theme Switcher + Profile Dropdown */}
      <div className="flex items-center gap-3">
        {/* Slack Integration Pill */}
        {slackStatus ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
            <IconBrandSlack className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{slackStatus.teamName || 'Slack'}</span>
            <span className="text-muted-foreground/80 text-xs">({slackStatus.channelName || '#general'})</span>
          </div>
        ) : (
          <Button
            onClick={onConnectSlack}
            size="sm"
            variant="outline"
            className="h-9 text-sm font-semibold rounded-full flex items-center gap-1.5 border-border hover:bg-muted text-foreground transition-all shadow-2xs px-3.5"
          >
            <IconBrandSlack className="h-4.5 w-4.5 text-muted-foreground" />
            <span>Connect Slack</span>
          </Button>
        )}

        {/* Theme Switcher Toggle */}
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 p-1 rounded-full hover:bg-muted/70 transition-colors text-left focus:outline-none cursor-pointer"
          >
            <img
              src={
                user.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
              }
              alt={user.name || 'User'}
              className="h-9 w-9 rounded-full object-cover border border-border shadow-2xs"
            />
            <div className="hidden md:block pr-1">
              <div className="text-sm font-bold leading-tight text-foreground">
                {user.name || 'Oliver Brown'}
              </div>
              <div className="text-xs text-muted-foreground leading-tight">
                {user.email}
              </div>
            </div>
            <IconChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Profile Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-xl z-50 animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-sm font-bold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              <div className="py-1.5 space-y-0.5">
                <a
                  href={queueDashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <IconReportAnalytics className="h-4.5 w-4.5 text-emerald-600" />
                    <span>BullMQ Dashboard</span>
                  </div>
                  <IconExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>

                {slackStatus ? (
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onDisconnectSlack();
                    }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
                  >
                    <IconBrandSlack className="h-4.5 w-4.5" />
                    <span>Disconnect Slack</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onConnectSlack();
                    }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition-colors flex items-center gap-2"
                  >
                    <IconBrandSlack className="h-4.5 w-4.5" />
                    <span>Connect Slack</span>
                  </button>
                )}
              </div>

              <div className="border-t border-border/60 pt-1.5">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <IconLogout className="h-4.5 w-4.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
