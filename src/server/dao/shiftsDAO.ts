import { supabase } from '../supabaseClient';
import type {
  Shift,
  ShiftSlot,
  ShiftStatus,
  SlotType,
  SwapLogEntry,
} from '../../features/shifts/types';

type ShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  slot_type: SlotType;
  user_id: string | null;
  status: ShiftStatus;
  swap_requested: boolean;
  swap_offer_amount: number | string | null;
  swap_note: string | null;
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
    swapRequested: row.swap_requested,
    swapOfferAmount: row.swap_offer_amount === null ? null : Number(row.swap_offer_amount),
    swapNote: row.swap_note,
  };
}

// Residents only receive published shifts; managers also receive drafts (enforced by RLS).
export async function getShifts(from: Date, to: Date): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('vakt_shifts')
    .select(
      'id, starts_at, ends_at, slot_type, user_id, status, swap_requested, swap_offer_amount, swap_note, users(name)'
    )
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

type SwapLogRow = {
  id: string;
  shift_starts_at: string;
  slot_type: SlotType;
  from_user_id: string | null;
  to_user_id: string | null;
  amount: number | string | null;
  paid: boolean;
  created_at: string;
  from_user?: { name?: string | null } | { name?: string | null }[] | null;
  to_user?: { name?: string | null } | { name?: string | null }[] | null;
};

function toAppSwapLogEntry(row: SwapLogRow): SwapLogEntry {
  return {
    id: row.id,
    shiftStartsAt: new Date(row.shift_starts_at),
    slotType: row.slot_type,
    fromUserId: row.from_user_id,
    fromUserName: getUserName(row.from_user),
    toUserId: row.to_user_id,
    toUserName: getUserName(row.to_user),
    amount: row.amount === null ? null : Number(row.amount),
    paid: row.paid,
    createdAt: new Date(row.created_at),
  };
}

// Residents get the swaps they were part of; Admin and Vaktsjef get all (enforced by RLS).
export async function getSwapLog(): Promise<SwapLogEntry[]> {
  const { data, error } = await supabase
    .from('vakt_swap_log')
    .select(
      'id, shift_starts_at, slot_type, from_user_id, to_user_id, amount, paid, created_at, from_user:users!vakt_swap_log_from_user_id_fkey(name), to_user:users!vakt_swap_log_to_user_id_fkey(name)'
    )
    .order('shift_starts_at', { ascending: false });
  if (error) throw new Error(`Could not get swaps: ${error.message}`);
  return ((data ?? []) as unknown as SwapLogRow[]).map(toAppSwapLogEntry);
}

// Swaps change shifts through database functions that check the caller owns the shift, the shift
// is published and in the future, and so on. Residents can't update the table directly.
export async function requestSwap(shiftId: string, amount: number | null, note: string) {
  const { error } = await supabase.rpc('request_vakt_swap', {
    p_shift_id: shiftId,
    p_amount: amount,
    p_note: note,
  });
  if (error) throw new Error(`Could not request swap: ${error.message}`);
}

export async function cancelSwap(shiftId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_vakt_swap', { p_shift_id: shiftId });
  if (error) throw new Error(`Could not cancel swap: ${error.message}`);
}

export async function claimShift(shiftId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_vakt_shift', { p_shift_id: shiftId });
  if (error) throw new Error(`Could not claim shift: ${error.message}`);
}

export async function setSwapPaid(logId: string, paid: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_vakt_swap_paid', { p_log_id: logId, p_paid: paid });
  if (error) throw new Error(`Could not update swap: ${error.message}`);
}
