import { supabase } from '../supabaseClient';
import type { RoomReport, RoomReportStatus } from '../../features/rooms/types';

type Relation<T> = T | T[] | null | undefined;

type ReportRow = {
  id: string;
  room_id: string;
  reported_by: string;
  title: string;
  description: string | null;
  status: RoomReportStatus;
  work_item_id: number | string | null;
  created_at: string;
  resolved_at: string | null;
  rooms?: Relation<{ number?: number | null }>;
  users?: Relation<{ name?: string | null }>;
};

const first = <T>(relation: Relation<T>): T | undefined =>
  Array.isArray(relation) ? relation[0] : (relation ?? undefined);

function toAppReport(row: ReportRow): RoomReport {
  return {
    id: row.id,
    roomId: row.room_id,
    roomNumber: first(row.rooms)?.number ?? 0,
    reportedBy: row.reported_by,
    reporterName: first(row.users)?.name ?? 'Ukjent',
    title: row.title,
    description: row.description,
    status: row.status,
    workItemId: row.work_item_id === null ? null : String(row.work_item_id),
    createdAt: new Date(row.created_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
  };
}

const COLUMNS =
  'id, room_id, reported_by, title, description, status, work_item_id, created_at, resolved_at, rooms(number), users(name)';

// Residents get the reports for their own room, managers all of them (row-level security).
export async function getRoomReports(roomId?: string): Promise<RoomReport[]> {
  let query = supabase
    .from('room_reports')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (roomId) query = query.eq('room_id', roomId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not get room reports: ${error.message}`);
  return ((data ?? []) as unknown as ReportRow[]).map(toAppReport);
}

export async function createRoomReport(data: {
  roomId: string;
  reportedBy: string;
  title: string;
  description?: string;
}): Promise<void> {
  const { error } = await supabase.from('room_reports').insert({
    room_id: data.roomId,
    reported_by: data.reportedBy,
    title: data.title.trim(),
    description: data.description?.trim() || null,
  });
  if (error) throw new Error(`Could not report problem: ${error.message}`);
}

export async function setReportStatus(reportId: string, status: RoomReportStatus): Promise<void> {
  const { data, error } = await supabase
    .from('room_reports')
    .update({ status })
    .eq('id', reportId)
    .select('id');
  if (error) throw new Error(`Could not update report: ${error.message}`);
  // Row-level security turns a forbidden update into "0 rows" rather than an error.
  if (!data || data.length === 0) throw new Error('Du har ikke tilgang til å endre meldingen');
}

// Links the report to the regi task made from it.
export async function linkReportToTask(reportId: string, taskId: string): Promise<void> {
  const { data, error } = await supabase
    .from('room_reports')
    .update({ status: 'task_created', work_item_id: Number(taskId) })
    .eq('id', reportId)
    .select('id');
  if (error) throw new Error(`Could not link report to task: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Du har ikke tilgang til å endre meldingen');
}

// Only the reporter can do this, and only while nobody has acted on the report.
export async function withdrawRoomReport(reportId: string): Promise<void> {
  const { data, error } = await supabase
    .from('room_reports')
    .delete()
    .eq('id', reportId)
    .select('id');
  if (error) throw new Error(`Could not withdraw report: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Meldingen kan ikke trekkes tilbake');
}
