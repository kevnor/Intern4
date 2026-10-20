import { APP_ROUTES } from '../constants/appRoutes';
import { USER_ROLES } from '../constants/userRoles';
import { featureNavigation } from '../../features/navigation';
import type { FeatureNavItem } from '../../shared/types/feature';

export const appNavigation: FeatureNavItem[] = [
  {
    key: 'home',
    label: 'Hjem',
    to: APP_ROUTES.HOME,
  },
  ...featureNavigation,
  {
    key: 'admin',
    label: 'Admin',
    to: APP_ROUTES.ADMIN,
    canAccess: ({ user }) => user?.role === USER_ROLES.DATA,
  },
];
