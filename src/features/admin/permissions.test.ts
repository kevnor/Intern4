import { describe, expect, it, vi } from 'vitest';
import { USER_ROLES } from '../../shared/types/roles';
import { adminRoutes } from './routes';
import { ADMIN_PATHS } from './paths';
import { adminRoles, canAccessAdmin, canSetSemesterHours } from './permissions';

vi.mock('./pages/AdminHubPage', () => ({ default: () => null }));

describe('admin permissions', () => {
  it('lets Admin and Data in, and nobody else', () => {
    for (const role of [USER_ROLES.ADMIN, USER_ROLES.DATA]) {
      expect(canAccessAdmin(role)).toBe(true);
      expect(canSetSemesterHours(role)).toBe(true);
    }
    for (const role of [
      USER_ROLES.ROOMMANAGER,
      USER_ROLES.WORKMANAGER,
      USER_ROLES.VAKTSJEF,
      USER_ROLES.HALF_HALF,
      undefined,
      '',
    ]) {
      expect(canAccessAdmin(role)).toBe(false);
      expect(canSetSemesterHours(role)).toBe(false);
    }
  });

  it('guards the route with the same roles, so it cannot be opened by URL', () => {
    const route = adminRoutes.find((candidate) => candidate.path === `${ADMIN_PATHS.ADMIN}/*`);

    expect(route?.allowedRoles).toEqual(adminRoles);
    expect(route?.public).toBeFalsy();
  });
});
