import { useMemo } from 'react';
import { CalendarClock, Clock } from 'lucide-react';
import { MonthCalendar } from './MonthCalendar';
import { SLOT_LABELS, SLOT_NAMES, SHIFT_HOURS } from '../slots';
import { formatDayMonth, formatWeekday, isSameDay, addDays } from '../calendar';
import type { Shift } from '../types';
import { getRequiredHoursForRole } from '../../../app/constants/regiRequirements';
import { canRequestSwap } from '../swaps';
import { Badge, Button, Card, EmptyState, Skeleton, StatTile } from '../../../shared/components';
import { formatHours } from '../../../shared/utils/date';

type MyShiftsTabProps = {
  shifts: Shift[];
  loading: boolean;
  userId: string;
  role?: string;
  totalHours: number;
  // Opens the swap dialog for one of my shifts.
  onSwap?: (shift: Shift) => void;
  now?: Date;
};

const dayBadge = (shift: Shift, now: Date) => {
  if (isSameDay(shift.startsAt, now)) return <Badge tone="primary">I dag</Badge>;
  if (isSameDay(shift.startsAt, addDays(now, 1))) return <Badge tone="info">I morgen</Badge>;
  return null;
};

const MyShiftsTab = ({
  shifts,
  loading,
  userId,
  role,
  totalHours,
  onSwap,
  now = new Date(),
}: MyShiftsTabProps) => {
  const mine = useMemo(() => shifts.filter((shift) => shift.userId === userId), [shifts, userId]);
  // A shift counts once it has ended.
  const done = mine.filter((shift) => shift.endsAt <= now);
  const upcoming = mine.filter((shift) => shift.endsAt > now);
  const doneHours = done.length * SHIFT_HOURS;
  const requiredVakt = getRequiredHoursForRole(role, totalHours).vakt;

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Vakttimer"
          value={formatHours(doneHours)}
          hint={
            requiredVakt > 0
              ? `av ${formatHours(requiredVakt)} dette semesteret`
              : 'Du har ikke vaktkrav dette semesteret.'
          }
          icon={<Clock aria-hidden="true" className="h-5 w-5" />}
          tone="primary"
        />
        <StatTile
          label="Neste vakt"
          value={
            upcoming[0]
              ? `${formatWeekday(upcoming[0].startsAt)} ${formatDayMonth(upcoming[0].startsAt)}`
              : 'Ingen'
          }
          hint={
            upcoming[0]
              ? `${SLOT_NAMES[upcoming[0].slotType]} ${SLOT_LABELS[upcoming[0].slotType]}`
              : `${upcoming.length} kommende vakter`
          }
          icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />}
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Kommende vakter" description={`${upcoming.length} gjenstår`}>
          {upcoming.length === 0 ? (
            <EmptyState title="Ingen kommende vakter">
              Du har ingen vakter planlagt. Vaktplanen vises her når den er publisert.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((shift) => (
                <li key={shift.id} className="flex items-center gap-3 py-3">
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-xs uppercase text-subtle">{formatWeekday(shift.startsAt)}</p>
                    <p className="text-lg font-semibold tabular-nums">{shift.startsAt.getDate()}</p>
                    <p className="text-xs text-subtle">
                      {shift.startsAt.toLocaleDateString('no-NO', { month: 'short' })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {SLOT_NAMES[shift.slotType]} · {SLOT_LABELS[shift.slotType]}
                    </p>
                    <p className="text-sm text-muted">{formatHours(SHIFT_HOURS)}</p>
                  </div>
                  {shift.swapRequested && <Badge tone="warning">Bytte søkes</Badge>}
                  {dayBadge(shift, now)}
                  {onSwap && canRequestSwap(shift, userId, now) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onSwap(shift)}
                      aria-label={`${shift.swapRequested ? 'Endre bytte for' : 'Bytt'} vakt ${formatWeekday(shift.startsAt)} ${formatDayMonth(shift.startsAt)}`}
                    >
                      {shift.swapRequested ? 'Endre' : 'Bytt'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Kalender" description="Dager du har vakt er markert.">
          <MonthCalendar shifts={mine} initialMonth={now} />
        </Card>
      </div>
    </div>
  );
};

export default MyShiftsTab;
