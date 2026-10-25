import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BAN_DURATION,
  canManageUsers,
  corsHeaders,
  isNotFoundError,
  jsonResponse,
  textResponse,
} from '../_shared/userManagement.ts';

// Deactivates a resident. Their login is banned rather than deleted, so they cannot sign in again
// (with a password or through Microsoft) until they are reactivated, and the history stays intact.
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

    const body = (await req.json().catch(() => null)) as { userId: string } | null;
    if (!body?.userId) {
      return textResponse('Bad Request: userId required', 400);
    }

    if (body.userId === me.user.id) {
      return textResponse('Kan ikke deaktivere din egen bruker', 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Prevent deactivation of admin users
    const { data: targetRole } = await adminClient
      .from('users')
      .select('roles(name)')
      .eq('id', body.userId)
      .maybeSingle();

    const targetRoleName = (targetRole?.roles as { name?: string } | null | undefined)?.name;
    if (targetRoleName === 'Admin') {
      return textResponse('Kan ikke deaktivere admin-brukere', 403);
    }

    // Ban the login. Older residents may have no login at all (it used to be deleted), which is fine.
    const { error: banErr } = await adminClient.auth.admin.updateUserById(body.userId, {
      ban_duration: BAN_DURATION,
    });

    if (banErr && !isNotFoundError(banErr)) {
      return textResponse(banErr.message, 400);
    }

    const { error: profileErr } = await adminClient
      .from('users')
      .update({
        is_active: false,
        on_leave: false,
      })
      .eq('id', body.userId);

    if (profileErr) {
      return textResponse(profileErr.message, 400);
    }

    return jsonResponse({ success: true });
  }
);
