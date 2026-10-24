import { afterEach, describe, expect, it } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '../_testing/fakeSupabase';
import { loadFunction, post } from '../_testing/loadFunction';

let fake: FakeSupabase;
const load = () =>
  loadFunction(
    () => import('./index'),
    () => fake
  );

const RESIDENT = { id: 'resident', email: 'kari@example.no', is_active: true, role_id: 7 };
const LOGIN = { id: 'resident', email: 'kari@example.no' };

afterEach(() => {
  fake = undefined as never;
});

describe('delete-user', () => {
  it('bans the login instead of deleting it, and deactivates the profile', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      logins: [LOGIN],
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(200);
    expect(fake.logins.get('resident')?.banned).toBe(true);
    expect(fake.log).not.toContain('delete login');
    expect(fake.profiles.find((p) => p.id === 'resident')).toMatchObject({
      is_active: false,
      on_leave: false,
    });
  });

  it('still deactivates a resident whose login no longer exists', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(200);
    expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(false);
  });

  it('leaves the profile alone when the ban fails', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      logins: [LOGIN],
      failures: { ban: 'Auth service down' },
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Auth service down');
    expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(true);
  });

  it('refuses to deactivate yourself or an Admin', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT, { id: 'boss', email: 'boss@example.no', is_active: true, role_id: 1 }],
      logins: [LOGIN, { id: 'boss', email: 'boss@example.no' }],
    });
    const handler = await load();

    expect((await handler(post({ userId: 'romsjef' }))).status).toBe(400);
    expect((await handler(post({ userId: 'boss' }))).status).toBe(403);
    expect(fake.logins.get('boss')?.banned).toBeUndefined();
    expect(fake.profiles.find((p) => p.id === 'boss')?.is_active).toBe(true);
  });

  it('lets Romsjef, Data, Regisjef and Admin do it, but nobody else', async () => {
    for (const [role, expected] of [
      ['Admin', 200],
      ['Romsjef', 200],
      ['Halv/Halv', 403],
    ] as const) {
      fake = createFakeSupabase({
        callerId: 'caller',
        callerRole: role,
        profiles: [RESIDENT],
        logins: [LOGIN],
      });

      expect((await (await load())(post({ userId: 'resident' }))).status).toBe(expected);
    }
  });

  it('needs a user id', async () => {
    fake = createFakeSupabase({ callerId: 'romsjef', callerRole: 'Romsjef' });

    expect((await (await load())(post({}))).status).toBe(400);
  });
});
