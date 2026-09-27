import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, type EmailItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { type DashboardContextType } from '@/components/layout/DashboardLayout';
import {
  IconClock,
  IconCalendar,
  IconArrowRight,
  IconBolt,
  IconMail,
  IconPlus,
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconArrowsSort,
  IconChevronLeft,
  IconChevronRight,
  IconStar,
  IconStarFilled,
  IconPaperclip,
} from '@tabler/icons-react';

type SortField = 'recipientEmail' | 'subject' | 'scheduledFor' | 'status';
type SortDirection = 'asc' | 'desc';

export const ScheduledEmailsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    metrics,
    searchQuery,
    setSearchQuery,
    searchSource,
    setSearchSource,
    refreshAll,
    openCompose,
  } = useOutletContext<DashboardContextType>();

  const [items, setItems] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('scheduledFor');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchScheduledEmails = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await api.searchEmails(searchQuery.trim(), 'SCHEDULED_ALL');
        setItems(res.items);
        setSearchSource(res.source);
      } else {
        setSearchSource(null);
        const res = await api.getScheduledEmails();
        setItems(res.items);
      }
    } catch (err) {
      console.error('Error fetching scheduled emails', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, setSearchSource]);

  useEffect(() => {
    fetchScheduledEmails();
  }, [fetchScheduledEmails]);

  // Compute real metrics
  const scheduledCount = metrics.scheduledCount || items.length;
  const todayStr = new Date().toDateString();
  const todayCount = items.filter(
    (item) => new Date(item.scheduledFor).toDateString() === todayStr
  ).length;

  const nextEmail = items.length > 0 ? items[0] : null;
  const nextSendTime = nextEmail
    ? new Date(nextEmail.scheduledFor).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Ready';
  const nextRecipient = nextEmail ? nextEmail.recipientEmail : 'Queue ready';

  // Real Capacity metrics
  const sentThisHour = metrics.sentThisHour ?? 0;
  const hourlyLimit = metrics.hourlyLimit || 50;

  // Toggle star
  const handleToggleStar = async (emailId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.toggleStar(emailId);
      setItems((prev) =>
        prev.map((item) => (item.id === emailId ? { ...item, isStarred: res.email.isStarred } : item))
      );
    } catch (err) {
      console.error('Error toggling star', err);
    }
  };

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Sorted and paginated items
  const sortedItems = useMemo(() => {
    const list = [...items];
    return list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'scheduledFor') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedItems.slice(startIndex, startIndex + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const formatScheduledTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <IconArrowsSort className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />;
    }
    return sortDirection === 'asc' ? (
      <IconChevronUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
    ) : (
      <IconChevronDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8 font-sans">
      {/* Title & Refresh Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Scheduled Emails
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor emails waiting to be sent.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchScheduledEmails();
            refreshAll();
          }}
          disabled={loading}
          className="h-9 px-3.5 rounded-xl flex items-center gap-2 border-border hover:bg-muted text-foreground text-sm font-semibold transition-all shadow-2xs cursor-pointer"
          title="Refresh scheduled emails list"
        >
          <IconRefresh
            className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : 'text-muted-foreground'}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Real Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Scheduled */}
        <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-xs space-y-2 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-semibold">Scheduled</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IconClock className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {scheduledCount.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            <span>emails</span>
          </div>
        </div>

        {/* Card 2: Today */}
        <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-xs space-y-2 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-semibold">Today</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IconCalendar className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {todayCount.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            <span>emails</span>
          </div>
        </div>

        {/* Card 3: Next Send */}
        <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-xs space-y-2 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-semibold">Next Send</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <IconArrowRight className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{nextSendTime}</div>
          <div className="text-xs text-muted-foreground truncate" title={nextRecipient}>
            <span>{nextRecipient}</span>
          </div>
        </div>

        {/* Card 4: Real Capacity */}
        <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-xs space-y-2 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-semibold">Capacity</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <IconBolt className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {sentThisHour} / {hourlyLimit}
          </div>
          <div className="text-xs text-muted-foreground">
            <span>this hour</span>
          </div>
        </div>
      </div>

      {/* Search Active Banner */}
      {searchQuery && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/40 border border-border/70 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Search Results:</span>
            <span className="text-muted-foreground">
              Found {items.length} scheduled emails matching "{searchQuery}"
            </span>
            {searchSource && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                via {searchSource}
              </span>
            )}
          </div>
          <button
            onClick={() => setSearchQuery('')}
            className="text-sm text-emerald-600 hover:underline font-semibold focus:outline-none"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Table & Pagination Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-card animate-pulse"
            >
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-5 w-72 rounded-md" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center text-center space-y-3 rounded-2xl border border-dashed border-border/80 bg-card/50 p-8">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
            <IconMail className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading text-lg font-bold text-foreground">
              {searchQuery ? 'No matching scheduled emails found' : 'No scheduled emails yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery
                ? `We couldn't find any scheduled emails for "${searchQuery}". Try a different keyword.`
                : 'Create a new campaign to schedule emails with automatic delay and hour-aligned rate limiting.'}
            </p>
          </div>
          {!searchQuery && (
            <Button
              onClick={openCompose}
              className="rounded-xl bg-[#009A49] hover:bg-[#00823e] text-white text-sm font-semibold h-10 px-5 mt-2"
            >
              <IconPlus className="h-4 w-4 mr-2" />
              <span>Compose Campaign</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Shadcn/UI Sortable Table (without Sender column) */}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  onClick={() => handleSort('recipientEmail')}
                  className="cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Recipient</span>
                    {renderSortIcon('recipientEmail')}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort('subject')}
                  className="cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Subject & Content</span>
                    {renderSortIcon('subject')}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort('scheduledFor')}
                  className="cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Scheduled Time</span>
                    {renderSortIcon('scheduledFor')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((email) => (
                <TableRow
                  key={email.id}
                  onClick={() => navigate(`/dashboard/email/${email.id}`)}
                >
                  {/* Recipient */}
                  <TableCell className="font-semibold text-foreground max-w-[220px] truncate">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                        {email.recipientEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{email.recipientEmail}</span>
                    </div>
                  </TableCell>

                  {/* Subject & Preview */}
                  <TableCell className="max-w-[320px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-foreground truncate">{email.subject}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        - {email.body.replace(/<[^>]*>?/gm, '').slice(0, 60)}...
                      </span>
                      {email.attachments && email.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px] text-muted-foreground shrink-0">
                          <IconPaperclip className="h-3 w-3" />
                          {email.attachments.length}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Scheduled Date & Status Badge */}
                  <TableCell>
                    {email.status === 'RESCHEDULED' ? (
                      <Badge variant="rescheduled" className="flex items-center gap-1.5 text-xs py-1 w-fit">
                        <IconClock className="h-3.5 w-3.5 shrink-0" />
                        <span>Rescheduled: {formatScheduledTime(email.scheduledFor)}</span>
                      </Badge>
                    ) : (
                      <Badge variant="scheduled" className="flex items-center gap-1.5 text-xs py-1 w-fit">
                        <IconClock className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatScheduledTime(email.scheduledFor)}</span>
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions: Star button + View button */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleToggleStar(email.id, e)}
                        className="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors focus:outline-none cursor-pointer"
                        title={email.isStarred ? 'Unstar email' : 'Star email'}
                      >
                        {email.isStarred ? (
                          <IconStarFilled className="h-4 w-4 text-amber-500 fill-amber-500" />
                        ) : (
                          <IconStar className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/email/${email.id}`);
                        }}
                        className="h-8 px-3 rounded-xl border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-foreground text-xs font-semibold inline-flex items-center gap-1.5 group/btn transition-all shadow-2xs cursor-pointer"
                      >
                        <span>View</span>
                        <IconArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover/btn:text-emerald-600 dark:group-hover/btn:text-emerald-400 group-hover/btn:translate-x-0.5 transition-all" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-2 py-3 text-sm text-muted-foreground">
            {/* Range info */}
            <div>
              Showing{' '}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, sortedItems.length)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{sortedItems.length}</span> emails
            </div>

            {/* Pagination Actions */}
            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-lg border border-border/80 bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Prev / Next Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                >
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-2 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
