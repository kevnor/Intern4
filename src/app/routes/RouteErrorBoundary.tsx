import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary';

// Remounts when the user navigates, so one broken page doesn't block the others.
const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
};

export default RouteErrorBoundary;
