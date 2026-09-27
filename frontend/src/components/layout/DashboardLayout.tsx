import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { api, type DashboardMetrics, type SlackIntegration } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ComposeModal } from '@/components/modals/ComposeModal';
import { AlertModal } from '@/components/modals/AlertModal';

export interface DashboardContextType {
  metrics: DashboardMetrics;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchSource: string | null;
  setSearchSource: (s: string | null) => void;
  refreshAll: () => void;
  openCompose: () => void;
  showModal: (config: {
    type?: 'success' | 'error' | 'warning' | 'info';
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }) => void;
}

export const DashboardLayout: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({ scheduledCount: 0, sentCount: 0 });
  const [slackStatus, setSlackStatus] = useState<SlackIntegration | null>(null);

  // Determine active tab from pathname
  const activeTab: 'scheduled' | 'sent' = location.pathname.includes('/dashboard/sent')
    ? 'sent'
    : 'scheduled';

  // Alert & Confirmation Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type?: 'success' | 'error' | 'warning' | 'info';
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
  });

  const showModal = (config: Omit<typeof modalConfig, 'isOpen'>) => {
    setModalConfig({ ...config, isOpen: true });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Check URL parameters for Slack connection status on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackParam = params.get('slack');
    const msg = params.get('message');

    if (slackParam === 'connected') {
      showModal({
        type: 'success',
        title: 'Slack Workspace Connected',
        description:
          'Your Slack integration is now active. A professional welcome message has been dispatched to your channel, and real-time rate limit notifications will be sent automatically.',
        confirmText: 'Done',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      loadMetadata();
    } else if (slackParam === 'error') {
      showModal({
        type: 'error',
        title: 'Slack Connection Failed',
        description: msg ? decodeURIComponent(msg) : 'Could not complete the Slack authorization flow.',
        confirmText: 'Dismiss',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch metrics & Slack status
  const loadMetadata = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([
        api.getMetrics(),
        api.getSlackStatus().catch(() => ({ isConnected: false, integration: null })),
      ]);
      setMetrics(m);
      if (s.isConnected && s.integration) {
        setSlackStatus(s.integration);
      } else {
        setSlackStatus(null);
      }
    } catch (err) {
      console.error('Error fetching metadata', err);
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Connect Slack flow
  const handleConnectSlack = async () => {
    try {
      const { url } = await api.getSlackAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      showModal({
        type: 'error',
        title: 'Slack Connection Error',
        description: err.message || 'Failed to initiate Slack OAuth authorization.',
      });
    }
  };

  // Prompt confirmation modal before disconnecting Slack
  const handlePromptDisconnectSlack = () => {
    showModal({
      type: 'warning',
      title: 'Disconnect Slack Workspace?',
      description:
        'Are you sure you want to disconnect your Slack integration? You will no longer receive real-time rate limit alerts in your channel.',
      confirmText: 'Disconnect',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await api.disconnectSlack();
          setSlackStatus(null);
          refreshUser();
          showModal({
            type: 'success',
            title: 'Slack Disconnected',
            description: 'Your Slack workspace was disconnected successfully.',
          });
        } catch (err: any) {
          showModal({
            type: 'error',
            title: 'Disconnect Failed',
            description: err.message || 'Unable to disconnect Slack integration.',
          });
        }
      },
    });
  };

  const handleTabChange = (newTab: 'scheduled' | 'sent') => {
    setSearchQuery('');
    navigate(`/dashboard/${newTab}`);
  };

  if (!user) return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground font-sans antialiased overflow-hidden selection:bg-emerald-500/20">
      {/* Fixed Header at Top */}
      <Header
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={loadMetadata}
        slackStatus={slackStatus}
        onConnectSlack={handleConnectSlack}
        onDisconnectSlack={handlePromptDisconnectSlack}
        onLogout={logout}
      />

      {/* Main Container: Fixed Sidebar + Scrollable Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Fixed Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenCompose={() => setComposeOpen(true)}
          scheduledCount={metrics.scheduledCount}
          sentCount={metrics.sentCount}
        />

        {/* Scrollable Page Content Area */}
        <main className="flex-1 h-full overflow-y-auto p-6 bg-background">
          <Outlet
            context={{
              metrics,
              searchQuery,
              setSearchQuery,
              searchSource,
              setSearchSource,
              refreshAll: loadMetadata,
              openCompose: () => setComposeOpen(true),
              showModal,
            }}
          />
        </main>
      </div>

      {/* Reusable Compose Modal */}
      <ComposeModal
        user={user}
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduledSuccess={() => {
          loadMetadata();
        }}
      />

      {/* Alert & Confirmation Modal */}
      <AlertModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />
    </div>
  );
};
