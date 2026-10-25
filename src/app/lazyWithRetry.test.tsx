import { Suspense, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { lazyWithRetry } from './lazyWithRetry';
import RouteErrorBoundary from './routes/RouteErrorBoundary';
import { MemoryRouter } from 'react-router-dom';

const reload = vi.fn();

const renderLazy = (load: () => Promise<{ default: () => ReactElement }>) => {
  const Page = lazyWithRetry(load);
  return render(
    <MemoryRouter>
      <RouteErrorBoundary>
        <Suspense fallback={<p>Laster siden</p>}>
          <Page />
        </Suspense>
      </RouteErrorBoundary>
    </MemoryRouter>
  );
};

describe('lazyWithRetry', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  it('renders the page when it loads', async () => {
    renderLazy(async () => ({ default: () => <p>Siden</p> }));

    expect(await screen.findByText('Siden')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads the app once when the page cannot be fetched, and keeps showing the loader', async () => {
    renderLazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));

    expect(await screen.findByText('Laster siden')).toBeInTheDocument();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('treats a module without a page as a failed load', async () => {
    // The state a hot-reloaded dev server can leave behind.
    renderLazy(async () => ({ default: undefined }) as never);

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('shows the error screen instead of reloading again in a loop', async () => {
    window.sessionStorage.setItem('app:last-forced-reload', String(Date.now()));
    renderLazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));

    expect(await screen.findByRole('alert')).toHaveTextContent('kunne ikke lastes');
    expect(reload).not.toHaveBeenCalled();
  });
});
