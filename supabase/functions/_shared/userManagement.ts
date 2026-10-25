// Shared by the create-user, delete-user and reactivate-user functions. Only plain code lives
// here (no imports from the network), so it can be tested with the rest of the project.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Who may add, move out and reactivate residents. Keep in step with residentManagementRoles in
// src/features/users/permissions.ts and with is_user_manager() in the database.
export const USER_MANAGER_ROLES = ['Admin', 'Data', 'Romsjef'];

export const canManageUsers = (role?: string | null): boolean =>
  Boolean(role) && USER_MANAGER_ROLES.includes(role as string);

// Roles that grant management access; only Admin and Data may hand these out, or move out someone
// who holds them. Keep in step with can_manage_role() in the database.
const PRIVILEGED_ROLES = ['Admin', 'Data', 'Regisjef', 'Romsjef', 'Daglig leder'];

// Whether the caller may create, move out or reactivate a user holding targetRole.
export const canManageRole = (callerRole: string, targetRole: string): boolean => {
  if (callerRole === 'Admin') return true;
  if (targetRole === 'Admin') return false;
  if (callerRole === 'Data') return true;
  return !PRIVILEGED_ROLES.includes(targetRole);
};

// Moving a resident out bans their login (see offboard_user_internal) instead of deleting it, so they
// cannot sign in again, with a password or through Microsoft, until reactivated.

// Makes a value safe to use as a whole LIKE/ILIKE pattern: % and _ are wildcards, \\ escapes them.
export const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

type EventClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  };
};

// Adds a line to the log shown on the resident's profile. The log is a record, not part of the
// action itself, so a failure to write it is reported but never undoes what was done.
export async function recordResidentEvent(
  client: EventClient,
  event: {
    userId: string;
    kind: 'added' | 'reactivated';
    actorId: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await client.from('resident_events').insert({
    user_id: event.userId,
    kind: event.kind,
    actor_id: event.actorId,
    details: event.details ?? {},
  });
  if (error) console.error(`Could not log ${event.kind} for ${event.userId}: ${error.message}`);
}

export function generatePassword(length = 12): string {
  // No characters that are easy to mix up when read aloud or copied (0/O, 1/l/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// The auth API says "User not found" in a few different shapes.
export const isNotFoundError = (
  error: { message?: string; status?: number } | null | undefined
): boolean => Boolean(error) && (error?.status === 404 || /not found/i.test(error?.message ?? ''));

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const textResponse = (message: string, status: number): Response =>
  new Response(message, { status, headers: corsHeaders });
