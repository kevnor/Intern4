import { MIN_REST_HOURS } from './assign';
import type { Shift } from './types';

const HOUR_MS = 60 * 60 * 1000;

export const formatKroner = (amount: number): string =>
  `${amount.toLocaleString('no-NO', { maximumFractionDigits: 2 })} kr`;

// Only published, upcoming shifts can change hands.
export const canRequestSwap = (shift: Shift, userId: string, now: Date = new Date()): boolean =>
  shift.userId === userId && shift.status === 'published' && shift.startsAt > now;

// Shifts other residents have put up for swap that this resident could take.
export const getOpenSwaps = (shifts: Shift[], userId: string, now: Date = new Date()): Shift[] =>
  shifts.filter(
    (shift) =>
      shift.swapRequested &&
      shift.status === 'published' &&
      shift.userId !== userId &&
      shift.startsAt > now
  );

// True when taking `target` would leave the resident less than the usual rest between shifts.
// Only a warning: the resident can still take the shift.
export const hasRestConflict = (shifts: Shift[], userId: string, target: Shift): boolean => {
  const rest = MIN_REST_HOURS * HOUR_MS;
  return shifts.some(
    (shift) =>
      shift.userId === userId &&
      shift.id !== target.id &&
      !(
        target.startsAt.getTime() >= shift.endsAt.getTime() + rest ||
        target.endsAt.getTime() + rest <= shift.startsAt.getTime()
      )
  );
};
