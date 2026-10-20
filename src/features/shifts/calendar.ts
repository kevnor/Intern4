import type { Shift } from './types';

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const startOfDay = (date: Date): Date => addDays(date, 0);

// Weeks start on Monday.
export const startOfWeek = (date: Date): Date => addDays(date, -((date.getDay() + 6) % 7));

export const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Shifts grouped by the calendar day they start on.
export const groupShiftsByDay = (shifts: Shift[]): Map<string, Shift[]> => {
  const groups = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = dayKey(shift.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), shift]);
  }
  return groups;
};

// The weeks (Monday first) needed to show every day of the month containing `month`.
export const getMonthWeeks = (month: Date): Date[][] => {
  const first = startOfMonth(month);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  for (let weekStart = startOfWeek(first); weekStart <= last; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)));
  }
  return weeks;
};

// ISO 8601 week number.
export const getWeekNumber = (date: Date): number => {
  const thursday = addDays(startOfWeek(date), 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstWeekThursday = addDays(startOfWeek(firstThursday), 3);
  return 1 + Math.round((thursday.getTime() - firstWeekThursday.getTime()) / (7 * 86400000));
};

export const formatWeekday = (date: Date, style: 'short' | 'long' = 'short'): string =>
  date.toLocaleDateString('no-NO', { weekday: style });

export const formatDayMonth = (date: Date): string =>
  date.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
