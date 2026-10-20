import { supabase } from '../supabaseClient';

// Finished, published shifts per resident since `from`, for one resident or for everyone.
export async function getCompletedShiftCounts(
  from: Date,
  now: Date = new Date(),
  userId?: string
): Promise<Record<string, number>> {
  let query = supabase
    .from('vakt_shifts')
    .select('user_id')
    .eq('status', 'published')
    .not('user_id', 'is', null)
    .gte('starts_at', from.toISOString())
    .lte('ends_at', now.toISOString());
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw new Error(`Could not get completed shifts: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { user_id: string }[]) {
    counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
  }
  return counts;
}
