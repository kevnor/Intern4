import { describe, expect, it } from 'vitest';
import { generateSlots, getSlotTypesForDate } from './slots';

describe('generateSlots', () => {
  it('gives weekdays a night and an evening shift', () => {
    // Monday 19 October 2026.
    const slots = generateSlots(new Date(2026, 9, 19), new Date(2026, 9, 20));

    expect(slots.map((slot) => slot.slotType)).toEqual(['natt', 'kveld']);
    expect(slots[0].startsAt).toEqual(new Date(2026, 9, 19, 0));
    expect(slots[0].endsAt).toEqual(new Date(2026, 9, 19, 8));
    expect(slots[1].startsAt).toEqual(new Date(2026, 9, 19, 16));
    expect(slots[1].endsAt).toEqual(new Date(2026, 9, 20, 0));
  });

  it('adds the day shift on weekends', () => {
    // Saturday 24 and Sunday 25 October 2026.
    const slots = generateSlots(new Date(2026, 9, 24), new Date(2026, 9, 26));

    expect(slots.map((slot) => slot.slotType)).toEqual([
      'natt',
      'dag',
      'kveld',
      'natt',
      'dag',
      'kveld',
    ]);
  });

  it('covers a full week with 2 shifts on weekdays and 3 on weekends', () => {
    expect(generateSlots(new Date(2026, 9, 19), new Date(2026, 9, 26))).toHaveLength(5 * 2 + 2 * 3);
  });

  it('returns slots in chronological order without duplicates', () => {
    const slots = generateSlots(new Date(2026, 7, 1), new Date(2027, 0, 1));
    const times = slots.map((slot) => slot.startsAt.getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it('includes the start day and excludes the end day', () => {
    const slots = generateSlots(new Date(2026, 9, 19, 13), new Date(2026, 9, 21));

    expect(slots[0].startsAt).toEqual(new Date(2026, 9, 19, 0));
    expect(slots[slots.length - 1].startsAt).toEqual(new Date(2026, 9, 20, 16));
  });
});

describe('getSlotTypesForDate', () => {
  it('only includes the day shift on weekends', () => {
    expect(getSlotTypesForDate(new Date(2026, 9, 21))).toEqual(['natt', 'kveld']);
    expect(getSlotTypesForDate(new Date(2026, 9, 25))).toEqual(['natt', 'dag', 'kveld']);
  });
});
