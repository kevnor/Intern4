import { supabase } from '../supabaseClient';
import type {
  OffboardingPreview,
  ResidentEvent,
  ResidentEventKind,
  ResidentFeedEvent,
} from '../../features/residents/offboarding';

type Relation<T> = T | T[] | null | undefined;

const first = <T>(relation: Relation<T>): T | undefined =>
  Array.isArray(relation) ? relation[0] : (relation ?? undefined);

type EventRow = {
  id: string;
  user_id?: string;
  subject?: Relation<{ name?: string | null }>;
  kind: ResidentEventKind;
  reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor?: Relation<{ name?: string | null }>;
};

// The database functions check who may do this; their (Norwegian) message is the error.
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// What moving the resident out would do, for the confirmation.
export async function getOffboardingPreview(userId: string): Promise<OffboardingPreview> {
  const data = await call<Partial<OffboardingPreview> | null>('offboarding_preview', {
    p_user_id: userId,
  });
  return {
    roomNumber: data?.roomNumber ?? null,
    futureShifts: data?.futureShifts ?? 0,
    openSwaps: data?.openSwaps ?? 0,
    waitingRomslipp: data?.waitingRomslipp ?? 0,
    openReports: data?.openReports ?? 0,
    roleReset: data?.roleReset ?? null,
  };
}

// date is a calendar day ('YYYY-MM-DD') after today.
export async function planMoveOut(userId: string, date: string, reason?: string): Promise<void> {
  await call('plan_move_out', {
    p_user_id: userId,
    p_date: date,
    p_reason: reason?.trim() || null,
  });
}

export async function cancelMoveOut(userId: string): Promise<void> {
  await call('cancel_move_out', { p_user_id: userId });
}

// Newest first. Only the people who manage residents may read these (row-level security).
export async function getResidentEvents(userId: string): Promise<ResidentEvent[]> {
  const { data, error } = await supabase
    .from('resident_events')
    .select('id, kind, reason, details, created_at, actor:users!actor_id(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not get the history: ${error.message}`);

  return ((data ?? []) as unknown as EventRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    actorName: first(row.actor)?.name ?? null,
    reason: row.reason,
    details: row.details ?? {},
    createdAt: new Date(row.created_at),
  }));
}

// The log for everyone, newest first, one page at a time. Asks for one more than the page so it
// knows whether there is another page.
export async function getRecentResidentEvents(
  limit: number,
  offset = 0
): Promise<{ events: ResidentFeedEvent[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('resident_events')
    .select(
      'id, user_id, kind, reason, details, created_at, subject:users!user_id(name), actor:users!actor_id(name)'
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw new Error(`Could not get the history: ${error.message}`);

  const rows = (data ?? []) as unknown as EventRow[];
  return {
    hasMore: rows.length > limit,
    events: rows.slice(0, limit).map((row) => ({
      id: row.id,
      userId: row.user_id ?? '',
      residentName: first(row.subject)?.name ?? 'Ukjent',
      kind: row.kind,
      actorName: first(row.actor)?.name ?? null,
      reason: row.reason,
      details: row.details ?? {},
      createdAt: new Date(row.created_at),
    })),
  };
}
