import { useCallback, useEffect, useState } from 'react';
import { createShiftSlots, getShifts } from '../../../server/dao/shiftsDAO';
import { generateSlots } from '../slots';
import type { Shift } from '../types';
import { getErrorMessage } from '../../../shared/utils/errors';

// All shifts of one period, loaded once so switching tabs and weeks doesn't refetch.
export const useShifts = (from: Date, to: Date) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fromTime = from.getTime();
  const toTime = to.getTime();

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setShifts(await getShifts(new Date(fromTime), new Date(toTime)));
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Kunne ikke laste vaktene. Prøv å oppdatere siden.'));
    } finally {
      setLoading(false);
    }
  }, [fromTime, toTime]);

  useEffect(() => {
    void load();
  }, [load]);

  // Creates empty draft slots for the whole period; existing shifts are kept.
  // Says so on screen when it fails, and tells the caller whether it worked.
  const createSlots = useCallback(async (): Promise<boolean> => {
    try {
      await createShiftSlots(generateSlots(new Date(fromTime), new Date(toTime)));
      await load();
      return true;
    } catch (createError) {
      console.error(createError);
      setError(getErrorMessage(createError, 'Kunne ikke opprette vaktene.'));
      return false;
    }
  }, [fromTime, toTime, load]);

  return { shifts, loading, error, reload: load, createSlots };
};
