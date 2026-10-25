import { useEffect, useState } from 'react';
import { getRoomHistory, getUserRoomHistory } from '../../../server/dao/roomsDAO';
import { sortOccupancies } from '../rooms';
import type { Occupancy } from '../types';
import { getErrorMessage } from '../../../shared/utils/errors';

// Loads a list of stays; shared by the room history and a resident's room history.
const useStays = (
  key: string | undefined,
  load: (key: string) => Promise<Occupancy[]>,
  refreshKey = ''
) => {
  const [stays, setStays] = useState<Occupancy[]>([]);
  const [loading, setLoading] = useState(Boolean(key));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load(key)
      .then((loaded) => {
        if (!cancelled) setStays(sortOccupancies(loaded));
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError(getErrorMessage(loadError, 'Kunne ikke laste romhistorikken.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, load, refreshKey]);

  return { stays, loading, error };
};

// `refreshKey` reloads the history when something about the room changed, e.g. who lives there.
export const useRoomHistory = (roomId: string | undefined, refreshKey = '') =>
  useStays(roomId, getRoomHistory, refreshKey);

export const useUserRoomHistory = (userId: string | undefined) =>
  useStays(userId, getUserRoomHistory);
