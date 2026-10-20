import type { Occupancy, Room, RoomType } from './types';

export const ROOM_TYPES: RoomType[] = [
  'bottekott',
  'korrhybel',
  'liten_parhybel',
  'stor_parhybel',
  'husfarhybel',
];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  bottekott: 'Bøttekott',
  korrhybel: 'Korrhybel',
  liten_parhybel: 'Liten parhybel',
  stor_parhybel: 'Stor parhybel',
  husfarhybel: 'Husfarhybelen',
};

export const isRoomType = (value: unknown): value is RoomType =>
  typeof value === 'string' && (ROOM_TYPES as string[]).includes(value);

// Both kinds of parhybel hold two people, every other room (and a room without a type) one.
// Keep in sync with room_capacity() in the database.
export const getRoomCapacity = (type: RoomType | null): number =>
  type === 'liten_parhybel' || type === 'stor_parhybel' ? 2 : 1;

export const formatRoomType = (type: RoomType | null): string =>
  type ? ROOM_TYPE_LABELS[type] : 'Ikke satt';

export const getFreeSpots = (room: Pick<Room, 'capacity' | 'occupants'>): number =>
  Math.max(room.capacity - room.occupants.length, 0);

export const getRoomOfUser = (rooms: Room[], userId: string): Room | undefined =>
  rooms.find((room) => room.occupants.some((occupant) => occupant.userId === userId));

export type RoomFilter = 'all' | 'free';

// Matches the room number, the type or the name of someone living there.
export const filterRooms = (rooms: Room[], query: string, filter: RoomFilter = 'all'): Room[] => {
  const needle = query.trim().toLowerCase();
  return rooms.filter((room) => {
    if (filter === 'free' && getFreeSpots(room) === 0) return false;
    if (!needle) return true;
    return (
      String(room.number).includes(needle) ||
      formatRoomType(room.type).toLowerCase().includes(needle) ||
      room.occupants.some((occupant) => occupant.userName.toLowerCase().includes(needle))
    );
  });
};

// Newest stay first; the current one (no move-out date) always leads.
export const sortOccupancies = (stays: Occupancy[]): Occupancy[] =>
  [...stays].sort((a, b) => {
    if (!a.movedOut !== !b.movedOut) return a.movedOut ? 1 : -1;
    return b.movedIn.getTime() - a.movedIn.getTime();
  });
