import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShiftChip } from './ShiftChip';
import {
  addDays,
  dayKey,
  formatDayMonth,
  formatWeekday,
  getWeekNumber,
  groupShiftsByDay,
  isSameDay,
  startOfWeek,
} from '../calendar';
import { getSlotTypesForDate } from '../slots';
import type { Shift } from '../types';
import { Badge, Button, Card, EmptyState, Skeleton } from '../../../shared/components';
import { cn } from '../../../shared/utils/cn';

type PlanTabProps = {
  shifts: Shift[];
  loading: boolean;
  userId: string;
  canManage: boolean;
  // Called when a shift the user can act on is picked: managers change any shift, residents can
  // ask for a swap on their own or take one that is up for swap.
  onSelectShift?: (shift: Shift) => void;
  canSelect?: (shift: Shift) => boolean;
  onCreateSlots: () => Promise<void>;
  now?: Date;
};

// The whole reception schedule, one week at a time.
const PlanTab = ({
  shifts,
  loading,
  userId,
  canManage,
  onSelectShift,
  canSelect = () => canManage,
  onCreateSlots,
  now = new Date(),
}: PlanTabProps) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [creating, setCreating] = useState(false);
  const byDay = useMemo(() => groupShiftsByDay(shifts), [shifts]);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const hasShifts = shifts.length > 0;
  const hasDrafts = shifts.some((shift) => shift.status === 'draft');

  const handleCreate = async () => {
    try {
      setCreating(true);
      await onCreateSlots();
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Skeleton className="h-96" />;

  if (!hasShifts) {
    return (
      <EmptyState
        title="Ingen vaktplan ennå"
        icon={<CalendarPlus aria-hidden="true" className="h-6 w-6" />}
        action={
          canManage ? (
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? 'Oppretter...' : 'Opprett vakter for semesteret'}
            </Button>
          ) : undefined
        }
      >
        {canManage
          ? 'Opprett tomme vakter for hele semesteret. Du kan fordele dem etterpå.'
          : 'Vaktsjefen har ikke publisert vaktplanen ennå.'}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Forrige uke"
            icon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setWeekStart((current) => addDays(current, -7))}
          />
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(now))}>
            I dag
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Neste uke"
            icon={<ChevronRight aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setWeekStart((current) => addDays(current, 7))}
          />
        </div>
        <h2 className="font-medium">
          Uke {getWeekNumber(weekStart)} · {formatDayMonth(days[0])} – {formatDayMonth(days[6])}
        </h2>
        {canManage && hasDrafts && <Badge tone="warning">Utkast – ikke synlig for beboere</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const dayShifts = byDay.get(dayKey(day)) ?? [];
          const today = isSameDay(day, now);
          return (
            <Card
              key={dayKey(day)}
              className={cn(today && 'ring-2 ring-primary')}
              bodyClassName="space-y-1.5 p-3"
            >
              <p className="flex items-baseline justify-between text-sm">
                <span className="font-medium capitalize">{formatWeekday(day)}</span>
                <span className="text-subtle">{formatDayMonth(day)}</span>
              </p>
              {dayShifts.length === 0
                ? getSlotTypesForDate(day).length > 0 && (
                    <p className="text-sm text-subtle">Ingen vakter</p>
                  )
                : dayShifts.map((shift) => (
                    <ShiftChip
                      key={shift.id}
                      shift={shift}
                      mine={shift.userId === userId}
                      onSelect={onSelectShift && canSelect(shift) ? onSelectShift : undefined}
                    />
                  ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PlanTab;
