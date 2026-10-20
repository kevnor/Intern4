import { lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { FeatureRoute } from '../../shared/types/feature';
import { LEGACY_REGISJEF_PATH, REGI_PATHS } from './paths';

const RegiHubPage = lazy(() => import('./hub/RegiHubPage'));

const LEGACY_TARGETS: Record<string, string> = {
  [LEGACY_REGISJEF_PATH]: REGI_PATHS.GODKJENNING,
  [`${LEGACY_REGISJEF_PATH}/godkjenning`]: REGI_PATHS.GODKJENNING,
  [`${LEGACY_REGISJEF_PATH}/status`]: REGI_PATHS.STATUS,
  [`${LEGACY_REGISJEF_PATH}/gi-regi`]: REGI_PATHS.STATUS,
  [`${LEGACY_REGISJEF_PATH}/logg`]: REGI_PATHS.LOGG,
};

const LegacyRegisjefRedirect = () => {
  const { pathname } = useLocation();
  return <Navigate to={LEGACY_TARGETS[pathname.replace(/\/$/, '')] ?? REGI_PATHS.REGI} replace />;
};

// One splat route keeps the hub mounted while switching tabs, so loaded data is kept.
export const regiRoutes: FeatureRoute[] = [
  { path: `${REGI_PATHS.REGI}/*`, element: <RegiHubPage /> },
  { path: `${LEGACY_REGISJEF_PATH}/*`, element: <LegacyRegisjefRedirect /> },
];
