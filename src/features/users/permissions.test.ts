import { describe, expect, it } from 'vitest';
import { USER_ROLES } from '../../shared/types/roles';
import { canAccessRoomManagement, canAssignRole, canAssignRoles } from './permissions';

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
});
