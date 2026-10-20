import type { FeatureNavItem } from '../../shared/types/feature';
import { REGI_PATHS } from './paths';

// Everything regi lives in the Regi hub; managers see extra tabs there.
export const regiNavigation: FeatureNavItem[] = [
  {
    key: 'regi',
    label: 'Regi',
    to: REGI_PATHS.REGI,
  },
];
