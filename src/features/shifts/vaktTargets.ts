import { getRequiredHoursForRole } from '../../app/constants/regiRequirements';
import { USER_ROLES } from '../../shared/types/roles';
import type { BasicUserWithRole } from '../../shared/types/user';
import type { AssignableResident } from './assign';
import { SHIFT_HOURS } from './slots';

// Residents with a vakt requirement are scheduled automatically; everyone else can still be
// placed on a shift by hand.
const SCHEDULED_ROLES: string[] = [USER_ROLES.FULL_RECEPTION, USER_ROLES.HALF_HALF];

// Rounded up so a resident never ends up an hour short of the requirement.
export const getTargetShifts = (role: string | undefined, totalHours: number): number =>
  Math.ceil(getRequiredHoursForRole(role, totalHours).vakt / SHIFT_HOURS);

export const getSchedulableResidents = (
  users: BasicUserWithRole[],
  totalHours: number
): AssignableResident[] =>
  users
    .filter((user) => user.isActive && !user.onLeave && SCHEDULED_ROLES.includes(user.role ?? ''))
    .map((user) => ({ id: user.id, targetShifts: getTargetShifts(user.role, totalHours) }))
    .filter((resident) => resident.targetShifts > 0);
