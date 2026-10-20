import { lazy } from 'react';
import type { FeatureRoute } from '../../shared/types/feature';
import { AUTH_PATHS } from './paths';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

export const authRoutes: FeatureRoute[] = [
  {
    path: AUTH_PATHS.LOGIN,
    element: <LoginPage />,
    public: true,
  },
  {
    path: AUTH_PATHS.FORGOT_PASSWORD,
    element: <ForgotPasswordPage />,
    public: true,
  },
  {
    path: AUTH_PATHS.RESET_PASSWORD,
    element: <ResetPasswordPage />,
    public: true,
  },
];
