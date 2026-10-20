import { supabase } from '../supabaseClient';
import { getRoomCapacity, isRoomType } from '../../features/rooms/rooms';
import type {
  Occupancy,
  ResidentForRoom,
  Room,
  RoomOccupant,
  RoomType,
} from '../../features/rooms/types';
import { parseDateColumnValue } from '../../shared/utils/date';

type NameRelation = { name?: string | null } | { name?: string | null }[] | null | undefined;

const getName = (relation: NameRelation): string => {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value?.name ?? 'Ukjent';
};

type RoomRow = { id: string; number: number; type: string | null };

type CurrentOccupancyRow = {
  room_id: string;
  user_id: string;
  moved_in: string;
  users?: NameRelation;
};

type OccupancyRow = {
  id: string;
  room_id: string;
  user_id: string;
  moved_in: string;
  moved_out: string | null;
  rooms?: { number?: number | null } | { number?: number | null }[] | null;
  users?: NameRelation;
};

// Every room with the residents who live there now.
export async function getRooms(): Promise<Room[]> {
  const [roomsResult, occupantsResult] = await Promise.all([
    supabase.from('rooms').select('id, number, type').order('number', { ascending: true }),
    supabase
      .from('room_occupancies')
      .select('room_id, user_id, moved_in, users(name)')
      .is('moved_out', null),
  ]);
  if (roomsResult.error) throw new Error(`Could not get rooms: ${roomsResult.error.message}`);
  if (occupantsResult.error)
    throw new Error(`Could not get room occupants: ${occupantsResult.error.message}`);

  const occupantsByRoom = new Map<string, RoomOccupant[]>();
  for (const row of (occupantsResult.data ?? []) as unknown as CurrentOccupancyRow[]) {
    const occupants = occupantsByRoom.get(row.room_id) ?? [];
    occupants.push({
      userId: row.user_id,
      userName: getName(row.users),
      movedIn: parseDateColumnValue(row.moved_in),
    });
    occupantsByRoom.set(row.room_id, occupants);
  }

  return ((roomsResult.data ?? []) as RoomRow[]).map((row) => {
    const type = isRoomType(row.type) ? row.type : null;
    return {
      id: row.id,
      number: row.number,
      type,
      capacity: getRoomCapacity(type),
      occupants: (occupantsByRoom.get(row.id) ?? []).sort((a, b) =>
        a.userName.localeCompare(b.userName, 'no', { sensitivity: 'base' })
      ),
    };
  });
}

function toAppOccupancy(row: OccupancyRow): Occupancy {
  const room = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;
  return {
    id: row.id,
    roomId: row.room_id,
    roomNumber: room?.number ?? 0,
    userId: row.user_id,
    userName: getName(row.users),
    movedIn: parseDateColumnValue(row.moved_in),
    movedOut: row.moved_out ? parseDateColumnValue(row.moved_out) : null,
  };
}

const OCCUPANCY_COLUMNS = 'id, room_id, user_id, moved_in, moved_out, rooms(number), users(name)';

// Everyone who has lived in the room, newest first.
export async function getRoomHistory(roomId: string): Promise<Occupancy[]> {
  const { data, error } = await supabase
    .from('room_occupancies')
    .select(OCCUPANCY_COLUMNS)
    .eq('room_id', roomId)
    .order('moved_in', { ascending: false });
  if (error) throw new Error(`Could not get room history: ${error.message}`);
  return ((data ?? []) as unknown as OccupancyRow[]).map(toAppOccupancy);
}

// Every room the resident has lived in, newest first.
export async function getUserRoomHistory(userId: string): Promise<Occupancy[]> {
  const { data, error } = await supabase
    .from('room_occupancies')
    .select(OCCUPANCY_COLUMNS)
    .eq('user_id', userId)
    .order('moved_in', { ascending: false });
  if (error) throw new Error(`Could not get room history: ${error.message}`);
  return ((data ?? []) as unknown as OccupancyRow[]).map(toAppOccupancy);
}

// Puts a resident in a room, or in none when roomId is null. The database checks that the caller
// is a room manager and that the room has space, and ends the previous stay the same day.
export async function assignResidentToRoom(userId: string, roomId: string | null): Promise<void> {
  const { error } = await supabase.rpc('assign_resident_to_room', {
    p_user_id: userId,
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
}

// Sets the type of one room, or clears it with null. Room managers only (row-level security).
export async function updateRoomType(roomId: string, type: RoomType | null): Promise<void> {
  const { data, error } = await supabase
    .from('rooms')
    .update({ type })
    .eq('id', roomId)
    .select('id');
  if (error) throw new Error(error.message);
  // Row-level security turns a forbidden update into "0 rows" rather than an error.
  if (!data || data.length === 0) throw new Error('Du har ikke tilgang til å endre rommet');
}

// Sets the same type on every room from `from` to `to`, both included.
export async function setRoomTypes(
  from: number,
  to: number,
  type: RoomType | null
): Promise<number> {
  const { data, error } = await supabase
    .from('rooms')
    .update({ type })
    .gte('number', from)
    .lte('number', to)
    .select('id');
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

type ResidentRow = {
  id: string;
  name: string | null;
  room_number: number | null;
  is_husfar: boolean | null;
};

// Active residents with their current room, for assigning rooms and picking the Husfar.
export async function getResidentsForRooms(): Promise<ResidentForRoom[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, room_number, is_husfar')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(`Could not get residents: ${error.message}`);
  return ((data ?? []) as ResidentRow[]).map((row) => ({
    id: row.id,
    name: row.name ?? 'Ukjent',
    roomNumber: row.room_number ?? 0,
    isHusfar: row.is_husfar ?? false,
  }));
}

// Makes the resident Husfar (and moves them into husfarhybelen) or removes the flag.
export async function setHusfar(userId: string, isHusfar: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_husfar', {
    p_user_id: userId,
    p_is_husfar: isHusfar,
  });
  if (error) throw new Error(error.message);
}
