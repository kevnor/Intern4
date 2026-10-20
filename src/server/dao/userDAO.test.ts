import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createUser,
  getResidentDirectoryUsers,
  getSchools,
  getStudies,
  getUser,
  reactivateUser,
  updateUser,
} from './userDAO';
import { supabase } from '../supabaseClient';
import { NewUserInput, UpdateUserInput } from '../../shared/types/user';

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

type SupabaseFromResult = ReturnType<typeof supabase.from>;
type MockFn = ReturnType<typeof vi.fn>;

const mockFn = (implementation: (...args: unknown[]) => unknown): MockFn =>
  vi.fn(implementation) as unknown as MockFn;

const asSupabaseBuilder = <T extends object>(builder: T): T & SupabaseFromResult =>
  builder as T & SupabaseFromResult;

function createResidentDirectoryBuilder(data: unknown[]) {
  const builder: {
    select: MockFn;
    eq: MockFn;
    order: MockFn;
  } = {
    select: mockFn(() => builder),
    eq: mockFn(() => builder),
    order: mockFn(async () => ({ data, error: null })),
  };

  return asSupabaseBuilder(builder);
}

describe('userDAO resident directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads active resident directory rows with full contact and study fields', async () => {
    const builder = createResidentDirectoryBuilder([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Test Beboer En',
        email: 'test.beboer.en@example.test',
        phone: '40000001',
        birth_date: '2000-01-01',
        study_id: 'study-biotek',
        school_id: 'school-ntnu',
        studies: { name: 'Bioteknologi' },
        schools: { name: 'NTNU' },
        seniority: 4,
        room_number: 101,
        created_at: '2024-08-15T00:00:00.000Z',
        is_active: true,
        on_leave: false,
        roles: { name: 'Halv/Halv' },
      },
    ]);

    vi.mocked(supabase.from).mockImplementationOnce(() => builder);

    const result = await getResidentDirectoryUsers(true);

    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(builder.select).toHaveBeenCalledWith(
      [
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
      ].join(', ')
    );
    expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    expect(builder.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(result).toEqual([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Test Beboer En',
        email: 'test.beboer.en@example.test',
        phone: '40000001',
        birthDate: '2000-01-01',
        study: 'Bioteknologi',
        studyPlace: 'NTNU',
        seniority: 4,
        roomNumber: 101,
        createdAt: '2024-08-15T00:00:00.000Z',
        role: 'Halv/Halv',
        onLeave: false,
        isActive: true,
        address: {
          street: '',
          postalCode: '',
          city: '',
          country: undefined,
        },
      },
    ]);
  });

  it('loads inactive old residents and defaults missing optional fields', async () => {
    const builder = createResidentDirectoryBuilder([
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: null,
        street: null,
        postal_code: '7016',
        city: null,
        country: null,
        is_active: false,
      },
    ]);

    vi.mocked(supabase.from).mockImplementationOnce(() => builder);

    const result = await getResidentDirectoryUsers(false);

    expect(builder.select).toHaveBeenCalledWith(
      ['id', 'name', 'street', 'postal_code', 'city', 'country', 'is_active'].join(', ')
    );
    expect(builder.eq).toHaveBeenCalledWith('is_active', false);
    expect(result[0]).toMatchObject({
      name: 'Ukjent',
      email: '',
      phone: '',
      birthDate: null,
      study: '',
      studyPlace: '',
      seniority: 0,
      roomNumber: null,
      createdAt: null,
      role: undefined,
      onLeave: false,
      isActive: false,
      address: {
        street: '',
        postalCode: '7016',
        city: '',
        country: undefined,
      },
    });
  });
});

describe('userDAO profile and lookup writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a user with joined school and study names', async () => {
    const builder: {
      select: MockFn;
      eq: MockFn;
      maybeSingle: MockFn;
    } = {
      select: mockFn(() => builder),
      eq: mockFn(() => builder),
      maybeSingle: mockFn(async () => ({
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Test Beboer',
          email: 'test@example.test',
          phone: '40000001',
          birth_date: '2000-01-01',
          school_id: 'school-ntnu',
          study_id: 'study-data',
          schools: { name: 'NTNU' },
          studies: { name: 'Datateknologi' },
          seniority: 1,
          room_number: 101,
          on_leave: false,
          is_active: true,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        error: null,
      })),
    };

    vi.mocked(supabase.from).mockImplementationOnce(() => asSupabaseBuilder(builder));

    const result = await getUser('11111111-1111-1111-1111-111111111111');

    expect(builder.select).toHaveBeenCalledWith('*, schools(name), studies(name), roles(name)');
    expect(result).toMatchObject({
      schoolId: 'school-ntnu',
      studyId: 'study-data',
      studyPlace: 'NTNU',
      study: 'Datateknologi',
    });
  });

  it('updates school_id and study_id when saving a user', async () => {
    const builder: {
      update: MockFn;
      eq: MockFn;
      select: MockFn;
    } = {
      update: mockFn(() => builder),
      eq: mockFn(() => builder),
      select: mockFn(async () => ({ data: [{ id: '1' }], error: null })),
    };

    vi.mocked(supabase.from).mockImplementationOnce(() => asSupabaseBuilder(builder));

    await updateUser('11111111-1111-1111-1111-111111111111', {
      name: 'Test Beboer',
      schoolId: 'school-bi',
      studyId: 'study-okad',
    });

    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(builder.update).toHaveBeenCalledWith({
      name: 'Test Beboer',
      school_id: 'school-bi',
      study_id: 'study-okad',
    });
    expect(builder.eq).toHaveBeenCalledWith('id', '11111111-1111-1111-1111-111111111111');
  });

  it('reports when an update was blocked instead of pretending it saved', async () => {
    const builder: { update: MockFn; eq: MockFn; select: MockFn } = {
      update: mockFn(() => builder),
      eq: mockFn(() => builder),
      select: mockFn(async () => ({ data: [], error: null })),
    };
    vi.mocked(supabase.from).mockImplementationOnce(() => asSupabaseBuilder(builder));

    await expect(updateUser('someone-else', { roomNumber: 101 })).rejects.toThrow(
      'Du har ikke tilgang til å endre denne beboeren.'
    );
  });

  it('shows the database guard message for forbidden field changes', async () => {
    const builder: { update: MockFn; eq: MockFn; select: MockFn } = {
      update: mockFn(() => builder),
      eq: mockFn(() => builder),
      select: mockFn(async () => ({
        data: null,
        error: { code: '42501', message: 'Kun Admin og Data kan endre roller' },
      })),
    };
    vi.mocked(supabase.from).mockImplementationOnce(() => asSupabaseBuilder(builder));

    await expect(updateUser('someone', { roleId: '3' })).rejects.toThrow(
      'Kun Admin og Data kan endre roller'
    );
    expect(builder.update).toHaveBeenCalledWith({ role_id: 3 });
  });

  it('shows the edge function’s own message when it refuses', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response('Brukeren har ingen innlogging lenger – opprett brukeren på nytt.', {
          status: 409,
        }),
      },
    } as never);

    await expect(reactivateUser('old-user')).rejects.toThrow(
      'Brukeren har ingen innlogging lenger – opprett brukeren på nytt.'
    );
    expect(supabase.functions.invoke).toHaveBeenCalledWith('reactivate-user', {
      body: { userId: 'old-user' },
    });
  });

  it('passes lookup ids to the create-user function', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { user: { id: '11111111-1111-1111-1111-111111111111' }, initialPassword: 'abc123' },
      error: null,
    });

    const result = await createUser({
      name: 'Test Beboer',
      email: 'test@example.test',
      address: {},
      role: 'Halv/Halv',
      schoolId: 'school-ntnu',
      studyId: 'study-data',
      seniority: 0,
      roomNumber: 0,
      onLeave: false,
      isActive: true,
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-user', {
      body: expect.objectContaining({
        schoolId: 'school-ntnu',
        studyId: 'study-data',
      }),
    });
    expect(result).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      initialPassword: 'abc123',
    });

    await createUser({
      name: 'Annet Beboer',
      email: 'annet@example.test',
      address: {},
      role: 'Halv/Halv',
      schoolId: '  ',
      studyId: '',
      seniority: 0,
      roomNumber: 0,
      onLeave: false,
      isActive: true,
    });

    expect(supabase.functions.invoke).toHaveBeenLastCalledWith('create-user', {
      body: expect.objectContaining({
        schoolId: undefined,
        studyId: undefined,
      }),
    });
  });

  it('keeps school and study writes id-only at the type boundary', () => {
    expectTypeOf<NewUserInput>().toHaveProperty('schoolId');
    expectTypeOf<NewUserInput>().toHaveProperty('studyId');
    expectTypeOf<NewUserInput>().not.toHaveProperty('study');
    expectTypeOf<NewUserInput>().not.toHaveProperty('studyPlace');
    expectTypeOf<UpdateUserInput>().not.toHaveProperty('study');
    expectTypeOf<UpdateUserInput>().not.toHaveProperty('studyPlace');
  });

  it('loads school and study lookup options', async () => {
    const schoolsBuilder: {
      select: MockFn;
      order: MockFn;
    } = {
      select: mockFn(() => schoolsBuilder),
      order: mockFn(async () => ({ data: [{ id: 'school-ntnu', name: 'NTNU' }], error: null })),
    };
    const studiesBuilder: {
      select: MockFn;
      order: MockFn;
    } = {
      select: mockFn(() => studiesBuilder),
      order: mockFn(async () => ({
        data: [{ id: 'study-data', name: 'Datateknologi' }],
        error: null,
      })),
    };

    vi.mocked(supabase.from)
      .mockImplementationOnce(() => asSupabaseBuilder(schoolsBuilder))
      .mockImplementationOnce(() => asSupabaseBuilder(studiesBuilder));

    await expect(getSchools()).resolves.toEqual([{ id: 'school-ntnu', name: 'NTNU' }]);
    await expect(getStudies()).resolves.toEqual([{ id: 'study-data', name: 'Datateknologi' }]);
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'schools');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'studies');
  });
});
