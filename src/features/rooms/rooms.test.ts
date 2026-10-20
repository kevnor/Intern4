import { describe, expect, it } from 'vitest';
import {
  describeRoomOption,
  filterRooms,
  formatRoomType,
  getAssignableRooms,
  getFreeSpots,
  getHusfar,
  getHusfarRoom,
  getRoomCapacity,
  getResidentsWithoutRoom,
  getRoomOfUser,
  isRoomType,
  parseRoomRange,
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

describe('getAssignableRooms', () => {
  const rooms = [
    room({ number: 60, type: 'husfarhybel' }),
    room({ number: 101 }),
    room({ number: 102, occupants: [occupant('a', 'Anne')] }),
    room({ number: 150, type: 'liten_parhybel', capacity: 2, occupants: [occupant('b', 'Bo')] }),
  ];

  it('offers rooms with space and keeps husfarhybelen for the Husfar', () => {
    expect(getAssignableRooms(rooms).map((r) => r.number)).toEqual([101, 150]);
    expect(getAssignableRooms(rooms, true).map((r) => r.number)).toEqual([60, 101, 150]);
  });
});

describe('resident helpers', () => {
  const residents = [
    { id: 'a', name: 'Anne', roomNumber: 101, isHusfar: false },
    { id: 'b', name: 'Bo', roomNumber: 0, isHusfar: false },
    { id: 'c', name: 'Cia', roomNumber: 60, isHusfar: true },
  ];

  it('finds residents without a room and the Husfar', () => {
    expect(getResidentsWithoutRoom(residents).map((r) => r.id)).toEqual(['b']);
    expect(getHusfar(residents)?.id).toBe('c');
    expect(getHusfar(residents.slice(0, 2))).toBeUndefined();
  });

  it('finds husfarhybelen', () => {
    expect(
      getHusfarRoom([room({ number: 101 }), room({ number: 60, type: 'husfarhybel' })])?.number
    ).toBe(60);
    expect(getHusfarRoom([room({ number: 101 })])).toBeUndefined();
  });
});

describe('describeRoomOption', () => {
  it('shows the number, type and how full the room is', () => {
    expect(
      describeRoomOption(
        room({
          number: 150,
          type: 'liten_parhybel',
          capacity: 2,
          occupants: [occupant('a', 'Anne')],
        })
      )
    ).toBe('150 · Liten parhybel (1 av 2)');
    expect(describeRoomOption(room({ number: 101 }))).toBe('101 · Ikke satt (0 av 1)');
  });
});

describe('parseRoomRange', () => {
  it('reads a range and treats an empty end as a single room', () => {
    expect(parseRoomRange({ from: '100', to: '110' })).toEqual({ from: 100, to: 110 });
    expect(parseRoomRange({ from: '150', to: '' })).toEqual({ from: 150, to: 150 });
  });

  it('explains what is wrong', () => {
    expect(parseRoomRange({ from: '', to: '' })).toBe('Skriv inn romnummer.');
    expect(parseRoomRange({ from: '110', to: '100' })).toMatch(/likt eller høyere/);
  });
});
