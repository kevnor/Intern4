import { describe, expect, it, vi } from 'vitest';
import { USER_ROLES } from '../../shared/types/roles';
import { USER_PATHS } from './paths';
import { userRoutes } from './routes';
import {
  canAccessRoomManagement,
  canAssignRole,
  canAssignRoles,
  canManageResidents,
  roomManagementRoles,
} from './permissions';

vi.mock('./pages/ProfilePage', () => ({ default: () => null }));

describe('user permissions', () => {
  it('allows existing room management roles', () => {
    for (const role of [USER_ROLES.ADMIN, USER_ROLES.DATA, USER_ROLES.ROOMMANAGER]) {
      expect(canAccessRoomManagement(role)).toBe(true);
    }
  });

  it('blocks normal resident roles', () => {
    for (const role of [USER_ROLES.HALF_HALF, USER_ROLES.FULL_WORK, undefined]) {
      expect(canAccessRoomManagement(role)).toBe(false);
    }
  });

  it('only lets Admin and Data change roles, and only Admin hand out Admin', () => {
    expect(canAssignRoles(USER_ROLES.ROOMMANAGER)).toBe(false);
    expect(canAssignRoles(USER_ROLES.DATA)).toBe(true);
    expect(canAssignRole(USER_ROLES.DATA, USER_ROLES.ROOMMANAGER)).toBe(true);
    expect(canAssignRole(USER_ROLES.DATA, USER_ROLES.ADMIN)).toBe(false);
    expect(canAssignRole(USER_ROLES.ADMIN, USER_ROLES.ADMIN)).toBe(true);
    expect(canAssignRole(USER_ROLES.ROOMMANAGER, USER_ROLES.HALF_HALF)).toBe(false);
  });

  it('lets the same roles manage residents as the edge functions and the database do', () => {
    for (const role of [USER_ROLES.ADMIN, USER_ROLES.DATA, USER_ROLES.ROOMMANAGER]) {
      expect(canManageResidents(role)).toBe(true);
    }
    for (const role of [
      USER_ROLES.WORKMANAGER,
      USER_ROLES.VAKTSJEF,
      USER_ROLES.HALF_HALF,
      undefined,
    ]) {
      expect(canManageResidents(role)).toBe(false);
    }
  });
});

describe('user routes', () => {
  it('restricts the old add-user route to room management roles', () => {
    const route = userRoutes.find((r) => r.path === USER_PATHS.LEGG_TIL_BEBOER);
    expect(route?.allowedRoles).toEqual(roomManagementRoles);
  });
});
