import { useEffect, useState } from 'react';
import { getRoomWork } from '../../../server/dao/roomsDAO';
import type { RoomWork } from '../types';

// Regi work done on a room, for the room's page.
export const useRoomWork = (roomId: string | undefined) => {
  const [work, setWork] = useState<RoomWork[]>([]);
  const [loading, setLoading] = useState(Boolean(roomId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    getRoomWork(roomId)
      .then((loaded) => {
        if (!cancelled) setWork(loaded);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError('Kunne ikke laste arbeidet som er gjort på rommet.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return { work, loading, error };
};
