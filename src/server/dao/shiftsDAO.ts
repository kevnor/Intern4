import { supabase } from '../supabaseClient';
import type { Shift, ShiftSlot, ShiftStatus, SlotType } from '../../features/shifts/types';

type ShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  slot_type: SlotType;
  user_id: string | null;
  status: ShiftStatus;
  users?: { name?: string | null } | { name?: string | null }[] | null;
};

const getUserName = (users: ShiftRow['users']): string | null => {
  const user = Array.isArray(users) ? users[0] : users;
  return user?.name ?? null;
};

function toAppShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    slotType: row.slot_type,
    userId: row.user_id,
    userName: getUserName(row.users),
    status: row.status,
  };
}

// Residents only receive published shifts; managers also receive drafts (enforced by RLS).
export async function getShifts(from: Date, to: Date): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('vakt_shifts')
    .select('id, starts_at, ends_at, slot_type, user_id, status, users(name)')
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw new Error(`Could not get shifts: ${error.message}`);
  return ((data ?? []) as ShiftRow[]).map(toAppShift);
}

// Slots that already exist are left untouched, so this is safe to run again.
export async function createShiftSlots(slots: ShiftSlot[]): Promise<void> {
  if (slots.length === 0) return;
  const { error } = await supabase.from('vakt_shifts').upsert(
    slots.map((slot) => ({
      starts_at: slot.startsAt.toISOString(),
      ends_at: slot.endsAt.toISOString(),
      slot_type: slot.slotType,
      status: 'draft',
    })),
    { onConflict: 'starts_at', ignoreDuplicates: true }
  );
  if (error) throw new Error(`Could not create shifts: ${error.message}`);
}

type ShiftWriteFields = Pick<Shift, 'id' | 'startsAt' | 'endsAt' | 'slotType'>;

// Sets who has each shift in one request. The full row is sent because an upsert has to pass the
// NOT NULL checks even though every row already exists.
export async function assignShiftUsers(
  assignments: (ShiftWriteFields & { userId: string | null })[]
): Promise<void> {
  if (assignments.length === 0) return;
  const { error } = await supabase.from('vakt_shifts').upsert(
    assignments.map((assignment) => ({
      id: assignment.id,
      starts_at: assignment.startsAt.toISOString(),
      ends_at: assignment.endsAt.toISOString(),
      slot_type: assignment.slotType,
      user_id: assignment.userId,
    })),
    { onConflict: 'id' }
  );
  if (error) throw new Error(`Could not assign shifts: ${error.message}`);
}

export async function setShiftUser(shiftId: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from('vakt_shifts')
    .update({ user_id: userId })
    .eq('id', shiftId);
  if (error) throw new Error(`Could not update shift: ${error.message}`);
}

// Removes everyone from the unpublished shifts in the period; published shifts are left alone.
export async function clearDraftAssignments(from: Date, to: Date): Promise<void> {
  const { error } = await supabase
    .from('vakt_shifts')
    .update({ user_id: null })
    .eq('status', 'draft')
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString());
  if (error) throw new Error(`Could not clear assignments: ${error.message}`);
}

export async function publishShifts(from: Date, to: Date): Promise<void> {
  const { error } = await supabase
    .from('vakt_shifts')
    .update({ status: 'published' })
    .eq('status', 'draft')
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString());
  if (error) throw new Error(`Could not publish shifts: ${error.message}`);
}
