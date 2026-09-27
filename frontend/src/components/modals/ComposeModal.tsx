import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { AlertModal, type AlertModalProps } from '@/components/modals/AlertModal';
import { api, type User } from '@/lib/api';
import { useClickOutside } from '@/hooks/use-click-outside';
import {
  IconX,
  IconPaperclip,
  IconClock,
  IconFileSpreadsheet,
  IconDownload,
  IconSend,
  IconFileText,
  IconTrash,
} from '@tabler/icons-react';

export interface EmailAttachmentData {
  filename: string;
  content: string; // base64 data URI
  contentType?: string;
  size?: number;
}

export interface ComposeModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onScheduledSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  user,
  isOpen,
  onClose,
  onScheduledSuccess,
}) => {
  const [senderAccount, setSenderAccount] = useState(
    user.senderAccounts[0]?.email || user.email
  );
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(
    user.senderAccounts[0]?.hourlyLimit || 50
  );
  const [scheduledStartTime, setScheduledStartTime] = useState<string>('');
  const [showSendLater, setShowSendLater] = useState(false);
  const [customDateTime, setCustomDateTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  // Real attachments state
  const [attachments, setAttachments] = useState<EmailAttachmentData[]>([]);

  // Alert Dialog state (replacing browser alerts)
  const [alertState, setAlertState] = useState<Omit<AlertModalProps, 'onClose'> | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const popoverRef = useClickOutside<HTMLDivElement>(() => setShowSendLater(false));

  const resetForm = () => {
    setSenderAccount(user.senderAccounts[0]?.email || user.email);
    setRecipientInput('');
    setRecipients([]);
    setSubject('');
    setBodyHtml('<p></p>');
    setDelaySeconds(2);
    setHourlyLimit(user.senderAccounts[0]?.hourlyLimit || 20);
    setScheduledStartTime('');
    setShowSendLater(false);
    setCustomDateTime('');
    setCsvFileName(null);
    setAttachments([]);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Download Sample CSV Helper
  const handleDownloadSampleCsv = () => {
    const sampleCsvContent = `First Name,Last Name,Email,Company
Alex,Morgan,alex.morgan@acmecorp.io,Acme Corp
Sophia,Chen,sophia.chen@techscale.dev,TechScale
Marcus,Vance,marcus.vance@innovateflow.ai,InnovateFlow
Elena,Rostova,elena.rostova@cloudscale.net,CloudScale`;

    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const showAlert = (
    title: string,
    description: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    onConfirm?: () => void
  ) => {
    setAlertState({
      isOpen: true,
      title,
      description,
      type,
      onConfirm,
    });
  };

  // Handle CSV upload for lead recipients
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    Papa.parse(file, {
      complete: (results) => {
        const emails: string[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        results.data.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              const val = String(cell).trim();
              if (emailRegex.test(val) && !emails.includes(val)) {
                emails.push(val);
              }
            });
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((cell) => {
              const val = String(cell).trim();
              if (emailRegex.test(val) && !emails.includes(val)) {
                emails.push(val);
              }
            });
          }
        });

        if (emails.length > 0) {
          setRecipients((prev) => {
            const combined = Array.from(new Set([...prev, ...emails]));
            return combined;
          });
          showAlert('Leads Imported', `Imported ${emails.length} recipients from ${file.name}`, 'success');
        } else {
          showAlert('Invalid CSV', 'Could not detect any valid email addresses in the CSV file.', 'warning');
        }
      },
      error: (err) => {
        showAlert('CSV Parse Error', err.message, 'error');
      },
    });

    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  // Add tag manually
  const handleAddRecipient = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = recipientInput.trim().replace(/,$/, '');
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        if (!recipients.includes(val)) {
          setRecipients([...recipients, val]);
        }
        setRecipientInput('');
      }
    }
  };

  const removeRecipient = (emailToRemove: string) => {
    setRecipients(recipients.filter((r) => r !== emailToRemove));
  };

  // Real File Attachments Handler
  const handleFileAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      // 10MB limit per file check
      if (file.size > 10 * 1024 * 1024) {
        showAlert('File Too Large', `"${file.name}" exceeds 10MB limit.`, 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Quick preset helper
  const handleSetPresetTime = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    setScheduledStartTime(target.toISOString());
    setShowSendLater(false);
  };

  const handleApplyCustomTime = () => {
    if (!customDateTime) {
      showAlert('Time Required', 'Please select a valid date and time.', 'warning');
      return;
    }
    const d = new Date(customDateTime);
    if (isNaN(d.getTime())) {
      showAlert('Invalid Date', 'The selected date/time is invalid.', 'error');
      return;
    }
    setScheduledStartTime(d.toISOString());
    setShowSendLater(false);
  };

  // Submit Schedule Campaign
  const handleScheduleSubmit = async () => {
    // Add current typed recipient if valid
    let finalRecipients = [...recipients];
    const pendingVal = recipientInput.trim().replace(/,$/, '');
    if (pendingVal && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingVal)) {
      if (!finalRecipients.includes(pendingVal)) {
        finalRecipients.push(pendingVal);
      }
    }

    if (finalRecipients.length === 0) {
      showAlert('Recipients Required', 'Please provide at least one recipient email address.', 'warning');
      return;
    }

    if (!subject.trim()) {
      showAlert('Subject Required', 'Please enter an email subject line.', 'warning');
      return;
    }

    if (!bodyHtml || bodyHtml === '<p></p>') {
      showAlert('Content Required', 'Please write the email body before scheduling.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: subject.trim().slice(0, 50) || 'Untitled Campaign',
        senderEmail: senderAccount,
        subject: subject.trim(),
        body: bodyHtml,
        recipients: finalRecipients,
        delayBetweenEmailsSeconds: delaySeconds,
        hourlyLimit,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      if (scheduledStartTime) {
        payload.scheduledStartTime = scheduledStartTime;
      }

      await api.scheduleCampaign(payload);

      showAlert(
        'Campaign Scheduled',
        `Successfully enqueued ${finalRecipients.length} emails with a ${delaySeconds}s delay.`,
        'success',
        () => {
          resetForm();
          onScheduledSuccess();
          onClose();
        }
      );
    } catch (err: any) {
      showAlert('Scheduling Error', err.message || 'Failed to schedule campaign', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/20 shrink-0">
            <h2 className="font-heading font-bold text-lg text-foreground tracking-tight">
              Compose Campaign
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sans">
            {/* From Sender Account */}
            <div className="flex items-center gap-3 border-b border-border/60 pb-3">
              <span className="text-sm font-semibold text-muted-foreground w-16 shrink-0">
                From:
              </span>
              <div className="flex-1">
                <select
                  value={senderAccount}
                  onChange={(e) => setSenderAccount(e.target.value)}
                  className="w-full text-sm font-medium bg-transparent border-0 text-foreground focus:ring-0 focus:outline-none cursor-pointer"
                >
                  {user.senderAccounts && user.senderAccounts.length > 0 ? (
                    user.senderAccounts.map((acc) => (
                      <option key={acc.id} value={acc.email} className="bg-card text-foreground">
                        {acc.name ? `${acc.name} <${acc.email}>` : acc.email}
                      </option>
                    ))
                  ) : (
                    <option value={user.email} className="bg-card text-foreground">
                      {user.name} &lt;{user.email}&gt;
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* To Recipients + CSV Actions (Upload + Download Sample) */}
            <div className="border-b border-border/60 pb-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted-foreground w-16 shrink-0">
                  To:
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={csvInputRef}
                    onChange={handleCsvUpload}
                    accept=".csv"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSampleCsv}
                    className="h-8 text-xs font-medium rounded-lg flex items-center gap-1.5 border-border hover:bg-muted/80 text-foreground transition-colors"
                    title="Download template CSV with required lead columns"
                  >
                    <IconDownload className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Download Sample CSV</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => csvInputRef.current?.click()}
                    className="h-8 text-xs font-semibold rounded-lg flex items-center gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                  >
                    <IconFileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span>Upload CSV Leads</span>
                  </Button>
                </div>
              </div>

              {/* Recipients Pills + Input */}
              <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-xl bg-muted/30 border border-border/60">
                {recipients.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="hover:text-destructive transition-colors focus:outline-none"
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}

                <input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={handleAddRecipient}
                  placeholder={
                    recipients.length === 0
                      ? 'Type email and press Enter (or upload CSV)...'
                      : 'Add more...'
                  }
                  className="flex-1 min-w-[180px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 border-0 focus:outline-none focus:ring-0 p-1"
                />
              </div>

              {csvFileName && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Imported from: {csvFileName}
                </p>
              )}
            </div>

            {/* Subject Input */}
            <div className="flex items-center gap-3 border-b border-border/60 pb-3">
              <span className="text-sm font-semibold text-muted-foreground w-16 shrink-0">
                Subject:
              </span>
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter compelling campaign subject..."
                className="flex-1 h-9 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Delay & Rate Limiting Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-muted/40 border border-border/60 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Delay between emails:</span>
                <Input
                  type="number"
                  min="0"
                  max="3600"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-16 h-8 text-center text-sm font-medium"
                />
                <span className="text-muted-foreground">sec</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Hourly limit:</span>
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 50)}
                  className="w-20 h-8 text-center text-sm font-medium"
                />
                <span className="text-muted-foreground">emails/hr</span>
              </div>
            </div>

            {/* Real Attachments Chip List */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 border-b border-border/60 pb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Attached Files ({attachments.length})
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground"
                    >
                      <IconFileText className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium max-w-[160px] truncate">{att.filename}</span>
                      <span className="text-xs text-muted-foreground">({formatFileSize(att.size)})</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1 focus:outline-none"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TipTap Rich Text Editor */}
            <div className="space-y-1">
              <TipTapEditor
                content={bodyHtml}
                onChange={(html) => setBodyHtml(html)}
                placeholder="Write your cold email content here..."
              />
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="px-6 py-4 border-t border-border/80 bg-muted/20 flex items-center justify-between shrink-0">
            {/* Left: Attach File Action Button */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={attachmentInputRef}
                onChange={handleFileAttachment}
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => attachmentInputRef.current?.click()}
                className="h-9 rounded-xl text-sm font-semibold flex items-center gap-1.5"
              >
                <IconPaperclip className="h-4 w-4 text-muted-foreground" />
                <span>Attach Files</span>
              </Button>
            </div>

            {/* Right: Send Later Popover + Schedule Submit */}
            <div className="relative flex items-center gap-2" ref={popoverRef}>
              {/* Send Later Timing Popover */}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSendLater(!showSendLater)}
                  className={`h-9 rounded-xl text-sm font-semibold flex items-center gap-1.5 ${
                    scheduledStartTime ? 'border-emerald-600 text-emerald-600' : ''
                  }`}
                >
                  <IconClock className="h-4 w-4" />
                  <span>
                    {scheduledStartTime
                      ? `Starts: ${new Date(scheduledStartTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}`
                      : 'Send Later'}
                  </span>
                </Button>

                {showSendLater && (
                  <div className="absolute right-0 bottom-full mb-2 w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl z-50 animate-in fade-in-50 zoom-in-95 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <h4 className="text-sm font-bold text-foreground">Schedule Start Time</h4>
                      <button
                        onClick={() => setShowSendLater(false)}
                        className="text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        <IconX className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Presets
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPresetTime(10)}
                          className="h-8 text-xs"
                        >
                          In 10 mins
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPresetTime(30)}
                          className="h-8 text-xs"
                        >
                          In 30 mins
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPresetTime(60)}
                          className="h-8 text-xs"
                        >
                          In 1 hour
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPresetTime(120)}
                          className="h-8 text-xs"
                        >
                          In 2 hours
                        </Button>
                      </div>
                    </div>

                    {/* Custom DateTime Picker */}
                    <div className="space-y-1.5 pt-1 border-t border-border/60">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Custom Date & Time
                      </span>
                      <Input
                        type="datetime-local"
                        value={customDateTime}
                        onChange={(e) => setCustomDateTime(e.target.value)}
                        className="h-9 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={handleApplyCustomTime}
                        className="w-full h-9 text-xs font-semibold bg-[#009A49] hover:bg-[#00823e] text-white rounded-lg"
                      >
                        Apply Time
                      </Button>
                    </div>

                    {scheduledStartTime && (
                      <button
                        onClick={() => {
                          setScheduledStartTime('');
                          setShowSendLater(false);
                        }}
                        className="w-full text-center text-xs text-destructive hover:underline pt-1 focus:outline-none"
                      >
                        Clear Schedule (Send Now)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Main Submit Button */}
              <Button
                type="button"
                onClick={handleScheduleSubmit}
                disabled={isSubmitting}
                className="h-9 px-5 rounded-xl bg-[#009A49] hover:bg-[#00823e] text-white font-heading font-semibold text-sm shadow-md flex items-center gap-1.5 transition-all"
              >
                <IconSend className="h-4 w-4" />
                <span>{isSubmitting ? 'Enqueuing...' : 'Schedule Campaign'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Modal */}
      {alertState && (
        <AlertModal
          isOpen={true}
          title={alertState.title}
          description={alertState.description}
          type={alertState.type}
          confirmText={alertState.confirmText}
          cancelText={alertState.cancelText}
          onConfirm={alertState.onConfirm}
          onClose={() => setAlertState(null)}
        />
      )}
    </>
  );
};
