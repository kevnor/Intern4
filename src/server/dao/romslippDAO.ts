import { supabase } from '../supabaseClient';
import { isRoomType } from '../../features/rooms/rooms';
import type {
  AvailableRoom,
  ParticipantStatus,
  RomslippParticipant,
  RomslippRound,
  RomslippState,
  RomslippStatus,
} from '../../features/rooms/types';

type Relation<T> = T | T[] | null | undefined;

const first = <T>(relation: Relation<T>): T | undefined =>
  Array.isArray(relation) ? relation[0] : (relation ?? undefined);

type RoundRow = {
  id: string;
  semester_key: string;
  status: RomslippStatus;
  created_at: string;
  closed_at: string | null;
};

type ParticipantRow = {
  user_id: string;
  position: number;
  status: ParticipantStatus;
  chosen_room_id: string | null;
  answered_at: string | null;
  person?: Relation<{ name?: string | null }>;
  from_room?: Relation<{ number?: number | null }>;
  chosen_room?: Relation<{ number?: number | null }>;
  answerer?: Relation<{ name?: string | null }>;
};

const toRound = (row: RoundRow): RomslippRound => ({
  id: row.id,
  semesterKey: row.semester_key,
  status: row.status,
  createdAt: new Date(row.created_at),
  closedAt: row.closed_at ? new Date(row.closed_at) : null,
});

const toParticipant = (row: ParticipantRow): RomslippParticipant => ({
  userId: row.user_id,
  userName: first(row.person)?.name ?? 'Ukjent',
  position: row.position,
  status: row.status,
  fromRoomNumber: first(row.from_room)?.number ?? null,
  chosenRoomId: row.chosen_room_id,
  chosenRoomNumber: first(row.chosen_room)?.number ?? null,
  answeredAt: row.answered_at ? new Date(row.answered_at) : null,
  answeredByName: first(row.answerer)?.name ?? null,
});

const ROUND_COLUMNS = 'id, semester_key, status, created_at, closed_at';
const PARTICIPANT_COLUMNS =
  'user_id, position, status, chosen_room_id, answered_at, person:users!romslipp_participants_user_id_fkey(name), from_room:rooms!romslipp_participants_from_room_id_fkey(number), chosen_room:rooms!romslipp_participants_chosen_room_id_fkey(number), answerer:users!romslipp_participants_answered_by_fkey(name)';

// The round that is running, or else the most recent one, with everyone in it in order.
export async function getLatestRomslipp(): Promise<RomslippState | null> {
  const { data: rounds, error } = await supabase
    .from('romslipp_rounds')
    .select(ROUND_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new Error(`Could not get romslipp: ${error.message}`);

  const rows = (rounds ?? []) as RoundRow[];
  const row = rows.find((candidate) => candidate.status === 'open') ?? rows[0];
  if (!row) return null;

  const { data: participants, error: participantsError } = await supabase
    .from('romslipp_participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('round_id', row.id)
    .order('position', { ascending: true });
  if (participantsError) {
    throw new Error(`Could not get romslipp participants: ${participantsError.message}`);
  }

  return {
    round: toRound(row),
    participants: ((participants ?? []) as unknown as ParticipantRow[]).map(toParticipant),
  };
}

type AvailableRow = { room_id: string; number: number; type: string | null; free_spots: number };

export async function getAvailableRooms(roundId: string): Promise<AvailableRoom[]> {
  const { data, error } = await supabase.rpc('romslipp_available_rooms', { p_round_id: roundId });
  if (error) throw new Error(`Could not get available rooms: ${error.message}`);
  return ((data ?? []) as AvailableRow[]).map((row) => ({
    roomId: row.room_id,
    number: row.number,
    type: isRoomType(row.type) ? row.type : null,
    freeSpots: row.free_spots,
  }));
}

// Who is asked next in the round that is running, or null when none is running.
export async function getRomslippTurn(): Promise<{ roundId: string; userId: string } | null> {
  const { data: round, error } = await supabase
    .from('romslipp_rounds')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();
  if (error) throw new Error(`Could not get romslipp: ${error.message}`);
  if (!round) return null;

  const { data: next, error: nextError } = await supabase
    .from('romslipp_participants')
    .select('user_id')
    .eq('round_id', round.id)
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextError) throw new Error(`Could not get romslipp: ${nextError.message}`);
  return next ? { roundId: round.id, userId: next.user_id } : null;
}

// The functions below check who may act and whose turn it is; their message is the error.
async function call(name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
}

export const startRomslipp = (semesterKey: string) =>
  call('start_romslipp', { p_semester_key: semesterKey });

// roomId null means "I stay". userId is only for Romsjef answering for someone else.
export const answerRomslipp = (roundId: string, roomId: string | null, userId?: string) =>
  call('romslipp_answer', { p_round_id: roundId, p_room_id: roomId, p_user_id: userId ?? null });

export const skipRomslipp = (roundId: string, userId: string) =>
  call('romslipp_skip', { p_round_id: roundId, p_user_id: userId });

export const closeRomslipp = (roundId: string) => call('close_romslipp', { p_round_id: roundId });

export const cancelRomslipp = (roundId: string) => call('cancel_romslipp', { p_round_id: roundId });
