import { afterEach, describe, expect, it } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '../_testing/fakeSupabase';
import { loadFunction, post } from '../_testing/loadFunction';

let fake: FakeSupabase;
const load = () =>
  loadFunction(
    () => import('./index'),
    () => fake
  );

const RESIDENT = { id: 'resident', email: 'kari@example.no', name: 'Kari', is_active: false };

afterEach(() => {
  fake = undefined as never;
});

describe('reactivate-user', () => {
  it('lifts the ban on a deactivated resident and makes them active', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      logins: [{ id: 'resident', email: 'kari@example.no', banned: true }],
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(true);
    expect(fake.logins.get('resident')?.banned).toBe(false);
  });

  it('recreates a login that was deleted, with the same id and a new password', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
    });

    const response = await (await load())(post({ userId: 'resident' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.initialPassword).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(body.email).toBe('kari@example.no');
    expect(fake.logins.get('resident')).toMatchObject({
      id: 'resident',
      email: 'kari@example.no',
      password: body.initialPassword,
    });
    // The profile was made active first, which is what lets the login be created.
    expect(fake.log.indexOf('create login')).toBeGreaterThan(
      fake.log.findIndex((entry) => entry.includes('"is_active":true'))
    );
  });

  it('puts the resident back to inactive when the login cannot be created', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      failures: { createLogin: 'Database error creating user' },
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(400);
    expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(false);
  });

  it('puts the resident back to inactive when the ban cannot be lifted', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      logins: [{ id: 'resident', email: 'kari@example.no', banned: true }],
      failures: { unban: 'Auth service down' },
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Auth service down');
    expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(false);
  });

  it('refuses people who may not manage residents', async () => {
    fake = createFakeSupabase({
      callerId: 'someone',
      callerRole: 'Halv/Halv',
      profiles: [RESIDENT],
    });

    const response = await (await load())(post({ userId: 'resident' }));

    expect(response.status).toBe(403);
    expect(fake.profiles.find((p) => p.id === 'resident')?.is_active).toBe(false);
  });

  it('refuses callers without a profile', async () => {
    fake = createFakeSupabase({ callerId: 'ghost', callerRole: null, profiles: [RESIDENT] });

    expect((await (await load())(post({ userId: 'resident' }))).status).toBe(403);
  });

  it('needs a user id, and a resident that exists', async () => {
    fake = createFakeSupabase({ callerId: 'romsjef', callerRole: 'Romsjef' });
    const handler = await load();

    expect((await handler(post({}))).status).toBe(400);
    expect((await handler(post({ userId: 'nobody' }))).status).toBe(404);
  });

  it('answers the browser’s preflight request and rejects other methods', async () => {
    fake = createFakeSupabase({ callerId: 'romsjef', callerRole: 'Romsjef' });
    const handler = await load();

    expect((await handler(new Request('http://localhost/fn', { method: 'OPTIONS' }))).status).toBe(
      200
    );
    expect((await handler(new Request('http://localhost/fn', { method: 'GET' }))).status).toBe(405);
  });

  it('logs who reactivated the resident', async () => {
    fake = createFakeSupabase({
      callerId: 'romsjef',
      callerRole: 'Romsjef',
      profiles: [RESIDENT],
      logins: [{ id: 'resident', email: 'kari@example.no', banned: true }],
    });

    await (
      await load()
    )(post({ userId: 'resident' }));

    expect(fake.events).toEqual([
      expect.objectContaining({ user_id: 'resident', kind: 'reactivated', actor_id: 'romsjef' }),
    ]);
  });
});
