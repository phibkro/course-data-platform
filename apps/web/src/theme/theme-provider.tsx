import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  decodeThemePreference,
  defaultThemePreference,
  parseThemePreference,
  serializeThemePreference,
  themePreferenceStorageKey,
  type ThemePreference,
} from './theme-preference';

type ThemeContextValue = {
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
  readonly updatePreference: (patch: Partial<Omit<ThemePreference, 'version'>>) => void;
  readonly resetPreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readPreference = (): ThemePreference => {
  if (typeof window === 'undefined') return defaultThemePreference;
  try {
    const stored = window.localStorage.getItem(themePreferenceStorageKey);
    return stored ? parseThemePreference(stored) : defaultThemePreference;
  } catch {
    return defaultThemePreference;
  }
};

const applyPreference = (preference: ThemePreference, systemDark: boolean): void => {
  const root = document.documentElement;
  root.dataset.baseColor = preference.baseColor;
  root.dataset.themeColor = preference.themeColor;
  root.dataset.chartColor = preference.chartColor;
  root.dataset.colorMode = preference.mode;
  root.classList.toggle(
    'dark',
    preference.mode === 'dark' || (preference.mode === 'system' && systemDark),
  );
  root.style.colorScheme = root.classList.contains('dark') ? 'dark' : 'light';
};

export const initializeThemePreference = (): ThemePreference => {
  const preference = readPreference();
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyPreference(preference, systemDark);
  return preference;
};

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    applyPreference(preference, systemDark);
    try {
      window.localStorage.setItem(themePreferenceStorageKey, serializeThemePreference(preference));
    } catch {
      // Appearance remains active for the session when storage is unavailable.
    }
  }, [preference, systemDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference: (next) => setPreferenceState(decodeThemePreference(next)),
      updatePreference: (patch) =>
        setPreferenceState((current) => decodeThemePreference({ ...current, ...patch })),
      resetPreference: () => setPreferenceState(defaultThemePreference),
    }),
    [preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useThemePreference = (): ThemeContextValue => {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemePreference must be used within ThemeProvider');
  return value;
};
