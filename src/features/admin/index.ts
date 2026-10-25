import type { FeatureDefinition } from '../../shared/types/feature';
import { adminNavigation } from './navigation';
import { adminRoutes } from './routes';

export const adminFeature: FeatureDefinition = {
  key: 'admin',
  routes: adminRoutes,
  navigation: adminNavigation,
};
