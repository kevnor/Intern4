import type { FeatureRoute } from '../../shared/types/feature';
import { AUTH_PATHS } from './paths';
import { lazyWithRetry } from '../../app/lazyWithRetry';

const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));

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
