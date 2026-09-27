import React from 'react';
import { Button } from '@/components/ui/button';
import {
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';

export interface AlertModalProps {
  isOpen: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  type = 'info',
  title,
  description,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <IconCheck className="h-6 w-6" />
          </div>
        );
      case 'error':
        return (
          <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 flex items-center justify-center">
            <IconX className="h-6 w-6" />
          </div>
        );
      case 'warning':
        return (
          <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <IconAlertTriangle className="h-6 w-6" />
          </div>
        );
      default:
        return (
          <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center">
            <IconInfoCircle className="h-6 w-6" />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-foreground">
        <div className="flex flex-col items-center text-center space-y-4">
          {getIcon()}

          <div className="space-y-1.5">
            <h3 className="font-heading text-lg font-bold text-foreground tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">{description}</p>
          </div>

          <div className="flex items-center gap-3 w-full pt-2">
            {cancelText && (
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-xl h-10 text-sm font-semibold"
              >
                {cancelText}
              </Button>
            )}

            <Button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className={`flex-1 rounded-xl h-10 text-sm font-semibold ${
                type === 'error'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#009A49] hover:bg-[#00823e] text-white'
              }`}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
