import { SLOT_LABELS, SLOT_NAMES } from '../slots';
import type { Shift } from '../types';
import { cn } from '../../../shared/utils/cn';

type ShiftChipProps = {
  shift: Shift;
  mine?: boolean;
  // Makes the chip a button, e.g. for the Vaktsjef to change who has the shift.
  onSelect?: (shift: Shift) => void;
  className?: string;
};

// One shift in a calendar cell: the time slot and, if it is taken, who has it.
export const ShiftChip = ({ shift, mine, onSelect, className }: ShiftChipProps) => {
  const Element = onSelect ? 'button' : 'div';
  return (
    <Element
      {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(shift) } : {})}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-sm',
        onSelect && 'text-left hover:border-primary focus-visible:outline-2',
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
    </Element>
  );
};
