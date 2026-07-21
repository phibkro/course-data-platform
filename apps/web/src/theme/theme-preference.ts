export const baseColors = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'] as const;
export const themeColors = [
  'emerald',
  'blue',
  'indigo',
  'violet',
  'rose',
  'amber',
  'lime',
  'sky',
] as const;
export const chartColors = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet'] as const;
export const colorModes = ['system', 'light', 'dark'] as const;

export type BaseColor = (typeof baseColors)[number];
export type ThemeColor = (typeof themeColors)[number];
export type ChartColor = (typeof chartColors)[number];
export type ColorMode = (typeof colorModes)[number];

export type ThemePreference = {
  readonly version: 1;
  readonly baseColor: BaseColor;
  readonly themeColor: ThemeColor;
  readonly chartColor: ChartColor;
  readonly mode: ColorMode;
};

export const defaultThemePreference: ThemePreference = {
  version: 1,
  baseColor: 'mist',
  themeColor: 'emerald',
  chartColor: 'indigo',
  mode: 'system',
};

export const themePreferenceStorageKey = 'course-data-theme-v1';

const includes = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === 'string' && values.includes(value as Value);

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

export const parseThemePreference = (value: string): ThemePreference => {
  try {
    return decodeThemePreference(JSON.parse(value));
  } catch {
    return defaultThemePreference;
  }
};

export const serializeThemePreference = (preference: ThemePreference): string =>
  JSON.stringify(preference, null, 2);
