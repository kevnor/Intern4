import { useCallback, useEffect, useState } from 'react';
import {
  cancelSwap,
  claimShift,
  getSwapLog,
  requestSwap,
  setSwapPaid,
} from '../../../server/dao/shiftsDAO';
import type { SwapLogEntry } from '../types';
import { getErrorMessage } from '../../../shared/utils/errors';

// Swap requests, claims and the history of swaps the signed-in resident was part of.
// `reloadShifts` refreshes the schedule after anything that changes who has a shift.
export const useSwaps = (userId: string, reloadShifts: () => Promise<void>) => {
  const [log, setLog] = useState<SwapLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLog = useCallback(async (): Promise<void> => {
    try {
      const entries = await getSwapLog();
      // Admin and Vaktsjef receive everyone's swaps; each person only sees their own here.
      setLog(entries.filter((entry) => entry.fromUserId === userId || entry.toUserId === userId));
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Kunne ikke laste bytter.'));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void loadLog();
  }, [userId, loadLog]);

  const run = useCallback(
    async (action: () => Promise<void>, failure: string): Promise<boolean> => {
      try {
        setBusy(true);
        setError(null);
        await action();
        await Promise.all([reloadShifts(), loadLog()]);
        return true;
      } catch (actionError) {
        console.error(actionError);
        setError(getErrorMessage(actionError, failure));
        // The shift may have been taken or changed in the meantime.
        await reloadShifts().catch(() => undefined);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reloadShifts, loadLog]
  );

  const request = useCallback(
    (shiftId: string, amount: number | null, note: string) =>
      run(() => requestSwap(shiftId, amount, note), 'Kunne ikke be om bytte.'),
    [run]
  );

  const cancel = useCallback(
    (shiftId: string) => run(() => cancelSwap(shiftId), 'Kunne ikke avbryte byttet.'),
    [run]
  );

  const claim = useCallback(
    (shiftId: string) =>
      run(
        () => claimShift(shiftId),
        'Kunne ikke ta vakten. Den kan allerede være tatt eller trukket tilbake.'
      ),
    [run]
  );

  const markPaid = useCallback(
    (logId: string, paid: boolean) =>
      run(() => setSwapPaid(logId, paid), 'Kunne ikke oppdatere betalingen.'),
    [run]
  );

  return { log, busy, error, clearError: () => setError(null), request, cancel, claim, markPaid };
};
