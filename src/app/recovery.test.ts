import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installAppRecovery } from './recovery';

const reload = vi.fn();

describe('installAppRecovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  const firePreloadError = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  it('reloads once when a page fails to preload, and swallows that error', () => {
    const remove = installAppRecovery(window);

    const event = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    remove();
  });

  it('lets the error through when the reload did not help', () => {
    const remove = installAppRecovery(window);

    firePreloadError();
    const second = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
    remove();
  });

  it('stops listening when removed', () => {
    const remove = installAppRecovery(window);
    remove();

    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
  });
});
