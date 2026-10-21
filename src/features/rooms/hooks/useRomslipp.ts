import { useCallback, useEffect, useState } from 'react';
import {
  answerRomslipp,
  cancelRomslipp,
  closeRomslipp,
  getAvailableRooms,
  getLatestRomslipp,
  skipRomslipp,
  startRomslipp,
} from '../../../server/dao/romslippDAO';
import type { AvailableRoom, RomslippState } from '../types';
import { getErrorMessage } from '../../../shared/utils/errors';

// How often an open round is refreshed, so a resident sees it become their turn.
const POLL_MS = 15_000;

// The latest romslipp, what is available in it, and the actions on it. Every action reloads the
// round and shows the database's own message when it is refused ("Det er ikke din tur").
export const useRomslipp = (enabled = true) => {
  const [state, setState] = useState<RomslippState | null>(null);
  const [available, setAvailable] = useState<AvailableRoom[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const latest = await getLatestRomslipp();
      setState(latest);
      setAvailable(latest?.round.status === 'open' ? await getAvailableRooms(latest.round.id) : []);
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Kunne ikke laste romslippet.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const isOpen = state?.round.status === 'open';
  useEffect(() => {
    if (!enabled || !isOpen) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, isOpen, load]);

  const run = useCallback(
    async (action: () => Promise<void>, failure: string): Promise<boolean> => {
      try {
        setBusy(true);
        setError(null);
        await action();
        await load();
        return true;
      } catch (actionError) {
        console.error(actionError);
        setError(getErrorMessage(actionError, failure));
        // Someone else may have answered in the meantime.
        await load();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const start = useCallback(
    (semesterKey: string) => run(() => startRomslipp(semesterKey), 'Kunne ikke starte romslippet.'),
    [run]
  );

  const answer = useCallback(
    (roomId: string | null, userId?: string) =>
      state
        ? run(() => answerRomslipp(state.round.id, roomId, userId), 'Kunne ikke lagre svaret.')
        : Promise.resolve(false),
    [run, state]
  );

  const skip = useCallback(
    (userId: string) =>
      state
        ? run(() => skipRomslipp(state.round.id, userId), 'Kunne ikke hoppe over beboeren.')
        : Promise.resolve(false),
    [run, state]
  );

  const close = useCallback(
    () =>
      state
        ? run(() => closeRomslipp(state.round.id), 'Kunne ikke avslutte romslippet.')
        : Promise.resolve(false),
    [run, state]
  );

  const cancel = useCallback(
    () =>
      state
        ? run(() => cancelRomslipp(state.round.id), 'Kunne ikke avbryte romslippet.')
        : Promise.resolve(false),
    [run, state]
  );

  return {
    state,
    available,
    loading,
    busy,
    error,
    clearError: () => setError(null),
    reload: load,
    start,
    answer,
    skip,
    close,
    cancel,
  };
};

export type RomslippController = ReturnType<typeof useRomslipp>;
