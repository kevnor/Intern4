// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  canManageUsers,
  corsHeaders,
  escapeLikePattern,
  generatePassword,
  recordResidentEvent,
} from '../_shared/userManagement.ts';

type AddressInput = {
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

type CreateUserInput = {
  email: string;
  name: string;
  phone?: string;
  birthDate?: string; // ISO date string "YYYY-MM-DD"
  address?: AddressInput;
  studyId?: string;
  schoolId?: string;
  profilePicture?: string;
  seniority?: number;
  roomNumber?: number;
  onLeave?: boolean;
  isActive?: boolean;
  role?: string;
};

async function resolveLookupId(
  adminClient: ReturnType<typeof createClient>,
  table: 'schools' | 'studies',
  suppliedId: string | undefined
): Promise<{ id?: string; error?: Response }> {
  const lookupId = suppliedId?.trim();

  if (lookupId) {
    const { data, error } = await adminClient
      .from(table)
      .select('id')
      .eq('id', lookupId)
      .maybeSingle();

    if (error) {
      return {
        error: new Response(`Failed to look up ${table}`, { status: 500, headers: corsHeaders }),
      };
    }

    if (!data?.id) {
      return {
        error: new Response(`Ugyldig ${table === 'schools' ? 'skole' : 'studie'}`, {
          status: 400,
          headers: corsHeaders,
        }),
      };
    }

    return { id: data.id as string };
  }

  const { data, error } = await adminClient
    .from(table)
    .select('id')
    .eq('slug', 'annet')
    .maybeSingle();

  if (error || !data?.id) {
    return {
      error: new Response(`Failed to look up default ${table}`, {
        status: 500,
        headers: corsHeaders,
      }),
    };
  }

  return { id: data.id as string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
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
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const { data: roleRow, error: roleErr } = await userClient
    .from('users')
    .select('role_id, roles(name)')
    .eq('id', me.user.id)
    .maybeSingle();

  if (roleErr) {
    return new Response('Unable to verify role', { status: 500, headers: corsHeaders });
  }

  const myRole = roleRow?.roles?.name as string | undefined;

  if (!myRole) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  if (!canManageUsers(myRole)) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  const body = (await req.json().catch(() => null)) as CreateUserInput | null;
  if (!body || !body.email || !body.name) {
    return new Response('Bad Request: name and email required', {
      status: 400,
      headers: corsHeaders,
    });
  }

  const password = generatePassword();
  const email = body.email.trim();

  const adminClient = createClient(supabaseUrl, serviceKey);

  // The same address in another case is the same person, and the sign-in gate matches that way too.
  const { data: sameEmail, error: sameEmailErr } = await adminClient
    .from('users')
    .select('id')
    .ilike('email', escapeLikePattern(email))
    .limit(1);

  if (sameEmailErr) {
    return new Response('Failed to check the email', { status: 500, headers: corsHeaders });
  }

  if (sameEmail && sameEmail.length > 0) {
    return new Response('Det finnes allerede en beboer med denne e-postadressen', {
      status: 409,
      headers: corsHeaders,
    });
  }

  const roleName = body.role ?? 'Halv/Halv';
  const { data: roleLookup, error: roleLookupErr } = await adminClient
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .maybeSingle();

  if (roleLookupErr) {
    return new Response('Failed to look up role', { status: 500, headers: corsHeaders });
  }

  if (!roleLookup?.id) {
    return new Response(`Ugyldig rolle: ${roleName}`, { status: 400, headers: corsHeaders });
  }

  const schoolLookup = await resolveLookupId(adminClient, 'schools', body.schoolId);
  if (schoolLookup.error) return schoolLookup.error;

  const studyLookup = await resolveLookupId(adminClient, 'studies', body.studyId);
  if (studyLookup.error) return studyLookup.error;

  const address = body.address ?? {};

  // The profile goes in first, with the id the login will get. The login can then only be created
  // for someone who already has a profile (the before-user-created hook checks that), and a
  // failure leaves nothing half-made behind.
  const userId = crypto.randomUUID();

  const { error: profileErr } = await adminClient.from('users').insert({
    id: userId,
    email,
    name: body.name,
    phone: body.phone ?? null,
    birth_date: body.birthDate ? new Date(body.birthDate).toISOString() : null,
    street: address.street ?? null,
    postal_code: address.postalCode ?? null,
    city: address.city ?? null,
    country: address.country ?? null,
    school_id: schoolLookup.id ?? null,
    profile_picture: body.profilePicture ?? null,
    study_id: studyLookup.id ?? null,
    seniority: body.seniority ?? 0,
    room_number: body.roomNumber ?? 0,
    on_leave: body.onLeave ?? false,
    is_active: body.isActive ?? true,
    role_id: roleLookup.id,
  });

  if (profileErr) {
    return new Response(profileErr.message, { status: 400, headers: corsHeaders });
  }

  // A variable rather than an inline object: `id` is accepted by the auth API but is missing from
  // some versions of the client's type.
  const attributes = {
    id: userId,
    email,
    password,
    email_confirm: true,
    user_metadata: { name: body.name },
  };

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser(attributes);

  if (createErr || !created?.user) {
    // Take the profile back, so the email can be tried again.
    await adminClient.from('users').delete().eq('id', userId);
    const msg = createErr?.message ?? 'Failed to create user';
    return new Response(msg, { status: 400, headers: corsHeaders });
  }

  await recordResidentEvent(adminClient, {
    userId,
    kind: 'added',
    actorId: me.user.id,
    details: { role: roleName },
  });

  return new Response(JSON.stringify({ user: created.user, initialPassword: password }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-user' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
