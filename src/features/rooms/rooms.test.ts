import { describe, expect, it } from 'vitest';
import {
  filterRooms,
  formatRoomType,
  getFreeSpots,
  getRoomCapacity,
  getRoomOfUser,
  isRoomType,
  sortOccupancies,
} from './rooms';
import type { Occupancy, Room } from './types';

const room = (overrides: Partial<Room> & { number: number }): Room => ({
  id: `room-${overrides.number}`,
  type: null,
  capacity: 1,
  occupants: [],
  ...overrides,
});

const occupant = (userId: string, userName: string) => ({
  userId,
  userName,
  movedIn: new Date(2026, 7, 1),
});

describe('getRoomCapacity', () => {
  it('lets both parhybel types hold two and everything else one', () => {
    expect(getRoomCapacity('liten_parhybel')).toBe(2);
    expect(getRoomCapacity('stor_parhybel')).toBe(2);
    expect(getRoomCapacity('bottekott')).toBe(1);
    expect(getRoomCapacity('korrhybel')).toBe(1);
    expect(getRoomCapacity('husfarhybel')).toBe(1);
    expect(getRoomCapacity(null)).toBe(1);
  });
});

describe('room types', () => {
  it('labels types and rooms without one', () => {
    expect(formatRoomType('bottekott')).toBe('Bøttekott');
    expect(formatRoomType('husfarhybel')).toBe('Husfarhybelen');
    expect(formatRoomType(null)).toBe('Ikke satt');
  });

  it('recognises valid types only', () => {
    expect(isRoomType('korrhybel')).toBe(true);
    expect(isRoomType('suite')).toBe(false);
    expect(isRoomType(undefined)).toBe(false);
  });
});

describe('getFreeSpots', () => {
  it('counts what is left and never goes negative', () => {
    expect(getFreeSpots(room({ number: 101 }))).toBe(1);
    expect(getFreeSpots(room({ number: 102, occupants: [occupant('a', 'Anne')] }))).toBe(0);
    // Rooms that are shared today can hold more than their capacity.
    expect(
      getFreeSpots(room({ number: 103, occupants: [occupant('a', 'Anne'), occupant('b', 'Bo')] }))
    ).toBe(0);
    expect(
      getFreeSpots(room({ number: 104, capacity: 2, occupants: [occupant('a', 'Anne')] }))
    ).toBe(1);
  });
});

describe('getRoomOfUser', () => {
  it('finds the room a resident lives in', () => {
    const rooms = [
      room({ number: 101 }),
      room({ number: 102, occupants: [occupant('a', 'Anne')] }),
    ];

    expect(getRoomOfUser(rooms, 'a')?.number).toBe(102);
    expect(getRoomOfUser(rooms, 'x')).toBeUndefined();
  });
});

describe('filterRooms', () => {
  const rooms = [
    room({ number: 101, type: 'bottekott' }),
    room({
      number: 150,
      type: 'liten_parhybel',
      capacity: 2,
      occupants: [occupant('a', 'Anne Hansen')],
    }),
    room({ number: 210, type: 'korrhybel', occupants: [occupant('b', 'Bo Olsen')] }),
  ];

  it('matches number, type and resident name', () => {
    expect(filterRooms(rooms, '21').map((r) => r.number)).toEqual([210]);
    expect(filterRooms(rooms, 'parhybel').map((r) => r.number)).toEqual([150]);
    expect(filterRooms(rooms, 'olsen').map((r) => r.number)).toEqual([210]);
    expect(filterRooms(rooms, '').map((r) => r.number)).toEqual([101, 150, 210]);
  });

  it('can show only rooms with space', () => {
    expect(filterRooms(rooms, '', 'free').map((r) => r.number)).toEqual([101, 150]);
  });
});

describe('sortOccupancies', () => {
  const stay = (id: string, movedIn: Date, movedOut: Date | null): Occupancy => ({
    id,
    roomId: 'r',
    roomNumber: 101,
    userId: 'u',
    userName: 'U',
    movedIn,
    movedOut,
  });

  it('puts the current stay first, then newest to oldest', () => {
    const sorted = sortOccupancies([
      stay('old', new Date(2024, 7, 1), new Date(2025, 5, 1)),
      stay('current', new Date(2025, 7, 1), null),
      stay('middle', new Date(2025, 0, 1), new Date(2025, 6, 1)),
    ]);

    expect(sorted.map((s) => s.id)).toEqual(['current', 'middle', 'old']);
  });
});
