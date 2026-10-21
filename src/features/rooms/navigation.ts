import type { FeatureNavItem } from '../../shared/types/feature';
import { ROOM_PATHS } from './paths';

export const roomNavigation: FeatureNavItem[] = [
  {
    key: 'rooms',
    label: 'Rom',
    to: ROOM_PATHS.ROOMS,
  },
];
