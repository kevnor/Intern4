import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  canManageUsers,
  corsHeaders,
  generatePassword,
  isNotFoundError,
  jsonResponse,
  textResponse,
} from '../_shared/userManagement.ts';

// Lets a deactivated resident sign in again. If their login was only banned (what deactivating does
// now) the ban is lifted. If it was deleted (what deactivating used to do) it is recreated with the
// same id, so every record that points at the resident still does, and a new temporary password is
// returned for the manager to hand over. A room is not given back.
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
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

    if (!canManageUsers(roleRow?.roles?.name as string | undefined)) {
      return textResponse('Forbidden', 403);
    }

    const body = (await req.json().catch(() => null)) as { userId: string } | null;
    if (!body?.userId) {
      return textResponse('Bad Request: userId required', 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: profileErr } = await adminClient
      .from('users')
      .select('id, email, name, is_active')
      .eq('id', body.userId)
      .maybeSingle();

    if (profileErr) {
      return textResponse('Failed to look up the resident', 500);
    }
    if (!profile?.email) {
      return textResponse('Fant ikke beboeren', 404);
    }

    // Active again first: a new login is only created for an active profile, and a ban lifted
    // for an inactive one would leave them locked out by the app instead.
    const { error: activateErr } = await adminClient
      .from('users')
      .update({ is_active: true })
      .eq('id', profile.id);

    if (activateErr) {
      return textResponse(activateErr.message, 400);
    }

    const { data: existing, error: lookupErr } = await adminClient.auth.admin.getUserById(
      profile.id
    );

    if (lookupErr && !isNotFoundError(lookupErr)) {
      await adminClient.from('users').update({ is_active: false }).eq('id', profile.id);
      return textResponse(lookupErr.message, 400);
    }

    if (existing?.user) {
      const { error: unbanErr } = await adminClient.auth.admin.updateUserById(profile.id, {
        ban_duration: 'none',
      });

      if (unbanErr) {
        await adminClient.from('users').update({ is_active: false }).eq('id', profile.id);
        return textResponse(unbanErr.message, 400);
      }

      return jsonResponse({ success: true });
    }

    // The login is gone: make a new one with the same id.
    const password = generatePassword();
    const attributes = {
      id: profile.id,
      email: profile.email,
      password,
      email_confirm: true,
      user_metadata: { name: profile.name },
    };

    const { error: createErr } = await adminClient.auth.admin.createUser(attributes);

    if (createErr) {
      await adminClient.from('users').update({ is_active: false }).eq('id', profile.id);
      return textResponse(createErr.message, 400);
    }

    return jsonResponse({ success: true, initialPassword: password, email: profile.email });
  }
);
