import { startOfDay } from './calendar';
import type { SlotType } from './types';

// A resident should not start a shift less than this long after finishing another one.
export const MIN_REST_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;

export type AssignableShift = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  slotType: SlotType;
  userId: string | null;
};

export type AssignableResident = {
  id: string;
  // How many shifts the resident owes this semester.
  targetShifts: number;
};

// Days (inclusive) on which a resident can't work.
export type UnavailablePeriod = {
  userId: string;
  from: Date;
  to: Date;
};

export type AssignmentResult = {
  assignments: { shiftId: string; userId: string }[];
  // Shifts nobody could take: everyone was unavailable, resting, or already at their target.
  unfilled: string[];
  // Shifts each resident has after assigning, including ones they already had.
  counts: Record<string, number>;
  // Residents who ended up below their target, and by how many shifts.
  shortfalls: Record<string, number>;
};

type Interval = { start: number; end: number };

const isRested = (intervals: Interval[], shift: AssignableShift): boolean => {
  const rest = MIN_REST_HOURS * HOUR_MS;
  const start = shift.startsAt.getTime();
  const end = shift.endsAt.getTime();
  return intervals.every((other) => start >= other.end + rest || end + rest <= other.start);
};

const isAvailable = (periods: UnavailablePeriod[], userId: string, shift: AssignableShift) => {
  const day = startOfDay(shift.startsAt).getTime();
  return !periods.some(
    (period) =>
      period.userId === userId &&
      day >= startOfDay(period.from).getTime() &&
      day <= startOfDay(period.to).getTime()
  );
};

// Fills the unassigned shifts, oldest first. Each shift goes to the available, rested resident
// who is furthest from their target, which spreads shifts evenly over the semester. Residents
// are never given more than their target, and nights/evenings/days are balanced between them.
// Shifts that already have someone count towards that person's target and rest time.
export const assignShifts = (
  shifts: AssignableShift[],
  residents: AssignableResident[],
  unavailable: UnavailablePeriod[] = []
): AssignmentResult => {
  const sorted = [...shifts].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const counts: Record<string, number> = {};
  const intervals: Record<string, Interval[]> = {};
  const lastEnd: Record<string, number> = {};
  const typeCounts: Record<string, Record<SlotType, number>> = {};

  for (const resident of residents) {
    counts[resident.id] = 0;
    intervals[resident.id] = [];
    lastEnd[resident.id] = Number.NEGATIVE_INFINITY;
    typeCounts[resident.id] = { natt: 0, dag: 0, kveld: 0 };
  }

  const record = (userId: string, shift: AssignableShift) => {
    if (!(userId in counts)) return;
    counts[userId] += 1;
    intervals[userId].push({ start: shift.startsAt.getTime(), end: shift.endsAt.getTime() });
    lastEnd[userId] = Math.max(lastEnd[userId], shift.endsAt.getTime());
    typeCounts[userId][shift.slotType] += 1;
  };

  for (const shift of sorted) {
    if (shift.userId) record(shift.userId, shift);
  }

  const assignments: AssignmentResult['assignments'] = [];
  const unfilled: string[] = [];

  for (const shift of sorted) {
    if (shift.userId) continue;

    const candidates = residents.filter(
      (resident) =>
        counts[resident.id] < resident.targetShifts &&
        isAvailable(unavailable, resident.id, shift) &&
        isRested(intervals[resident.id], shift)
    );

    if (candidates.length === 0) {
      unfilled.push(shift.id);
      continue;
    }

    const need = (resident: AssignableResident) =>
      (resident.targetShifts - counts[resident.id]) / resident.targetShifts;

    candidates.sort(
      (a, b) =>
        need(b) - need(a) ||
        typeCounts[a.id][shift.slotType] - typeCounts[b.id][shift.slotType] ||
        lastEnd[a.id] - lastEnd[b.id] ||
        a.id.localeCompare(b.id)
    );

    const chosen = candidates[0];
    record(chosen.id, shift);
    assignments.push({ shiftId: shift.id, userId: chosen.id });
  }

  const shortfalls: Record<string, number> = {};
  for (const resident of residents) {
    const missing = resident.targetShifts - counts[resident.id];
    if (missing > 0) shortfalls[resident.id] = missing;
  }

  return { assignments, unfilled, counts, shortfalls };
};
