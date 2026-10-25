import type { FeatureRoute } from '../../shared/types/feature';
import { RESIDENT_PATHS } from './paths';
import { lazyWithRetry } from '../../app/lazyWithRetry';

const ResidentDirectoryPage = lazyWithRetry(() => import('./pages/ResidentDirectoryPage'));
const ResidentProfilePage = lazyWithRetry(() => import('./pages/ResidentProfilePage'));

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
