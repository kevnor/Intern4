import type { FeatureNavItem } from '../shared/types/feature';
import { alcoholNavigation } from './alcohol/navigation';
import { FEATURE_ORDER, type FeatureKey } from './featureOrder';
import { helgaNavigation } from './helga/navigation';
import { receptionNavigation } from './reception/navigation';
import { regiNavigation } from './regi/navigation';
import { residentNavigation } from './residents/navigation';
import { roomNavigation } from './rooms/navigation';
import { shiftNavigation } from './shifts/navigation';
import { taskNavigation } from './tasks/navigation';
import { userNavigation } from './users/navigation';
import { vervNavigation } from './verv/navigation';
import { wineCellarNavigation } from './wine-cellar/navigation';

const navigationByFeature: Partial<Record<FeatureKey, FeatureNavItem[]>> = {
  alcohol: alcoholNavigation,
  helga: helgaNavigation,
  reception: receptionNavigation,
  regi: regiNavigation,
  residents: residentNavigation,
  rooms: roomNavigation,
  shifts: shiftNavigation,
  tasks: taskNavigation,
  users: userNavigation,
  verv: vervNavigation,
  'wine-cellar': wineCellarNavigation,
};

export const featureNavigation: FeatureNavItem[] = FEATURE_ORDER.flatMap(
  (featureKey) => navigationByFeature[featureKey] ?? []
);
