import type { Occupancy, ResidentForRoom, Room, RoomType } from './types';

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

// Rooms a resident can be put in: space left, and husfarhybelen only goes to the Husfar.
export const getAssignableRooms = (rooms: Room[], forHusfar = false): Room[] =>
  rooms.filter((room) => getFreeSpots(room) > 0 && (room.type !== 'husfarhybel' || forHusfar));

export const getResidentsWithoutRoom = (residents: ResidentForRoom[]): ResidentForRoom[] =>
  residents.filter((resident) => resident.roomNumber === 0);

export const getHusfar = (residents: ResidentForRoom[]): ResidentForRoom | undefined =>
  residents.find((resident) => resident.isHusfar);

export const getHusfarRoom = (rooms: Room[]): Room | undefined =>
  rooms.find((room) => room.type === 'husfarhybel');

// "Room 150 – Liten parhybel (1 av 2)" as shown in the room pickers.
export const describeRoomOption = (room: Room): string =>
  `${room.number} · ${formatRoomType(room.type)} (${room.occupants.length} av ${room.capacity})`;

export type RangeInput = { from: string; to: string };

// Checks a "from–to" pair of room numbers typed into the type-by-range form.
export const parseRoomRange = ({ from, to }: RangeInput): { from: number; to: number } | string => {
  const start = Number.parseInt(from, 10);
  const end = Number.parseInt(to === '' ? from : to, 10);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return 'Skriv inn romnummer.';
  if (end < start) return 'Til-nummeret må være likt eller høyere enn fra-nummeret.';
  return { from: start, to: end };
};
