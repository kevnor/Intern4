import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { allRoutes } from './routeConfig';
import { Spinner } from '../../shared/components';

// Shown while a page's code downloads, usually only on the first visit.
const PageFallback = () => (
  <div className="flex justify-center px-4 py-16 text-subtle">
    <Spinner label="Laster..." />
  </div>
);

const AppRouter = () => {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {allRoutes.map((route, index) => (
          <Route key={route.path ?? index} path={route.path} element={route.element} />
        ))}
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
