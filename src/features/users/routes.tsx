import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import type { FeatureRoute } from '../../shared/types/feature';
import { roomManagementRoles } from './permissions';
import { USER_PATHS } from './paths';
import { RESIDENT_PATHS } from '../residents/paths';

const ProfilePage = lazy(() => import('./pages/ProfilePage'));

export const userRoutes: FeatureRoute[] = [
  {
    path: USER_PATHS.PROFILE,
    element: <ProfilePage />,
  },
  {
    // User administration moved into Beboerliste; old links land there.
    path: USER_PATHS.LEGG_TIL_BEBOER,
    element: <Navigate to={RESIDENT_PATHS.BEBOERE} replace />,
    allowedRoles: roomManagementRoles,
  },
];
