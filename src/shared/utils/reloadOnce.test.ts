import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadOnce } from './reloadOnce';

const reload = vi.fn();

describe('reloadOnce', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  it('reloads the first time', () => {
    expect(reloadOnce(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again right after, so a failing page cannot loop', () => {
    expect(reloadOnce(1_000_000)).toBe(true);
    expect(reloadOnce(1_005_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('may reload again once enough time has passed', () => {
    reloadOnce(1_000_000);
    expect(reloadOnce(1_020_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(reloadOnce(1_000_000)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
