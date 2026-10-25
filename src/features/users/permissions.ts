import { isUserRole, USER_ROLES, type UserRole } from '../../shared/types/roles';

export const roomManagementRoles: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.ROOMMANAGER,
  USER_ROLES.DATA,
];

export const canAccessRoomManagement = (role?: string) =>
  isUserRole(role) && roomManagementRoles.includes(role);

// Who may add, move out and reactivate residents. The same list as the edge functions and the
// database (is_user_manager): the room managers, plus Regisjef.
export const residentManagementRoles: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.DATA,
  USER_ROLES.ROOMMANAGER,
  USER_ROLES.WORKMANAGER,
];

export const canManageResidents = (role?: string) =>
  isUserRole(role) && residentManagementRoles.includes(role);

// Mirrors the database guard (guard_user_privileged_columns) and the edge functions'
// shared rules: only Admin and Data change roles, and only Admin grants or removes Admin.
export const canAssignRoles = (callerRole?: string) =>
  callerRole === USER_ROLES.ADMIN || callerRole === USER_ROLES.DATA;

export const canAssignRole = (callerRole: string | undefined, targetRole: string) =>
  canAssignRoles(callerRole) &&
  (targetRole !== USER_ROLES.ADMIN || callerRole === USER_ROLES.ADMIN);
