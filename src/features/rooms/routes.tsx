import { lazy } from 'react';
import type { FeatureRoute } from '../../shared/types/feature';
import { ROOM_PATHS } from './paths';

const RoomsHubPage = lazy(() => import('./pages/RoomsHubPage'));
const RoomDetailPage = lazy(() => import('./pages/RoomDetailPage'));

// The hub is one splat route so it stays mounted while switching tabs.
export const roomRoutes: FeatureRoute[] = [
  { path: ROOM_PATHS.DETAIL, element: <RoomDetailPage /> },
  { path: `${ROOM_PATHS.ROOMS}/*`, element: <RoomsHubPage /> },
];
