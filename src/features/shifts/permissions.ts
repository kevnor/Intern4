import { isUserRole, USER_ROLES, type UserRole } from '../../shared/types/roles';

export const vaktManagerRoles: UserRole[] = [USER_ROLES.ADMIN, USER_ROLES.VAKTSJEF];

export const canManageVakt = (role?: string) => isUserRole(role) && vaktManagerRoles.includes(role);
