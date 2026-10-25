import { useCallback, useEffect, useState } from 'react';
import { getRooms } from '../../../server/dao/roomsDAO';
import type { Room } from '../types';
import { getErrorMessage } from '../../../shared/utils/errors';

// All rooms with who lives in them, loaded once for the whole Rom page.
export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setRooms(await getRooms());
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Kunne ikke laste rommene. Prøv å oppdatere siden.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { rooms, loading, error, reload: load };
};
