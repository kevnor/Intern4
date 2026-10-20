import { describe, expect, it } from 'vitest';
import { getMonthWeeks, getWeekNumber, groupShiftsByDay, startOfWeek } from './calendar';
import type { Shift } from './types';

describe('startOfWeek', () => {
  it('returns the Monday of the week', () => {
    expect(startOfWeek(new Date(2026, 9, 21))).toEqual(new Date(2026, 9, 19));
    expect(startOfWeek(new Date(2026, 9, 25))).toEqual(new Date(2026, 9, 19));
    expect(startOfWeek(new Date(2026, 9, 19))).toEqual(new Date(2026, 9, 19));
  });
});

describe('getWeekNumber', () => {
  it('numbers weeks per ISO 8601', () => {
    expect(getWeekNumber(new Date(2026, 9, 20))).toBe(43);
    expect(getWeekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(getWeekNumber(new Date(2027, 0, 1))).toBe(53);
  });
});

describe('getMonthWeeks', () => {
  it('covers the month in whole weeks starting on Monday', () => {
    const weeks = getMonthWeeks(new Date(2026, 9, 1));

    expect(weeks[0][0]).toEqual(new Date(2026, 8, 28));
    expect(weeks[weeks.length - 1][6]).toEqual(new Date(2026, 10, 1));
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe('groupShiftsByDay', () => {
  it('groups shifts by the day they start', () => {
    const shift = (hour: number, day: number): Shift => ({
      id: `${day}-${hour}`,
      startsAt: new Date(2026, 9, day, hour),
      endsAt: new Date(2026, 9, day, hour + 8),
      slotType: 'natt',
      userId: null,
      userName: null,
      status: 'published',
      swapRequested: false,
      swapOfferAmount: null,
      swapNote: null,
    });

    const groups = groupShiftsByDay([shift(0, 19), shift(16, 19), shift(0, 20)]);

    expect(groups.get('2026-10-19')).toHaveLength(2);
    expect(groups.get('2026-10-20')).toHaveLength(1);
  });
});
