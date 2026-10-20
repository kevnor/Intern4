import { getRequiredHoursForRole } from '../../app/constants/regiRequirements';
import { SHIFT_HOURS } from './slots';

export type VaktSummary = {
  done: number;
  required: number;
  remaining: number;
};

// A shift counts towards the requirement once it has ended; each one is worth SHIFT_HOURS.
export const summarizeSemesterVakt = (
  completedShifts: number,
  role: string | undefined,
  totalHours?: number
): VaktSummary => {
  const done = completedShifts * SHIFT_HOURS;
  const required = getRequiredHoursForRole(role, totalHours).vakt;
  return { done, required, remaining: Math.max(required - done, 0) };
};

// Whether to show vakt at all: people with no requirement who still took a shift see it too.
export const hasVakt = (summary: VaktSummary): boolean => summary.required > 0 || summary.done > 0;
