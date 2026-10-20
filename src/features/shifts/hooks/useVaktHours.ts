import { useEffect, useMemo, useState } from 'react';
import { getCompletedShiftCounts } from '../../../server/dao/vaktHoursDAO';
import { getSemesterStart } from '../../../shared/utils/semester';
import { summarizeSemesterVakt, type VaktSummary } from '../vaktSummary';

// The resident's finished vakt this semester against their requirement. While loading, or if the
// shifts can't be read, nothing has been done yet.
export const useVaktHours = (
  userId: string | undefined,
  role: string | undefined,
  totalHours?: number
): { summary: VaktSummary; loading: boolean } => {
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getCompletedShiftCounts(getSemesterStart(), new Date(), userId)
      .then((counts) => {
        if (!cancelled) setCompleted(counts[userId] ?? 0);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const summary = useMemo(
    () => summarizeSemesterVakt(completed, role, totalHours),
    [completed, role, totalHours]
  );
  return { summary, loading };
};
