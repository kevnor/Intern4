import { isUserRole, USER_ROLES, type UserRole } from '../../shared/types/roles';

// Who sees the Admin page: the two roles that manage residents' roles and the semester's hours.
export const adminRoles: UserRole[] = [USER_ROLES.ADMIN, USER_ROLES.DATA];

export const canAccessAdmin = (role?: string) => isUserRole(role) && adminRoles.includes(role);

// Keep in sync with the semester_settings policies in the database (Admin and Data).
export const canSetSemesterHours = canAccessAdmin;
