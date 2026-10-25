import type { FeatureRoute } from '../../shared/types/feature';
import { lazyWithRetry } from '../../app/lazyWithRetry';
import { ADMIN_PATHS } from './paths';
import { adminRoles } from './permissions';

const AdminHubPage = lazyWithRetry(() => import('./pages/AdminHubPage'));

// One splat route so the hub stays mounted while switching tabs. Only Admin and Data get in.
export const adminRoutes: FeatureRoute[] = [
  { path: `${ADMIN_PATHS.ADMIN}/*`, element: <AdminHubPage />, allowedRoles: adminRoles },
];
