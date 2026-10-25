import { APP_ROUTES } from '../constants/appRoutes';
import { featureNavigation } from '../../features/navigation';
import type { FeatureNavItem } from '../../shared/types/feature';

export const appNavigation: FeatureNavItem[] = [
  {
    key: 'home',
    label: 'Hjem',
    to: APP_ROUTES.HOME,
  },
  ...featureNavigation,
];
