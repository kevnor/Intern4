import { useCallback, useEffect, useState } from 'react';
import { createShiftSlots, getShifts } from '../../../server/dao/shiftsDAO';
import { generateSlots } from '../slots';
import type { Shift } from '../types';

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
      setError('Kunne ikke laste vaktene. Prøv å oppdatere siden.');
    } finally {
      setLoading(false);
    }
  }, [fromTime, toTime]);

  useEffect(() => {
    void load();
  }, [load]);

  // Creates empty draft slots for the whole period; existing shifts are kept.
  const createSlots = useCallback(async (): Promise<void> => {
    await createShiftSlots(generateSlots(new Date(fromTime), new Date(toTime)));
    await load();
  }, [fromTime, toTime, load]);

  return { shifts, loading, error, reload: load, createSlots };
};
