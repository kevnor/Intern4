import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRoomAdmin } from './useRoomAdmin';
import {
  assignResidentToRoom,
  getResidentsForRooms,
  setHusfar,
  setRoomTypes,
  updateRoomType,
} from '../../../server/dao/roomsDAO';
import type { Room } from '../types';

const rooms: Room[] = [
  { id: 'r60', number: 60, type: 'husfarhybel', capacity: 1, occupants: [] },
  { id: 'r101', number: 101, type: null, capacity: 1, occupants: [] },
];

const residents = [
  { id: 'a', name: 'Anne', roomNumber: 0, isHusfar: false },
  { id: 'b', name: 'Bo', roomNumber: 101, isHusfar: false },
  { id: 'c', name: 'Cia', roomNumber: 60, isHusfar: true },
];

const setup = async (enabled = true) => {
  const reloadRooms = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useRoomAdmin({ enabled, rooms, reloadRooms }));
  if (enabled) await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...hook, reloadRooms };
};

describe('useRoomAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResidentsForRooms).mockResolvedValue(residents);
  });

  it('works out who has no room, who is Husfar and which room is husfarhybelen', async () => {
    const { result } = await setup();

    expect(result.current.withoutRoom.map((resident) => resident.id)).toEqual(['a']);
    expect(result.current.husfar?.id).toBe('c');
    expect(result.current.husfarRoom?.number).toBe(60);
  });

  it('does not load anything for people who cannot administer rooms', async () => {
    await setup(false);

    expect(getResidentsForRooms).not.toHaveBeenCalled();
  });

  it('assigns a room and refreshes rooms and residents', async () => {
    const { result, reloadRooms } = await setup();

    let ok = false;
    await act(async () => {
      ok = await result.current.assign('a', 'r101');
    });

    expect(ok).toBe(true);
    expect(assignResidentToRoom).toHaveBeenCalledWith('a', 'r101');
    expect(reloadRooms).toHaveBeenCalled();
    expect(getResidentsForRooms).toHaveBeenCalledTimes(2);
  });

  it('changes room types one at a time and by range', async () => {
    vi.mocked(setRoomTypes).mockResolvedValueOnce(11);
    const { result } = await setup();

    await act(async () => {
      await result.current.changeType('r101', 'korrhybel');
      await result.current.changeRangeType(100, 110, 'bottekott');
    });

    expect(updateRoomType).toHaveBeenCalledWith('r101', 'korrhybel');
    expect(setRoomTypes).toHaveBeenCalledWith(100, 110, 'bottekott');
    expect(result.current.notice).toBe('Endret typen på 11 rom.');
  });

  it('sets and clears the Husfar', async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.changeHusfar('a', true);
      await result.current.changeHusfar('c', false);
    });

    expect(setHusfar).toHaveBeenCalledWith('a', true);
    expect(setHusfar).toHaveBeenCalledWith('c', false);
  });

  it('shows the database message when an action is refused', async () => {
    vi.mocked(assignResidentToRoom).mockRejectedValueOnce(new Error('Rommet er fullt'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.assign('a', 'r101');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Rommet er fullt');
  });

  it('explains a technical failure in plain Norwegian', async () => {
    vi.mocked(assignResidentToRoom).mockRejectedValueOnce(
      new Error('insert or update violates foreign key constraint "room_occupancies_room_id_fkey"')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await setup();

    await act(async () => {
      await result.current.assign('a', 'r101');
    });

    expect(result.current.error).toBe('Dette kan ikke gjøres fordi noe annet er knyttet til det.');
  });
});
