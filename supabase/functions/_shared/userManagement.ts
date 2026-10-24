// Shared by the create-user, delete-user and reactivate-user functions. Only plain code lives
// here (no imports from the network), so it can be tested with the rest of the project.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Who may add, deactivate and reactivate residents. Keep in step with roomManagementRoles in
// src/features/users/permissions.ts (Admin, Romsjef, Data), plus Regisjef, who could already.
export const USER_MANAGER_ROLES = ['Admin', 'Data', 'Romsjef', 'Regisjef'];

export const canManageUsers = (role?: string | null): boolean =>
  Boolean(role) && USER_MANAGER_ROLES.includes(role as string);

// A deactivated resident's login is banned for this long (about a hundred years) instead of being
// deleted, so they cannot sign in again, with a password or through Microsoft, until reactivated.
export const BAN_DURATION = '876000h';

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
