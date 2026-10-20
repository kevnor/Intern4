import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

// Keep in sync with the inline script in index.html.
export const THEME_STORAGE_KEY = 'theme';
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#8b1e3f', dark: '#2a0e18' };
const DARK_QUERY = '(prefers-color-scheme: dark)';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

const readStoredPreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

const getSystemTheme = (): ResolvedTheme =>
  typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light';

const applyTheme = (theme: ResolvedTheme) => {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(DARK_QUERY);
    const handleChange = () => setSystemTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === 'system') {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this visit only.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return theme;
};

export type ChartColors = {
  series: string[];
  grid: string;
  axis: string;
  cursor: string;
};

// SVG charts need concrete colours. Tuned to match the surfaces in src/index.css.
const CHART_COLORS: Record<ResolvedTheme, ChartColors> = {
  light: {
    series: ['#8b1e3f', '#0f766e', '#d97706', '#4f46e5', '#be185d', '#57534e'],
    grid: '#e7e5e4',
    axis: '#57534e',
    cursor: '#f5f3f2',
  },
  dark: {
    series: ['#e0a1b2', '#2dd4bf', '#fbbf24', '#a5b4fc', '#f9a8d4', '#a8a29e'],
    grid: '#3a3431',
    axis: '#a8a29e',
    cursor: '#262220',
  },
};

// Falls back to the light palette outside a ThemeProvider (e.g. in tests).
export const useChartColors = (): ChartColors =>
  CHART_COLORS[useContext(ThemeContext)?.resolvedTheme ?? 'light'];
