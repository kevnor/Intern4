import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from './ThemeProvider';
import { ThemeSelector } from '../layout/ThemeSelector';

type Listener = () => void;

const mockMatchMedia = (initiallyDark: boolean) => {
  const listeners = new Set<Listener>();
  const query = {
    matches: initiallyDark,
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);

  return (dark: boolean) => {
    query.matches = dark;
    listeners.forEach((listener) => listener());
  };
};

const ThemeProbe = () => {
  const { preference, resolvedTheme } = useTheme();
  return (
    <div data-testid="theme">
      {preference}:{resolvedTheme}
    </div>
  );
};

const renderWithTheme = () =>
  render(
    <ThemeProvider>
      <ThemeProbe />
      <ThemeSelector />
    </ThemeProvider>
  );

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });

  it('follows the system theme by default and reacts to changes', () => {
    const setSystemDark = mockMatchMedia(false);
    renderWithTheme();

    expect(screen.getByTestId('theme')).toHaveTextContent('system:light');
    expect(document.documentElement.dataset.theme).toBe('light');

    act(() => setSystemDark(true));

    expect(screen.getByTestId('theme')).toHaveTextContent('system:dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#2a0e18'
    );
  });

  it('persists a manual choice and clears it when returning to system', async () => {
    const user = userEvent.setup();
    mockMatchMedia(false);
    renderWithTheme();

    await user.click(screen.getByRole('radio', { name: 'Mørk' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark:dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'System' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('system:light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('restores the saved preference', () => {
    mockMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderWithTheme();

    expect(screen.getByTestId('theme')).toHaveTextContent('light:light');
    expect(screen.getByRole('radio', { name: 'Lys' })).toHaveAttribute('aria-checked', 'true');
  });

  it('works when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    renderWithTheme();

    expect(screen.getByTestId('theme')).toHaveTextContent('system:light');
  });
});
