import type { FeatureRoute } from '../../shared/types/feature';
import { ROOM_PATHS } from './paths';
import { lazyWithRetry } from '../../app/lazyWithRetry';

const RoomsHubPage = lazyWithRetry(() => import('./pages/RoomsHubPage'));
const RoomDetailPage = lazyWithRetry(() => import('./pages/RoomDetailPage'));

// The hub is one splat route so it stays mounted while switching tabs.
export const roomRoutes: FeatureRoute[] = [
  { path: ROOM_PATHS.DETAIL, element: <RoomDetailPage /> },
  { path: `${ROOM_PATHS.ROOMS}/*`, element: <RoomsHubPage /> },
];
