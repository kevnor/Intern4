import { lazy } from 'react';
import type { FeatureRoute } from '../../shared/types/feature';
import { RESIDENT_PATHS } from './paths';

const ResidentDirectoryPage = lazy(() => import('./pages/ResidentDirectoryPage'));
const ResidentProfilePage = lazy(() => import('./pages/ResidentProfilePage'));

export const residentRoutes: FeatureRoute[] = [
  {
    path: RESIDENT_PATHS.BEBOERE,
    element: <ResidentDirectoryPage />,
  },
  {
    path: RESIDENT_PATHS.BEBOER_STATISTIKK,
    element: <ResidentDirectoryPage />,
  },
  {
    path: RESIDENT_PATHS.GAMLE_BEBOERE,
    element: <ResidentDirectoryPage />,
  },
  {
    path: RESIDENT_PATHS.BEBOER_PROFIL,
    element: <ResidentProfilePage />,
  },
];
