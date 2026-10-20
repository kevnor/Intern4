import { Link } from 'react-router-dom';
import { SHIFT_PATHS } from '../paths';
import type { VaktSummary } from '../vaktSummary';
import { formatHours } from '../../../shared/utils/date';
import { cn } from '../../../shared/utils/cn';

type VaktProgressProps = {
  summary: VaktSummary;
  // Links to the user's own shifts; leave out when showing someone else's progress.
  showLink?: boolean;
  className?: string;
};

// Finished vakt hours against the requirement, in the same style as the regi progress.
export const VaktProgress = ({ summary, showLink = false, className }: VaktProgressProps) => {
  const progress = summary.required > 0 ? Math.min(summary.done / summary.required, 1) : 1;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <p className="text-3xl font-bold tabular-nums">
          {formatHours(summary.done)}
          {summary.required > 0 && (
            <span className="text-lg font-medium text-subtle">
              {' '}
              / {formatHours(summary.required)}
            </span>
          )}
        </p>
        <p className="text-sm text-muted">
          {summary.required === 0
            ? 'Ingen krav'
            : summary.remaining === 0
              ? 'Kravet er oppfylt'
              : `${formatHours(summary.remaining)} igjen`}
        </p>
      </div>
      {summary.required > 0 && (
        <div
          role="meter"
          aria-label="Vakttimer av kravet"
          aria-valuemin={0}
          aria-valuemax={summary.required}
          aria-valuenow={Math.min(summary.done, summary.required)}
          className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className={cn('h-full rounded-full', progress >= 1 ? 'bg-success' : 'bg-primary')}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {showLink && (
        <Link
          to={SHIFT_PATHS.MINE}
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Se vaktene dine
        </Link>
      )}
    </div>
  );
};
