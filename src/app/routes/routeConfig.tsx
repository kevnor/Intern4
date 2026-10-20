import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import NotFoundPage from '../pages/NotFoundPage';
import ProtectedRoute from './ProtectedRoute';
import { APP_ROUTES } from '../constants/appRoutes';
import { features } from '../../features';
import type { FeatureRoute } from '../../shared/types/feature';

// Pages load on first visit, so the first download only contains the app shell.
const HomePage = lazy(() => import('../pages/HomePage'));

const featureRoutes: FeatureRoute[] = features.flatMap((feature) => feature.routes ?? []);

const toRouteObject = (route: FeatureRoute): RouteObject => ({
  path: route.path,
  element: route.public ? (
    route.element
  ) : (
    <ProtectedRoute allowedRoles={route.allowedRoles}>{route.element}</ProtectedRoute>
  ),
});

// Public routes (no authentication required)
export const publicRoutes: RouteObject[] = featureRoutes
  .filter((route) => route.public)
  .map(toRouteObject);

// Protected routes (authentication required)
export const protectedRoutes: RouteObject[] = featureRoutes
  .filter((route) => !route.public)
  .map(toRouteObject);

// App-level pages
export const appRoutes: RouteObject[] = [
  {
    path: APP_ROUTES.HOME,
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
];

// Admin-only routes
export const adminRoutes: RouteObject[] = [
  {
    path: APP_ROUTES.ADMIN,
    element: <ProtectedRoute />,
  },
];

// Regisjef routes
export const regisjefRoutes: RouteObject[] = [];

// Default redirects
export const redirectRoutes: RouteObject[] = [
  {
    path: APP_ROUTES.LEGACY_DASHBOARD,
    element: <Navigate to={APP_ROUTES.HOME} replace />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

// All routes combined
export const allRoutes: RouteObject[] = [
  ...publicRoutes,
  ...protectedRoutes,
  ...appRoutes,
  ...adminRoutes,
  ...regisjefRoutes,
  ...redirectRoutes,
];
