import { supabase } from '../supabaseClient';

export async function getRequiredHours(semesterKey: string): Promise<number | undefined> {
  const { data, error } = await supabase
    .from('semester_settings')
    .select('required_hours')
    .eq('semester_key', semesterKey)
    .maybeSingle();
  if (error) throw new Error(`Could not get semester settings: ${error.message}`);
  return data ? Number(data.required_hours) : undefined;
}

export async function setRequiredHours(semesterKey: string, hours: number): Promise<void> {
  const { error } = await supabase
    .from('semester_settings')
    .upsert(
      { semester_key: semesterKey, required_hours: hours, updated_at: new Date().toISOString() },
      { onConflict: 'semester_key' }
    );
  if (error) throw new Error(`Could not save semester settings: ${error.message}`);
}
