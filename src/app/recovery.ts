import { installGlobalErrorHandlers } from '../shared/utils/errors';
import { reloadOnce } from '../shared/utils/reloadOnce';

// Run once at startup. Logs errors nobody caught, and recovers from a page's code failing to
// load (Vite fires `vite:preloadError`) by reloading the app once. If the reload was already
// tried the error is left to surface on the error screen.
export const installAppRecovery = (target: Window = window): (() => void) => {
  const removeGlobalHandlers = installGlobalErrorHandlers(target);

  const onPreloadError = (event: Event) => {
    if (reloadOnce()) event.preventDefault();
  };
  target.addEventListener('vite:preloadError', onPreloadError);

  return () => {
    removeGlobalHandlers();
    target.removeEventListener('vite:preloadError', onPreloadError);
  };
};
