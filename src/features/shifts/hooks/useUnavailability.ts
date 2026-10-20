import { useCallback, useEffect, useState } from 'react';
import {
  addUnavailability,
  deleteUnavailability,
  getUnavailability,
} from '../../../server/dao/unavailabilityDAO';
import type { Unavailability } from '../types';

// The signed-in resident's own unavailable periods in the semester.
export const useUnavailability = (userId: string, from: Date, to: Date) => {
  const [periods, setPeriods] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fromTime = from.getTime();
  const toTime = to.getTime();

  const load = useCallback(async (): Promise<void> => {
    try {
      const loaded = await getUnavailability(new Date(fromTime), new Date(toTime));
      setPeriods(loaded.filter((period) => period.userId === userId));
    } catch (loadError) {
      console.error(loadError);
      setError('Kunne ikke laste utilgjengelige dager.');
    } finally {
      setLoading(false);
    }
  }, [userId, fromTime, toTime]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(
    async (periodFrom: Date, periodTo: Date, note?: string): Promise<boolean> => {
      try {
        setError(null);
        await addUnavailability(userId, periodFrom, periodTo, note);
        await load();
        return true;
      } catch (addError) {
        console.error(addError);
        setError('Kunne ikke lagre perioden.');
        return false;
      }
    },
    [userId, load]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        setError(null);
        await deleteUnavailability(id);
        await load();
      } catch (removeError) {
        console.error(removeError);
        setError('Kunne ikke slette perioden.');
      }
    },
    [load]
  );

  return { periods, loading, error, add, remove };
};
