import type { FeatureDefinition } from '../shared/types/feature';
import { alcoholFeature } from './alcohol';
import { authFeature } from './auth';
import { helgaFeature } from './helga';
import { receptionFeature } from './reception';
import { regiFeature } from './regi';
import { residentFeature } from './residents';
import { roomFeature } from './rooms';
import { shiftFeature } from './shifts';
import { taskFeature } from './tasks';
import { userFeature } from './users';
import { vervFeature } from './verv';
import { wineCellarFeature } from './wine-cellar';
import { FEATURE_ORDER, type FeatureKey } from './featureOrder';

const featuresByKey: Record<FeatureKey, FeatureDefinition> = {
  alcohol: alcoholFeature,
  auth: authFeature,
  helga: helgaFeature,
  reception: receptionFeature,
  regi: regiFeature,
  residents: residentFeature,
  rooms: roomFeature,
  shifts: shiftFeature,
  tasks: taskFeature,
  users: userFeature,
  verv: vervFeature,
  'wine-cellar': wineCellarFeature,
};

export const features: FeatureDefinition[] = FEATURE_ORDER.map((key) => featuresByKey[key]);
