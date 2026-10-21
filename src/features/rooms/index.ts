import type { FeatureDefinition } from '../../shared/types/feature';
import { roomNavigation } from './navigation';
import { roomRoutes } from './routes';

export const roomFeature: FeatureDefinition = {
  key: 'rooms',
  routes: roomRoutes,
  navigation: roomNavigation,
};
