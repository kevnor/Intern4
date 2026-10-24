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
  Record<'profileInsert' | 'createLogin' | 'ban' | 'unban' | 'lookup', string>
>;

export function createFakeSupabase(options: {
  callerId: string;
  callerRole: string | null;
  profiles?: Profile[];
  logins?: AuthUser[];
  roles?: { id: number; name: string }[];
  failures?: Failures;
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
              : [];
    const filters: [string, unknown][] = [];
    let mode: 'select' | 'update' | 'delete' = 'select';
    let patch: Record<string, unknown> = {};

    const matching = () =>
      rows.filter((row) => filters.every(([column, value]) => row[column] === value));

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
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
    log,
    clientFor: (key: string) => (key === 'service-key' ? { auth: { admin }, from: table } : caller),
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
