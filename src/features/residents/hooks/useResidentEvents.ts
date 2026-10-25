import { useEffect, useState } from 'react';
import { getResidentEvents } from '../../../server/dao/offboardingDAO';
import { getErrorMessage } from '../../../shared/utils/errors';
import type { ResidentEvent } from '../offboarding';

// The log of one resident. version changes when something was done, so the list loads again.
export const useResidentEvents = (userId: string | undefined, version = 0) => {
  const [events, setEvents] = useState<ResidentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    getResidentEvents(userId)
      .then((result) => {
        if (!current) return;
        setEvents(result);
        setError(null);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (current) setError(getErrorMessage(loadError, 'Kunne ikke laste historikken.'));
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [userId, version]);

  return { events, loading, error };
};
