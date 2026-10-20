import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type StatTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const iconToneClasses: Record<StatTone, string> = {
  primary: 'bg-primary-subtle text-primary-subtle-fg',
  accent: 'bg-accent-subtle text-accent-subtle-fg',
  success: 'bg-success-subtle text-success-subtle-fg',
  warning: 'bg-warning-subtle text-warning-subtle-fg',
  danger: 'bg-danger-subtle text-danger-subtle-fg',
  info: 'bg-info-subtle text-info-subtle-fg',
  neutral: 'bg-surface-muted text-muted',
};

const barToneClasses: Record<StatTone, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-subtle',
};

type StatTileProps = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  // 0–1; renders a progress bar under the value.
  progress?: number;
  className?: string;
};

export const StatTile = ({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  progress,
  className,
}: StatTileProps) => (
  <div
    className={cn(
      'rounded-2xl border border-border bg-surface p-3 text-fg shadow-sm sm:p-4',
      className
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      </div>
      {icon && (
        <div
          aria-hidden="true"
          className={cn(
            'hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex',
            iconToneClasses[tone]
          )}
        >
          {icon}
        </div>
      )}
    </div>
    {progress !== undefined && (
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn('h-full rounded-full transition-[width]', barToneClasses[tone])}
          style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }}
        />
      </div>
    )}
    {hint && <p className="mt-2 text-xs text-subtle">{hint}</p>}
  </div>
);
