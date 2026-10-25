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
  it('moves the resident out through the database function, which bans the login', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      logins: [LOGIN],
      offboardDetails: { shiftsReleased: 3, romslippSkipped: 1, roleReset: null },
    });

    const response = await (await load())(post({ userId: 'resident', reason: ' Ferdig ' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      shiftsReleased: 3,
      romslippSkipped: 1,
      roleReset: null,
    });
    expect(fake.log).toContain('rpc offboard_user_internal');
    expect(fake.log).not.toContain('delete login');
    expect(fake.logins.get('resident')?.banned).toBe(true);
    expect(fake.profiles.find((p) => p.id === 'resident')).toMatchObject({
      is_active: false,
      on_leave: false,
    });
    expect(fake.events).toEqual([
      expect.objectContaining({
        user_id: 'resident',
        kind: 'moved_out',
        actor_id: 'romsjef',
        reason: 'Ferdig',
      }),
    ]);
  });

  it('still moves out a resident whose login no longer exists', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(200);
    expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(false);
  });

  it('passes the database error on and leaves the resident active', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      logins: [LOGIN],
      failures: { offboard: 'Noe gikk galt' },
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Noe gikk galt');
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

  it('lets Romsjef, Data and Admin do it, but nobody else', async () => {
    for (const [role, expected] of [
      ['Admin', 200],
      ['Data', 200],
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

  it('keeps Romsjef from moving out someone who holds a management role', async () => {
    for (const [targetRoleId, expected] of [
      [3, 403], // Data
      [2, 403], // another Romsjef
      [4, 200], // Vaktsjef
      [7, 200], // an ordinary resident
    ] as const) {
      fake = createFakeSupabase({
        callerId: 'romsjef',
        callerRole: 'Romsjef',
        profiles: [{ ...RESIDENT, role_id: targetRoleId }],
        logins: [LOGIN],
      });

      const response = await (await load())(post({ userId: 'resident' }));

      expect(response.status, `role ${targetRoleId}`).toBe(expected);
      expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(expected !== 200);
    }
  });

  it('lets Data move out a Romsjef', async () => {
    fake = createFakeSupabase({
      callerId: 'data',
      callerRole: 'Data',
      profiles: [{ ...RESIDENT, role_id: 2 }],
      logins: [LOGIN],
    });

    expect((await (await load())(post({ userId: 'resident' }))).status).toBe(200);
  });

  it('says so when the resident does not exist', async () => {
    fake = createFakeSupabase({ callerId: 'romsjef', callerRole: 'Romsjef' });

    const response = await (await load())(post({ userId: 'ghost' }));

    expect(response.status).toBe(404);
    expect(fake.log).not.toContain('rpc offboard_user_internal');
  });
});
