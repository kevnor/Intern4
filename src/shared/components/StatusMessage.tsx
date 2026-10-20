import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../utils/cn';

type StatusTone = 'info' | 'success' | 'warning' | 'error';

const toneClasses: Record<StatusTone, string> = {
  info: 'border-info-border bg-info-subtle text-info-subtle-fg',
  success: 'border-success-border bg-success-subtle text-success-subtle-fg',
  warning: 'border-warning-border bg-warning-subtle text-warning-subtle-fg',
  error: 'border-danger-border bg-danger-subtle text-danger-subtle-fg',
};

const toneIcons: Record<StatusTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

type StatusMessageProps = {
  tone?: StatusTone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export const StatusMessage = ({
  tone = 'info',
  children,
  onDismiss,
  className,
}: StatusMessageProps) => {
  const Icon = toneIcons[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-sm',
        toneClasses[tone],
        className
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Lukk melding"
          className="-m-1 rounded p-1 opacity-70 hover:opacity-100"
        >
          <XCircle aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
