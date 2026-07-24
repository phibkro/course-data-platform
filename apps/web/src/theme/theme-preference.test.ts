import { describe, expect, it } from 'vitest';

import {
  decodeThemePreference,
  defaultThemePreference,
  parseThemePreference,
  serializeThemePreference,
} from './theme-preference';

describe('theme preference', () => {
  it('uses Mist, Emerald, and Indigo by default', () => {
    expect(defaultThemePreference).toMatchObject({
      baseColor: 'mist',
      themeColor: 'emerald',
      chartColor: 'indigo',
    });
  });

  it('keeps valid fields and repairs invalid fields independently', () => {
    expect(
      decodeThemePreference({
        version: 99,
        baseColor: 'mauve',
        themeColor: 'invalid',
        chartColor: 'rose',
        mode: 'dark',
      }),
    ).toEqual({
      version: 1,
      baseColor: 'mauve',
      themeColor: 'emerald',
      chartColor: 'rose',
      mode: 'dark',
    });
  });

  it('round-trips a preference through portable JSON', () => {
    const preference = decodeThemePreference({
      baseColor: 'taupe',
      themeColor: 'violet',
      chartColor: 'amber',
      mode: 'light',
    });

    expect(parseThemePreference(serializeThemePreference(preference))).toEqual(preference);
  });

  it('falls back safely for malformed JSON', () => {
    expect(parseThemePreference('{')).toEqual(defaultThemePreference);
  });
});
