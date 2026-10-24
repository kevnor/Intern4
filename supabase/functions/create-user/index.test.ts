import { afterEach, describe, expect, it } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '../_testing/fakeSupabase';
import { loadFunction, post } from '../_testing/loadFunction';

let fake: FakeSupabase;
const load = () =>
  loadFunction(
    () => import('./index'),
    () => fake
  );

const NEW_RESIDENT = { email: 'Kari.Nordmann@Example.no', name: 'Kari Nordmann' };

const romsjef = (options: Partial<Parameters<typeof createFakeSupabase>[0]> = {}) =>
  createFakeSupabase({ callerId: 'romsjef', callerRole: 'Romsjef', ...options });

afterEach(() => {
  fake = undefined as never;
});

describe('create-user', () => {
  it('creates the profile first and then the login with the same id', async () => {
    fake = romsjef();

    const response = await (await load())(post(NEW_RESIDENT));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fake.log.indexOf('insert users')).toBeLessThan(fake.log.indexOf('create login'));
    expect(body.initialPassword).toMatch(/^[A-Za-z0-9]{12}$/);

    const profile = fake.profiles.find((p) => p.email === NEW_RESIDENT.email);
    expect(profile).toMatchObject({ name: 'Kari Nordmann', is_active: true, role_id: 7 });
    expect(fake.logins.get(profile!.id)).toMatchObject({
      email: NEW_RESIDENT.email,
      password: body.initialPassword,
    });
    expect(body.user.id).toBe(profile!.id);
  });

  it('takes the profile back when the login cannot be created, so the email can be tried again', async () => {
    fake = romsjef({ failures: { createLogin: 'Database error creating user' } });

    const response = await (await load())(post(NEW_RESIDENT));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Database error creating user');
    expect(fake.profiles.find((p) => p.email === NEW_RESIDENT.email)).toBeUndefined();
    expect(fake.log).toContain('delete users');
  });

  it('does not create a login when the profile cannot be saved', async () => {
    fake = romsjef({
      failures: { profileInsert: 'duplicate key value violates unique constraint' },
    });

    const response = await (await load())(post(NEW_RESIDENT));

    expect(response.status).toBe(400);
    expect(fake.log).not.toContain('create login');
    expect(fake.logins.size).toBe(0);
  });

  it('is refused by the login gate for a resident created as inactive, and leaves nothing behind', async () => {
    fake = romsjef();

    const response = await (await load())(post({ ...NEW_RESIDENT, isActive: false }));

    expect(response.status).toBe(400);
    expect(fake.profiles.find((p) => p.email === NEW_RESIDENT.email)).toBeUndefined();
    expect(fake.logins.size).toBe(0);
  });

  it('lets Romsjef and Admin add residents, but not an ordinary resident', async () => {
    for (const [role, expected] of [
      ['Admin', 200],
      ['Romsjef', 200],
      ['Halv/Halv', 403],
    ] as const) {
      fake = createFakeSupabase({ callerId: 'caller', callerRole: role });

      expect((await (await load())(post(NEW_RESIDENT))).status).toBe(expected);
    }
  });

  it('refuses an unknown role and a request without a name or email', async () => {
    fake = romsjef();
    const handler = await load();

    expect((await handler(post({ ...NEW_RESIDENT, role: 'Kongen' }))).status).toBe(400);
    expect((await handler(post({ name: 'Uten e-post' }))).status).toBe(400);
    expect((await handler(post({ email: 'x@example.no' }))).status).toBe(400);
    expect(fake.logins.size).toBe(0);
  });

  it('creates the resident with the room, role and study they were given', async () => {
    fake = romsjef();

    const response = await (
      await load()
    )(post({ ...NEW_RESIDENT, role: 'Admin', roomNumber: 214, seniority: 3 }));

    expect(response.status).toBe(200);
    expect(fake.profiles.find((p) => p.email === NEW_RESIDENT.email)).toMatchObject({
      role_id: 1,
      room_number: 214,
      seniority: 3,
      school_id: 'school-annet',
      study_id: 'study-annet',
    });
  });
});
