import { USER_ROLES } from '../../shared/types/roles';
import type { BasicUserWithRole } from '../../shared/types/user';

// The roles that come with a position rather than with how someone does their hours, in the order they
// are listed. Same as the position roles that moving out resets (offboarding_is_position_role).
export const POSITION_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.DATA,
  USER_ROLES.ROOMMANAGER,
  USER_ROLES.WORKMANAGER,
  USER_ROLES.VAKTSJEF,
  USER_ROLES.GENERAL_MANAGER,
  USER_ROLES.COMMITTEE_MEMBER,
] as const;

export type RoleHolders = { role: string; holders: BasicUserWithRole[] };

// Who holds each position role. Only people who live here now count (active), and a role nobody holds
// is still listed, with no holders, so a missing Romsjef or Vaktsjef is easy to see.
export const groupByRole = (users: BasicUserWithRole[]): RoleHolders[] =>
  POSITION_ROLES.map((role) => ({
    role,
    holders: users
      .filter((user) => user.isActive && user.role === role)
      .sort((a, b) => a.name.localeCompare(b.name, 'nb')),
  }));
