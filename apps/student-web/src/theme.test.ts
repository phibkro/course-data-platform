import { describe, expect, test } from 'vitest';

import {
  decodeThemePreference,
  defaultThemePreference,
  parseThemePreference,
  presetPreference,
  selectedPresetId,
  serializeThemePreference,
} from './theme';

describe('theme preference', () => {
  test('defaults to the Fjord preset and system appearance', () => {
    expect(defaultThemePreference).toEqual({
      version: 1,
      baseColor: 'mist',
      themeColor: 'blue',
      chartColor: 'sky',
      mode: 'system',
    });
    expect(selectedPresetId(defaultThemePreference)).toBe('fjord');
  });

  test('repairs invalid dimensions independently', () => {
    expect(
      decodeThemePreference({
        version: 99,
        baseColor: 'mauve',
        themeColor: 'not-a-theme',
        chartColor: 'rose',
        mode: 'dark',
      }),
    ).toEqual({
      version: 1,
      baseColor: 'mauve',
      themeColor: 'blue',
      chartColor: 'rose',
      mode: 'dark',
    });
  });

  test('round-trips serializable preferences and safely handles malformed JSON', () => {
    const preference = presetPreference('pine', 'light');
    expect(parseThemePreference(serializeThemePreference(preference))).toEqual(preference);
    expect(parseThemePreference('{broken')).toEqual(defaultThemePreference);
    expect(parseThemePreference(null)).toEqual(defaultThemePreference);
  });
});
