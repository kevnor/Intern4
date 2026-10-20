import { lazy } from 'react';
import type { FeatureRoute } from '../../shared/types/feature';
import { SHIFT_PATHS } from './paths';

const VaktHubPage = lazy(() => import('./pages/VaktHubPage'));

// One splat route keeps the hub mounted while switching tabs, so loaded shifts are kept.
export const shiftRoutes: FeatureRoute[] = [
  { path: `${SHIFT_PATHS.VAKT}/*`, element: <VaktHubPage /> },
];
