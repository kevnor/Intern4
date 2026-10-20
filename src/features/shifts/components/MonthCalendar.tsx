import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthWeeks, groupShiftsByDay, dayKey, isSameDay, startOfMonth } from '../calendar';
import { SLOT_LABELS } from '../slots';
import type { Shift } from '../types';
import { Button } from '../../../shared/components';
import { cn } from '../../../shared/utils/cn';

const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

type MonthCalendarProps = {
  shifts: Shift[];
  initialMonth?: Date;
};

// A month overview that highlights the days the user has a shift.
export const MonthCalendar = ({ shifts, initialMonth = new Date() }: MonthCalendarProps) => {
  const [month, setMonth] = useState(() => startOfMonth(initialMonth));
  const byDay = groupShiftsByDay(shifts);
  const today = new Date();
  const title = month.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Forrige måned"
          icon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}
          onClick={() => shiftMonth(-1)}
        />
        <h3 className="font-medium capitalize">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Neste måned"
          icon={<ChevronRight aria-hidden="true" className="h-4 w-4" />}
          onClick={() => shiftMonth(1)}
        />
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-subtle">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-1">
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {getMonthWeeks(month)
          .flat()
          .map((day) => {
            const dayShifts = byDay.get(dayKey(day)) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            return (
              <div
                key={dayKey(day)}
                className={cn(
                  'flex min-h-14 flex-col items-center gap-1 rounded-lg border p-1 text-sm sm:min-h-20',
                  dayShifts.length > 0
                    ? 'border-primary bg-primary-subtle text-primary-subtle-fg'
                    : 'border-border',
                  !inMonth && 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full tabular-nums',
                    isSameDay(day, today) && 'bg-primary font-semibold text-primary-fg'
                  )}
                >
                  {day.getDate()}
                </span>
                {dayShifts.map((shift) => (
                  <span key={shift.id} className="text-[11px] leading-none tabular-nums">
                    {SLOT_LABELS[shift.slotType]}
                  </span>
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
};
