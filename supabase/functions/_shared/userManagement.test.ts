import { describe, expect, it, vi } from 'vitest';
import {
  USER_MANAGER_ROLES,
  canManageUsers,
  escapeLikePattern,
  generatePassword,
  isNotFoundError,
  jsonResponse,
  recordResidentEvent,
  textResponse,
} from './userManagement';

describe('canManageUsers', () => {
  it('allows Admin, Data, Romsjef and Regisjef', () => {
    for (const role of ['Admin', 'Data', 'Romsjef', 'Regisjef']) {
      expect(canManageUsers(role)).toBe(true);
    }
  });

  it('rejects everyone else, including the old misspelt role name', () => {
    expect(canManageUsers('Halv/Halv')).toBe(false);
    expect(canManageUsers('Vaktsjef')).toBe(false);
    expect(canManageUsers('Data Åpmand')).toBe(false);
    expect(canManageUsers(undefined)).toBe(false);
    expect(canManageUsers(null)).toBe(false);
    expect(canManageUsers('')).toBe(false);
  });

  it('matches the roles that can reach the "Ny bruker" button in the app', () => {
    // roomManagementRoles in src/features/users/permissions.ts
    for (const role of ['Admin', 'Romsjef', 'Data']) {
      expect(USER_MANAGER_ROLES).toContain(role);
    }
  });
});

describe('generatePassword', () => {
  it('makes a password of the requested length from readable characters', () => {
    const password = generatePassword();

    expect(password).toHaveLength(12);
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    expect(generatePassword(20)).toHaveLength(20);
  });

  it('does not repeat itself', () => {
    expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBe(20);
  });
});

describe('isNotFoundError', () => {
  it('recognises the shapes of "user not found"', () => {
    expect(isNotFoundError({ status: 404 })).toBe(true);
    expect(isNotFoundError({ message: 'User not found' })).toBe(true);
    expect(isNotFoundError({ message: 'user_not_found' })).toBe(false);
    expect(isNotFoundError({ message: 'Database error' })).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});

describe('responses and ban duration', () => {
  it('sends JSON with the CORS headers', async () => {
    const response = jsonResponse({ success: true }, 201);

    expect(response.status).toBe(201);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ success: true });
  });

  it('sends plain text errors with the CORS headers', async () => {
    const response = textResponse('Forbidden', 403);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Forbidden');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('escapes the wildcards of a LIKE pattern, so an address matches only itself', () => {
    expect(escapeLikePattern('kari_nordmann@example.no')).toBe('kari\\_nordmann@example.no');
    expect(escapeLikePattern('100%\\')).toBe('100\\%\\\\');
  });
});

describe('recordResidentEvent', () => {
  const clientThatReturns = (error: { message: string } | null) => {
    const rows: Record<string, unknown>[] = [];
    return {
      rows,
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          rows.push({ table, ...row });
          return { error };
        },
      }),
    };
  };

  it('writes the event to the log', async () => {
    const client = clientThatReturns(null);

    await recordResidentEvent(client, { userId: 'u1', kind: 'added', actorId: 'm1' });

    expect(client.rows).toEqual([
      { table: 'resident_events', user_id: 'u1', kind: 'added', actor_id: 'm1', details: {} },
    ]);
  });

  it('reports a failure without throwing, because the action itself has already happened', async () => {
    const client = clientThatReturns({ message: 'permission denied' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      recordResidentEvent(client, { userId: 'u1', kind: 'reactivated', actorId: 'm1' })
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('permission denied'));
    spy.mockRestore();
  });
});
