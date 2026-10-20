import { describe, expect, it } from 'vitest';
import { assignShifts, MIN_REST_HOURS, type AssignableShift } from './assign';
import { generateSlots } from './slots';

const toShifts = (from: Date, to: Date): AssignableShift[] =>
  generateSlots(from, to).map((slot, index) => ({
    id: `s${index}`,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    slotType: slot.slotType,
    userId: null,
  }));

// Monday 19 October to Sunday 25 October 2026: 5 weekdays x 2 shifts + 2 weekend days x 3.
const week = () => toShifts(new Date(2026, 9, 19), new Date(2026, 9, 26));

const byUser = (result: ReturnType<typeof assignShifts>) =>
  result.assignments.reduce<Record<string, string[]>>((groups, { shiftId, userId }) => {
    groups[userId] = [...(groups[userId] ?? []), shiftId];
    return groups;
  }, {});

describe('assignShifts', () => {
  it('gives every resident exactly their target when there are enough shifts', () => {
    const result = assignShifts(week(), [
      { id: 'a', targetShifts: 3 },
      { id: 'b', targetShifts: 2 },
      { id: 'c', targetShifts: 1 },
    ]);

    expect(result.counts).toEqual({ a: 3, b: 2, c: 1 });
    expect(result.assignments).toHaveLength(6);
    expect(result.shortfalls).toEqual({});
  });

  it('never gives a resident more than their target', () => {
    const result = assignShifts(week(), [{ id: 'a', targetShifts: 2 }]);

    expect(result.counts.a).toBe(2);
    expect(result.unfilled).toHaveLength(week().length - 2);
  });

  it('leaves a shift unfilled when everyone is at their target', () => {
    const shifts = week().slice(0, 3);
    const result = assignShifts(shifts, [{ id: 'a', targetShifts: 1 }]);

    expect(result.assignments).toHaveLength(1);
    expect(result.unfilled).toEqual(
      ['s1', 's2'].filter((id) => id !== result.assignments[0].shiftId)
    );
  });

  it('skips residents on days they are unavailable', () => {
    const result = assignShifts(
      week(),
      [
        { id: 'a', targetShifts: 3 },
        { id: 'b', targetShifts: 3 },
      ],
      [{ userId: 'a', from: new Date(2026, 9, 19), to: new Date(2026, 9, 21) }]
    );

    const shifts = week();
    for (const shiftId of byUser(result).a ?? []) {
      const shift = shifts.find((candidate) => candidate.id === shiftId)!;
      expect(shift.startsAt >= new Date(2026, 9, 22)).toBe(true);
    }
  });

  it('reports a shortfall for a resident who is unavailable all period', () => {
    const result = assignShifts(
      week(),
      [{ id: 'a', targetShifts: 2 }],
      [{ userId: 'a', from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) }]
    );

    expect(result.assignments).toEqual([]);
    expect(result.shortfalls).toEqual({ a: 2 });
  });

  it('keeps a rest period between a resident’s shifts', () => {
    const shifts = week();
    const result = assignShifts(shifts, [{ id: 'a', targetShifts: 8 }]);

    const taken = (byUser(result).a ?? [])
      .map((id) => shifts.find((shift) => shift.id === id)!)
      .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());

    for (let index = 1; index < taken.length; index += 1) {
      const gapHours = (taken[index].startsAt.getTime() - taken[index - 1].endsAt.getTime()) / 36e5;
      expect(gapHours).toBeGreaterThanOrEqual(MIN_REST_HOURS);
    }
  });

  it('spreads shifts instead of clustering them', () => {
    const shifts = week();
    const result = assignShifts(shifts, [
      { id: 'a', targetShifts: 2 },
      { id: 'b', targetShifts: 2 },
    ]);

    const first = (byUser(result).a ?? []).map((id) => Number(id.slice(1)));
    expect(Math.abs(first[0] - first[1])).toBeGreaterThan(1);
  });

  it('balances night shifts between residents', () => {
    const nights = week().filter((shift) => shift.slotType === 'natt');
    const result = assignShifts(nights, [
      { id: 'a', targetShifts: 4 },
      { id: 'b', targetShifts: 4 },
    ]);

    expect(result.counts).toEqual({ a: 4, b: 3 });
  });

  it('keeps existing assignments and counts them towards the target', () => {
    const shifts = week();
    shifts[0].userId = 'a';
    const result = assignShifts(shifts, [{ id: 'a', targetShifts: 2 }]);

    expect(result.assignments).toHaveLength(1);
    expect(result.counts.a).toBe(2);
    expect(result.assignments.map((assignment) => assignment.shiftId)).not.toContain('s0');
  });

  it('does not place a resident next to a shift they already have', () => {
    const shifts = week();
    // Monday evening is already taken, so Monday night after it (Tuesday 00-08) is too close.
    shifts[1].userId = 'a';
    const result = assignShifts(shifts, [{ id: 'a', targetShifts: 2 }]);
    const second = result.assignments[0].shiftId;

    expect(second).not.toBe('s2');
  });

  it('is deterministic', () => {
    const residents = [
      { id: 'a', targetShifts: 3 },
      { id: 'b', targetShifts: 3 },
    ];

    expect(assignShifts(week(), residents)).toEqual(assignShifts(week(), residents));
  });
});
