import { USER_ROLES } from './userRoles';

// Used until an administrator has configured the semester's required hours.
export const DEFAULT_SEMESTER_HOURS = 48;

export type RequiredHours = {
  regi: number;
  vakt: number;
};

// Every resident owes the same total each semester. The role decides how it is split between
// regi (tasks) and vakt (reception shifts).
export const getRequiredHoursForRole = (
  role?: string,
  totalHours: number = DEFAULT_SEMESTER_HOURS
): RequiredHours => {
  switch (role) {
    case USER_ROLES.FULL_RECEPTION:
      return { regi: 0, vakt: totalHours };
    case USER_ROLES.HALF_HALF:
      return { regi: totalHours / 2, vakt: totalHours / 2 };
    case USER_ROLES.ADMIN:
      return { regi: 0, vakt: 0 };
    default:
      return { regi: totalHours, vakt: 0 };
  }
};

export const getRequiredRegiHoursForRole = (
  role?: string,
  totalHours: number = DEFAULT_SEMESTER_HOURS
): number => getRequiredHoursForRole(role, totalHours).regi;
