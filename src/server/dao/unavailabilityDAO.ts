import { supabase } from '../supabaseClient';
import type { Unavailability } from '../../features/shifts/types';

type UnavailabilityRow = {
  id: string;
  user_id: string;
  from_date: string;
  to_date: string;
  note: string | null;
};

// 'YYYY-MM-DD' <-> a local calendar day, without shifting it through UTC.
const parseDay = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function toAppUnavailability(row: UnavailabilityRow): Unavailability {
  return {
    id: row.id,
    userId: row.user_id,
    from: parseDay(row.from_date),
    to: parseDay(row.to_date),
    note: row.note,
  };
}

// Residents get their own periods; Admin and Vaktsjef get everyone's (enforced by RLS).
export async function getUnavailability(from: Date, to: Date): Promise<Unavailability[]> {
  const { data, error } = await supabase
    .from('vakt_unavailability')
    .select('id, user_id, from_date, to_date, note')
    .gte('to_date', formatDay(from))
    .lt('from_date', formatDay(to))
    .order('from_date', { ascending: true });
  if (error) throw new Error(`Could not get unavailability: ${error.message}`);
  return ((data ?? []) as UnavailabilityRow[]).map(toAppUnavailability);
}

export async function addUnavailability(
  userId: string,
  from: Date,
  to: Date,
  note?: string
): Promise<void> {
  const { error } = await supabase.from('vakt_unavailability').insert({
    user_id: userId,
    from_date: formatDay(from),
    to_date: formatDay(to),
    note: note?.trim() || null,
  });
  if (error) throw new Error(`Could not add unavailability: ${error.message}`);
}

export async function deleteUnavailability(id: string): Promise<void> {
  const { error } = await supabase.from('vakt_unavailability').delete().eq('id', id);
  if (error) throw new Error(`Could not delete unavailability: ${error.message}`);
}
