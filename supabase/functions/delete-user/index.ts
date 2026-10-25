import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  canManageRole,
  canManageUsers,
  corsHeaders,
  jsonResponse,
  textResponse,
} from '../_shared/userManagement.ts';

// Moves a resident out right away. Who may do it is decided here; what it does (release future
// shifts, skip them in a running romslipp, reset a position role, free the room, ban the login and
// log it) is one database function, offboard_user_internal, shared with the planned-date job. The
// login is banned rather than deleted, so they cannot sign in again until they are reactivated.
Deno.serve(
  async (req: {
    method: string;
    headers: { get: (arg0: string) => string };
    json: () => Promise<unknown>;
  }) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return textResponse('Method not allowed', 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: me, error: meErr } = await userClient.auth.getUser();
    if (meErr || !me?.user) {
      return textResponse('Unauthorized', 401);
    }

    const { data: roleRow, error: roleErr } = await userClient
      .from('users')
      .select('role_id, roles(name)')
      .eq('id', me.user.id)
      .maybeSingle();

    if (roleErr) {
      return textResponse('Unable to verify role', 500);
    }

    const myRole = roleRow?.roles?.name as string | undefined;

    if (!canManageUsers(myRole)) {
      return textResponse('Forbidden', 403);
    }

    const body = (await req.json().catch(() => null)) as {
      userId: string;
      reason?: string;
    } | null;
    if (!body?.userId) {
      return textResponse('Bad Request: userId required', 400);
    }

    if (body.userId === me.user.id) {
      return textResponse('Kan ikke deaktivere din egen bruker', 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: target, error: targetErr } = await adminClient
      .from('users')
      .select('roles(name)')
      .eq('id', body.userId)
      .maybeSingle();

    if (targetErr) {
      return textResponse('Unable to look up user', 500);
    }

    if (!target) {
      return textResponse('Fant ikke brukeren', 404);
    }

    const targetRoleName = (target.roles as { name?: string } | null | undefined)?.name ?? '';
    if (targetRoleName === 'Admin') {
      return textResponse('Kan ikke deaktivere admin-brukere', 403);
    }

    if (!canManageRole(myRole, targetRoleName)) {
      return textResponse(`Du kan ikke flytte ut brukere med rollen ${targetRoleName}`, 403);
    }

    const { data: details, error: offboardErr } = await adminClient.rpc('offboard_user_internal', {
      p_user_id: body.userId,
      p_reason: body.reason ?? null,
      p_actor_id: me.user.id,
    });

    if (offboardErr) {
      return textResponse(offboardErr.message, 400);
    }

    return jsonResponse({ success: true, ...(details ?? {}) });
  }
);
