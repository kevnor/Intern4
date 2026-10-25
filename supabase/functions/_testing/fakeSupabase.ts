// A small in-memory stand-in for Supabase, for testing the edge functions without a network. It
// knows just enough: the users and roles tables, and the admin auth API. It also behaves like the
// before-user-created hook: a login is only created for an active profile with the same email.

export type Profile = {
  id: string;
  email: string | null;
  name?: string;
  is_active: boolean;
  on_leave?: boolean;
  role_id?: number;
  [key: string]: unknown;
};

export type AuthUser = { id: string; email: string; banned?: boolean; password?: string };

type Failures = Partial<
  Record<
    'profileInsert' | 'createLogin' | 'ban' | 'unban' | 'lookup' | 'offboard' | 'event',
    string
  >
>;

export type ResidentEvent = {
  user_id: string;
  kind: string;
  actor_id?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
};

export function createFakeSupabase(options: {
  callerId: string;
  callerRole: string | null;
  profiles?: Profile[];
  logins?: AuthUser[];
  roles?: { id: number; name: string }[];
  failures?: Failures;
  // What the offboarding function reports it did.
  offboardDetails?: Record<string, unknown>;
}) {
  const roles = options.roles ?? [
    { id: 1, name: 'Admin' },
    { id: 2, name: 'Romsjef' },
    { id: 7, name: 'Halv/Halv' },
  ];
  // Copies, so one test changing a profile does not leak into the next.
  const profiles: Profile[] = (options.profiles ?? []).map((profile) => ({ ...profile }));
  const logins = new Map<string, AuthUser>(
    (options.logins ?? []).map((login) => [login.id, login])
  );
  const failures = options.failures ?? {};
  const events: ResidentEvent[] = [];
  // What happened, in order, so tests can check that the profile comes before the login.
  const log: string[] = [];

  const roleOf = (profile: Profile | undefined) =>
    profile ? { name: roles.find((role) => role.id === profile.role_id)?.name } : null;

  function table(name: string) {
    const rows: Record<string, unknown>[] =
      name === 'users'
        ? (profiles as Record<string, unknown>[])
        : name === 'roles'
          ? roles
          : name === 'schools'
            ? [{ id: 'school-annet', slug: 'annet' }]
            : name === 'studies'
              ? [{ id: 'study-annet', slug: 'annet' }]
              : name === 'resident_events'
                ? (events as unknown as Record<string, unknown>[])
                : [];
    const filters: [string, unknown][] = [];
    let mode: 'select' | 'update' | 'delete' = 'select';
    let patch: Record<string, unknown> = {};

    const matches = (row: Record<string, unknown>, column: string, value: unknown) =>
      value && typeof value === 'object' && 'ilike' in value
        ? String(row[column] ?? '').toLowerCase() === (value as { ilike: string }).ilike
        : row[column] === value;

    const matching = () =>
      rows.filter((row) => filters.every(([column, value]) => matches(row, column, value)));

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      // Case-insensitive match of the whole value; \\ escapes % and _ like in SQL.
      ilike: (column: string, pattern: string) => {
        const wanted = pattern.replace(/\\([\\%_])/g, '$1').toLowerCase();
        filters.push([column, { ilike: wanted }]);
        return builder;
      },
      limit: () => builder,
      update: (values: Record<string, unknown>) => {
        mode = 'update';
        patch = values;
        return builder;
      },
      delete: () => {
        mode = 'delete';
        return builder;
      },
      insert: async (values: Record<string, unknown>) => {
        log.push(`insert ${name}`);
        if (name === 'users' && failures.profileInsert) {
          return { error: { message: failures.profileInsert } };
        }
        if (name === 'resident_events' && failures.event) {
          return { error: { message: failures.event } };
        }
        rows.push(values);
        return { error: null };
      },
      maybeSingle: async () => {
        const row = matching()[0];
        if (name === 'users' && failures.lookup)
          return { data: null, error: { message: failures.lookup } };
        if (name === 'users' && row)
          return { data: { ...row, roles: roleOf(row as Profile) }, error: null };
        return { data: row ?? null, error: null };
      },
      then: (resolve: (value: { data: unknown; error: null }) => unknown) => {
        if (mode === 'update') {
          log.push(`update ${name} ${JSON.stringify(patch)}`);
          for (const row of matching()) Object.assign(row, patch);
        } else if (mode === 'delete') {
          log.push(`delete ${name}`);
          for (const row of matching()) rows.splice(rows.indexOf(row), 1);
        } else {
          return Promise.resolve({ data: matching(), error: null }).then(resolve);
        }
        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
    };
    return builder;
  }

  const admin = {
    createUser: async (attributes: { id?: string; email: string; password?: string }) => {
      log.push('create login');
      if (failures.createLogin)
        return { data: { user: null }, error: { message: failures.createLogin } };
      const allowed = profiles.some(
        (profile) =>
          profile.email?.toLowerCase() === attributes.email.toLowerCase() && profile.is_active
      );
      if (!allowed) {
        return {
          data: { user: null },
          error: { message: 'Du er ikke registrert som beboer. Kontakt romsjef eller Data.' },
        };
      }
      const id = attributes.id ?? crypto.randomUUID();
      const login = { id, email: attributes.email, password: attributes.password };
      logins.set(id, login);
      return { data: { user: login }, error: null };
    },
    getUserById: async (id: string) => {
      log.push('look up login');
      const login = logins.get(id);
      return login
        ? { data: { user: login }, error: null }
        : { data: { user: null }, error: { message: 'User not found', status: 404 } };
    },
    updateUserById: async (id: string, attributes: { ban_duration?: string }) => {
      const banning = attributes.ban_duration !== 'none';
      log.push(banning ? 'ban login' : 'unban login');
      if (banning && failures.ban) return { data: null, error: { message: failures.ban } };
      if (!banning && failures.unban) return { data: null, error: { message: failures.unban } };
      const login = logins.get(id);
      if (!login) return { data: null, error: { message: 'User not found', status: 404 } };
      login.banned = banning;
      return { data: { user: login }, error: null };
    },
    deleteUser: async (id: string) => {
      log.push('delete login');
      logins.delete(id);
      return { error: null };
    },
  };

  // Does what the offboard_user_internal database function does, as far as the edge functions can see.
  const rpc = async (
    name: string,
    args: { p_user_id: string; p_reason?: string | null; p_actor_id?: string | null }
  ) => {
    log.push(`rpc ${name}`);
    if (name !== 'offboard_user_internal') {
      return { data: null, error: { message: `Unknown function ${name}` } };
    }
    if (failures.offboard) return { data: null, error: { message: failures.offboard } };

    const profile = profiles.find((candidate) => candidate.id === args.p_user_id);
    if (!profile) return { data: null, error: { message: 'Fant ikke beboeren' } };
    if (roleOf(profile)?.name === 'Admin') {
      return { data: null, error: { message: 'En administrator kan ikke flyttes ut' } };
    }

    const login = logins.get(args.p_user_id);
    if (login) login.banned = true;
    if (!profile.is_active) return { data: { alreadyInactive: true }, error: null };

    profile.is_active = false;
    profile.on_leave = false;
    const details = options.offboardDetails ?? {
      shiftsReleased: 0,
      romslippSkipped: 0,
      roleReset: null,
    };
    events.push({
      user_id: args.p_user_id,
      kind: 'moved_out',
      actor_id: args.p_actor_id ?? null,
      reason: args.p_reason?.trim() || null,
      details,
    });
    return { data: details, error: null };
  };

  // The client acting for the signed-in caller, and the one with the service role.
  const caller = {
    auth: { getUser: async () => ({ data: { user: { id: options.callerId } }, error: null }) },
    from: (name: string) => table(name),
  };
  const callerProfile: Profile | null = options.callerRole
    ? {
        id: options.callerId,
        email: 'caller@example.no',
        is_active: true,
        role_id: roles.find((role) => role.name === options.callerRole)?.id,
      }
    : null;
  if (callerProfile) profiles.push(callerProfile);

  return {
    profiles,
    logins,
    events,
    log,
    clientFor: (key: string) =>
      key === 'service-key' ? { auth: { admin }, from: table, rpc } : caller,
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
