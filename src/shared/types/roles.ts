export const USER_ROLES = {
  DATA: 'Data',
  WORKMANAGER: 'Regisjef',
  ROOMMANAGER: 'Romsjef',
  FULL_WORK: 'Full Regi',
  FULL_RECEPTION: 'Full Vakt',
  HALF_HALF: 'Halv/Halv',
  VAKTSJEF: 'Vaktsjef',
  COMMITTEE_MEMBER: 'Utvalgsmedlem',
  GENERAL_MANAGER: 'Daglig leder',
  ADMIN: 'Admin',
  USER: 'user',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const isUserRole = (role?: string): role is UserRole =>
  Boolean(role && Object.values(USER_ROLES).includes(role as UserRole));
