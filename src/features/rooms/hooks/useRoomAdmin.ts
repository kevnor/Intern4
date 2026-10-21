import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignResidentToRoom,
  getResidentsForRooms,
  setHusfar,
  setRoomTypes,
  updateRoomType,
} from '../../../server/dao/roomsDAO';
import { getHusfar, getHusfarRoom, getResidentsWithoutRoom } from '../rooms';
import type { ResidentForRoom, Room, RoomType } from '../types';

type Options = {
  enabled: boolean;
  rooms: Room[];
  // Refreshes the rooms after something changed.
  reloadRooms: () => Promise<void>;
};

// What room managers need: the active residents and the actions that change rooms. Every action
// reloads the rooms and residents, and reports the database's own message when it is refused
// ("Rommet er fullt", "Husfarhybelen er opptatt av ...").
export const useRoomAdmin = ({ enabled, rooms, reloadRooms }: Options) => {
  const [residents, setResidents] = useState<ResidentForRoom[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadResidents = useCallback(async (): Promise<void> => {
    try {
      setResidents(await getResidentsForRooms());
    } catch (loadError) {
      console.error(loadError);
      setError('Kunne ikke laste beboerne.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void loadResidents();
  }, [enabled, loadResidents]);

  const run = useCallback(
    async (action: () => Promise<string | void>): Promise<boolean> => {
      try {
        setBusy(true);
        setError(null);
        setNotice(null);
        const message = await action();
        if (message) setNotice(message);
        await Promise.all([reloadRooms(), loadResidents()]);
        return true;
      } catch (actionError) {
        console.error(actionError);
        setError(actionError instanceof Error ? actionError.message : 'Noe gikk galt.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reloadRooms, loadResidents]
  );

  const changeType = useCallback(
    (roomId: string, type: RoomType | null) => run(() => updateRoomType(roomId, type)),
    [run]
  );

  const changeRangeType = useCallback(
    (from: number, to: number, type: RoomType | null) =>
      run(async () => {
        const count = await setRoomTypes(from, to, type);
        return `Endret typen på ${count} rom.`;
      }),
    [run]
  );

  const assign = useCallback(
    (userId: string, roomId: string | null) => run(() => assignResidentToRoom(userId, roomId)),
    [run]
  );

  const changeHusfar = useCallback(
    (userId: string, isHusfar: boolean) => run(() => setHusfar(userId, isHusfar)),
    [run]
  );

  const withoutRoom = useMemo(() => getResidentsWithoutRoom(residents), [residents]);
  const husfar = useMemo(() => getHusfar(residents), [residents]);
  const husfarRoom = useMemo(() => getHusfarRoom(rooms), [rooms]);

  return {
    residents,
    withoutRoom,
    husfar,
    husfarRoom,
    loading,
    busy,
    error,
    notice,
    clearMessages: () => {
      setError(null);
      setNotice(null);
    },
    changeType,
    changeRangeType,
    assign,
    changeHusfar,
  };
};

export type RoomAdmin = ReturnType<typeof useRoomAdmin>;
