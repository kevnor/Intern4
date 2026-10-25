import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { reloadOnce } from '../shared/utils/reloadOnce';

// React's own lazy() is typed with `any` props, so a page with props still fits.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

type Loader<T extends AnyComponent> = () => Promise<{ default: T }>;

// Like React.lazy, but a page that fails to load (an old tab after a deploy, a dropped connection,
// a hot-reloaded dev server) reloads the app once to get a fresh copy. If that doesn't help the error
// reaches the error screen instead of looping.
export const lazyWithRetry = <T extends AnyComponent>(load: Loader<T>): LazyExoticComponent<T> =>
  lazy(async () => {
    try {
      const module = await load();
      if (!module || typeof module.default === 'undefined') {
        throw new Error('Siden kunne ikke lastes');
      }
      return module;
    } catch (error) {
      // The page is about to reload, so keep the loading state until it does.
      if (reloadOnce()) return new Promise<never>(() => {});
      throw error;
    }
  });
