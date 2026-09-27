import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { api, type EmailItem } from '@/lib/api';
import { EmailDetailView } from '@/components/email/EmailDetailView';
import { Skeleton } from '@/components/ui/skeleton';

export const EmailDetailPage: React.FC = () => {
  const { emailId } = useParams<{ emailId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<EmailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!emailId) return;

    setLoading(true);
    api
      .getEmailDetail(emailId)
      .then((res) => {
        setEmail(res.email);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching email details', err);
        setError(err.message || 'Email not found');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [emailId]);

  const handleToggleStar = async (id: string) => {
    try {
      const res = await api.toggleStar(id);
      if (email && email.id === id) {
        setEmail({ ...email, isStarred: res.email.isStarred });
      }
    } catch (err) {
      console.error('Error toggling star', err);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard/scheduled');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center justify-between pb-4 border-b border-border/80">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-6">
          <div className="flex items-center gap-3.5 pb-4 border-b border-border/60">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <h2 className="text-xl font-bold font-heading text-foreground">Email Not Found</h2>
        <p className="text-sm text-muted-foreground">{error || 'Could not find the requested email.'}</p>
        <button
          onClick={() => navigate('/dashboard/scheduled')}
          className="text-sm font-semibold text-emerald-600 hover:underline"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <EmailDetailView
      email={email}
      user={user}
      onBack={handleBack}
      onToggleStar={() => handleToggleStar(email.id)}
    />
  );
};
