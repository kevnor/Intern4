import { supabase } from '../supabaseClient';
import { formatDateColumnValue } from '../../shared/utils/date';
import { LookupOption } from '../../shared/types/lookup';
import {
  BasicUserWithRole,
  NewUserInput,
  ResidentDirectoryUser,
  Role,
  UpdateUserInput,
  User,
} from '../../shared/types/user';

type SupabaseJoin<T> = T | T[] | null | undefined;

type LookupJoin = {
  name?: string | null;
};

type RoleJoin = {
  name?: string | null;
};

type UserRow = {
  name?: string | null;
  email?: string | null;
  birth_date?: string | Date | null;
  phone?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  profile_picture?: string | null;
  school_id?: string | null;
  study_id?: string | null;
  schools?: SupabaseJoin<LookupJoin>;
  studies?: SupabaseJoin<LookupJoin>;
  seniority?: number | null;
  room_number?: number | null;
  on_leave?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | Date | null;
  roles?: SupabaseJoin<RoleJoin>;
};

type ResidentDirectoryUserRow = UserRow & {
  id: string;
  birth_date?: string | null;
  created_at?: string | null;
  roles?: SupabaseJoin<RoleJoin>;
};

type BasicUserWithRoleRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  roles?: SupabaseJoin<RoleJoin>;
  on_leave?: boolean | null;
  is_active?: boolean | null;
};

type UserUpdatePayload = {
  name?: string;
  email?: string;
  birth_date?: string;
  phone?: string;
  school_id?: string;
  profile_picture?: string;
  study_id?: string;
  seniority?: number;
  room_number?: number;
  on_leave?: boolean;
  is_active?: boolean;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  role_id?: number;
};

type SupabaseResult<Row> = {
  data: Row[] | null;
  error: { message: string } | null;
};

type CreateUserResult = {
  user: {
    id: string;
  };
  initialPassword?: string;
};

// Non-2xx responses arrive as a generic "non-2xx status code" error; the function's own
// (Norwegian) message is in the response body.
async function readFunctionError(error: { message?: string; context?: unknown }) {
  if (error.context instanceof Response) {
    const text = await error.context.text().catch(() => '');
    if (text) return text;
  }
  return error.message;
}

const FUNCTION_TIMEOUT_MS = 20_000;

// supabase.functions.invoke has no timeout; without one a hung function spins forever.
async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  fallbackError: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Tjenesten svarte ikke. Prøv igjen om litt.')),
      FUNCTION_TIMEOUT_MS
    );
  });

  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke(name, { body }),
      timeout,
    ]);
    if (error) throw new Error((await readFunctionError(error)) || fallbackError);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

function getJoinedName(value: SupabaseJoin<LookupJoin | RoleJoin>): string {
  const joined = Array.isArray(value) ? value[0] : value;
  return joined?.name ?? '';
}

function normalizeOptionalId(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function toAppUser(row: UserRow): User {
  return {
    name: row.name ?? '',
    email: row.email ?? '',
    birthDate: row.birth_date ? new Date(row.birth_date) : undefined,
    phone: row.phone ?? '',
    address: {
      street: row.street ?? '',
      postalCode: row.postal_code ?? '',
      city: row.city ?? '',
      country: row.country ?? '',
    },
    profilePicture: row.profile_picture ?? '',
    schoolId: row.school_id ?? undefined,
    studyId: row.study_id ?? undefined,
    studyPlace: getJoinedName(row.schools),
    study: getJoinedName(row.studies) || 'Annet',
    seniority: row.seniority ?? 0,
    roomNumber: row.room_number ?? 0,
    onLeave: row.on_leave ?? false,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
    role: getJoinedName(row.roles),
  };
}

export async function getUser(uid: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from('users')
    .select('*, schools(name), studies(name), roles(name)')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAppUser(data as UserRow) : undefined;
}

export type UserLookup = { name: string; email: string };

// Looks up many users in one query; ids without a matching row are left out.
export async function getUserLookups(ids: string[]): Promise<Record<string, UserLookup>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', uniqueIds);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{ id: string; name: string | null; email: string | null }>).reduce(
    (acc, row) => {
      acc[row.id] = { name: row.name ?? '', email: row.email ?? '' };
      return acc;
    },
    {} as Record<string, UserLookup>
  );
}

export async function getUserNames(ids: string[]): Promise<Record<string, string>> {
  const lookups = await getUserLookups(ids);
  return Object.fromEntries(Object.entries(lookups).map(([id, user]) => [id, user.name]));
}

export async function updateUser(uid: string, data: UpdateUserInput): Promise<void> {
  const payload: UserUpdatePayload = {
    name: data.name,
    email: data.email,
    birth_date: data.birthDate ? formatDateColumnValue(data.birthDate) : undefined,
    phone: data.phone,
    school_id: data.schoolId,
    profile_picture: data.profilePicture,
    study_id: data.studyId,
    seniority: data.seniority,
    room_number: data.roomNumber,
    on_leave: data.onLeave,
    is_active: data.isActive,
    street: data.address?.street,
    postal_code: data.address?.postalCode,
    city: data.address?.city,
    country: data.address?.country,
    role_id: data.roleId ? Number(data.roleId) : undefined,
  };
  (Object.keys(payload) as (keyof UserUpdatePayload)[]).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  const { data: updated, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', uid)
    .select('id');
  // 42501 is raised by the guard_user_privileged_columns trigger with a readable message.
  if (error)
    throw new Error(error.code === '42501' ? error.message : 'Kunne ikke oppdatere beboer');
  // Row-level security turns a forbidden update into "0 rows" rather than an error.
  if (!updated || updated.length === 0) {
    throw new Error('Du har ikke tilgang til å endre denne beboeren.');
  }
}

export async function createUser(
  data: NewUserInput
): Promise<{ id: string; initialPassword?: string }> {
  const payload = {
    email: data.email,
    name: data.name,
    phone: data.phone,
    birthDate: data.birthDate ? data.birthDate.toISOString().slice(0, 10) : undefined,
    address: {
      street: data.address?.street,
      postalCode: data.address?.postalCode,
      city: data.address?.city,
      country: data.address?.country,
    },
    schoolId: normalizeOptionalId(data.schoolId),
    studyId: normalizeOptionalId(data.studyId),
    profilePicture: data.profilePicture,
    seniority: data.seniority,
    roomNumber: data.roomNumber,
    onLeave: data.onLeave,
    isActive: data.isActive,
    role: data.role,
  };

  const createUserResult = await invokeFunction<CreateUserResult>(
    'create-user',
    payload,
    'Kunne ikke opprette beboer'
  );
  return {
    id: createUserResult.user.id,
    initialPassword: createUserResult.initialPassword,
  };
}

function toResidentDirectoryUser(row: ResidentDirectoryUserRow): ResidentDirectoryUser {
  return {
    id: row.id,
    name: row.name ?? 'Ukjent',
    email: row.email ?? '',
    phone: row.phone ?? '',
    birthDate: row.birth_date ?? null,
    study: getJoinedName(row.studies),
    studyPlace: getJoinedName(row.schools),
    seniority: row.seniority ?? 0,
    roomNumber: row.room_number ?? null,
    createdAt: row.created_at ?? null,
    profilePicture: row.profile_picture ?? undefined,
    role: getJoinedName(row.roles) || undefined,
    onLeave: row.on_leave ?? false,
    isActive: row.is_active ?? false,
    address: {
      street: row.street ?? '',
      postalCode: row.postal_code ?? '',
      city: row.city ?? '',
      country: row.country ?? undefined,
    },
  };
}

function toBasicUserWithRole(row: BasicUserWithRoleRow): BasicUserWithRole {
  return {
    id: row.id,
    name: row.name ?? 'Ukjent',
    email: row.email ?? '',
    role: getJoinedName(row.roles) || undefined,
    onLeave: row.on_leave ?? false,
    isActive: row.is_active ?? false,
  };
}

function mapBasicUsersWithRole(result: SupabaseResult<BasicUserWithRoleRow>): BasicUserWithRole[] {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(toBasicUserWithRole);
}

export async function getResidentDirectoryUsers(
  isActive: boolean
): Promise<ResidentDirectoryUser[]> {
  const activeResidentColumns = [
    'id',
    'name',
    'email',
    'phone',
    'birth_date',
    'study_id',
    'school_id',
    'studies(name)',
    'schools(name)',
    'seniority',
    'room_number',
    'created_at',
    'is_active',
    'on_leave',
    'profile_picture',
    'roles(name)',
  ];
  const oldResidentColumns = [
    'id',
    'name',
    'street',
    'postal_code',
    'city',
    'country',
    'is_active',
  ];

  const { data, error } = await supabase
    .from('users')
    .select((isActive ? activeResidentColumns : oldResidentColumns).join(', '))
    .eq('is_active', isActive)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as ResidentDirectoryUserRow[]).map(toResidentDirectoryUser);
}

export async function getActiveUsersWithRole(): Promise<BasicUserWithRole[]> {
  const result = await supabase
    .from('users')
    .select('id, name, email, is_active, on_leave, roles(name)')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return mapBasicUsersWithRole(result as unknown as SupabaseResult<BasicUserWithRoleRow>);
}

export async function getAllUsersWithRole(): Promise<BasicUserWithRole[]> {
  const result = await supabase
    .from('users')
    .select('id, name, email, is_active, on_leave, roles(name)')
    .order('name', { ascending: true });

  return mapBasicUsersWithRole(result as unknown as SupabaseResult<BasicUserWithRoleRow>);
}

export async function deleteUser(userId: string): Promise<void> {
  await invokeFunction('delete-user', { userId }, 'Kunne ikke deaktivere bruker');
}

export async function reactivateUser(userId: string): Promise<void> {
  await invokeFunction('reactivate-user', { userId }, 'Kunne ikke reaktivere bruker');
}

export async function getRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSchools(): Promise<LookupOption[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStudies(): Promise<LookupOption[]> {
  const { data, error } = await supabase
    .from('studies')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
