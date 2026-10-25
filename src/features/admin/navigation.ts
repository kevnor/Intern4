import type { FeatureNavItem } from '../../shared/types/feature';
import { ADMIN_PATHS } from './paths';
import { canAccessAdmin } from './permissions';

export const adminNavigation: FeatureNavItem[] = [
  {
    key: 'admin',
    label: 'Admin',
    to: ADMIN_PATHS.ADMIN,
    canAccess: ({ user }) => canAccessAdmin(user?.role),
  },
];
