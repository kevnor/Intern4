import { SLOT_LABELS, SLOT_NAMES } from '../slots';
import type { Shift } from '../types';
import { cn } from '../../../shared/utils/cn';

type ShiftChipProps = {
  shift: Shift;
  mine?: boolean;
  className?: string;
};

// One shift in a calendar cell: the time slot and, if it is taken, who has it.
export const ShiftChip = ({ shift, mine, className }: ShiftChipProps) => (
  <div
    className={cn(
      'flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-sm',
      mine
        ? 'border-primary bg-primary-subtle text-primary-subtle-fg'
        : shift.userId
          ? 'border-border bg-surface-muted text-fg'
          : 'border-dashed border-border-strong text-subtle',
      className
    )}
  >
    <span className="shrink-0 font-medium tabular-nums">
      <span className="sr-only">{SLOT_NAMES[shift.slotType]} </span>
      {SLOT_LABELS[shift.slotType]}
    </span>
    <span className="min-w-0 truncate text-right">
      {mine ? 'Deg' : (shift.userName ?? (shift.userId ? 'Opptatt' : 'Ledig'))}
    </span>
  </div>
);
