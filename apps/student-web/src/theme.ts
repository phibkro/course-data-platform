export const baseColors = ['mist', 'zinc', 'stone', 'mauve', 'olive', 'neutral'] as const;
export const themeColors = ['blue', 'violet', 'amber', 'rose', 'emerald', 'sky'] as const;
export const chartColors = ['sky', 'violet', 'emerald', 'rose', 'indigo', 'amber'] as const;
export const colorModes = ['system', 'light', 'dark'] as const;

export type BaseColor = (typeof baseColors)[number];
export type ThemeColor = (typeof themeColors)[number];
export type ChartColor = (typeof chartColors)[number];
export type ColorMode = (typeof colorModes)[number];

export interface ThemePreference {
  readonly version: 1;
  readonly baseColor: BaseColor;
  readonly themeColor: ThemeColor;
  readonly chartColor: ChartColor;
  readonly mode: ColorMode;
}

export type ThemePresetId = 'fjord' | 'aurora' | 'birch' | 'heather' | 'pine' | 'polar-night';

export interface ThemePreset {
  readonly id: ThemePresetId;
  readonly baseColor: BaseColor;
  readonly themeColor: ThemeColor;
  readonly chartColor: ChartColor;
}

export const themePresets: ReadonlyArray<ThemePreset> = [
  { id: 'fjord', baseColor: 'mist', themeColor: 'blue', chartColor: 'sky' },
  { id: 'aurora', baseColor: 'zinc', themeColor: 'violet', chartColor: 'violet' },
  { id: 'birch', baseColor: 'stone', themeColor: 'amber', chartColor: 'emerald' },
  { id: 'heather', baseColor: 'mauve', themeColor: 'rose', chartColor: 'rose' },
  { id: 'pine', baseColor: 'olive', themeColor: 'emerald', chartColor: 'indigo' },
  { id: 'polar-night', baseColor: 'neutral', themeColor: 'sky', chartColor: 'amber' },
];

export const defaultThemePreference: ThemePreference = {
  version: 1,
  baseColor: themePresets[0]!.baseColor,
  themeColor: themePresets[0]!.themeColor,
  chartColor: themePresets[0]!.chartColor,
  mode: 'system',
};

export const themePreferenceStorageKey = 'course-data-theme-v1';

const includes = <Value extends string>(
  values: ReadonlyArray<Value>,
  value: unknown,
): value is Value => typeof value === 'string' && values.includes(value as Value);

export const decodeThemePreference = (value: unknown): ThemePreference => {
  if (typeof value !== 'object' || value === null) return defaultThemePreference;
  const candidate = value as Partial<Record<keyof ThemePreference, unknown>>;
  return {
    version: 1,
    baseColor: includes(baseColors, candidate.baseColor)
      ? candidate.baseColor
      : defaultThemePreference.baseColor,
    themeColor: includes(themeColors, candidate.themeColor)
      ? candidate.themeColor
      : defaultThemePreference.themeColor,
    chartColor: includes(chartColors, candidate.chartColor)
      ? candidate.chartColor
      : defaultThemePreference.chartColor,
    mode: includes(colorModes, candidate.mode) ? candidate.mode : defaultThemePreference.mode,
  };
};

export const parseThemePreference = (value: string | null): ThemePreference => {
  if (value === null) return defaultThemePreference;
  try {
    return decodeThemePreference(JSON.parse(value));
  } catch {
    return defaultThemePreference;
  }
};

export const serializeThemePreference = (preference: ThemePreference): string =>
  JSON.stringify(preference);

export const presetPreference = (presetId: ThemePresetId, mode: ColorMode): ThemePreference => {
  const preset = themePresets.find(({ id }) => id === presetId) ?? themePresets[0]!;
  return {
    version: 1,
    baseColor: preset.baseColor,
    themeColor: preset.themeColor,
    chartColor: preset.chartColor,
    mode,
  };
};

export const selectedPresetId = (preference: ThemePreference): ThemePresetId | null =>
  themePresets.find(
    (preset) =>
      preset.baseColor === preference.baseColor &&
      preset.themeColor === preference.themeColor &&
      preset.chartColor === preference.chartColor,
  )?.id ?? null;

const themeColorByMode: Readonly<Record<ThemeColor, Readonly<{ light: string; dark: string }>>> = {
  blue: { light: '#f7f9ff', dark: '#10131a' },
  violet: { light: '#fbf8ff', dark: '#141119' },
  amber: { light: '#fff9f0', dark: '#17130d' },
  rose: { light: '#fff8fa', dark: '#191114' },
  emerald: { light: '#f7f9f5', dark: '#101411' },
  sky: { light: '#f5faff', dark: '#0e1419' },
};

export const applyThemePreference = (preference: ThemePreference, systemDark = false): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = preference.mode === 'dark' || (preference.mode === 'system' && systemDark);
  root.dataset.baseColor = preference.baseColor;
  root.dataset.themeColor = preference.themeColor;
  root.dataset.chartColor = preference.chartColor;
  root.dataset.colorMode = preference.mode;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', themeColorByMode[preference.themeColor][isDark ? 'dark' : 'light']);
};

export const readThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return defaultThemePreference;
  try {
    return parseThemePreference(localStorage.getItem(themePreferenceStorageKey));
  } catch {
    return defaultThemePreference;
  }
};

export const initializeThemePreference = (): ThemePreference => {
  const preference = readThemePreference();
  if (typeof window === 'undefined') return preference;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  applyThemePreference(preference, media.matches);
  const onChange = (event: MediaQueryListEvent): void => {
    const latest = readThemePreference();
    if (latest.mode === 'system') applyThemePreference(latest, event.matches);
  };
  media.addEventListener('change', onChange);
  return preference;
};

export const persistThemePreference = (preference: ThemePreference): void => {
  const validated = decodeThemePreference(preference);
  applyThemePreference(validated, window.matchMedia('(prefers-color-scheme: dark)').matches);
  localStorage.setItem(themePreferenceStorageKey, serializeThemePreference(validated));
};
