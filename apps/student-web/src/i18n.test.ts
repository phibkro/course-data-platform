import { describe, expect, test } from 'vitest';

import { isLocale, localeTag, translate, translateToken } from './i18n';

describe('interface localization', () => {
  test('supports the two first-party BCP 47 locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('nb')).toBe(true);
    expect(isLocale('no')).toBe(false);
    expect(localeTag('en')).toBe('en-GB');
    expect(localeTag('nb')).toBe('nb-NO');
  });

  test('interpolates semantic messages without changing source prose', () => {
    expect(translate('en', 'catalogue.showing', { shown: 20, total: 2800 })).toBe(
      'Showing 20 of 2800 courses',
    );
    expect(translate('nb', 'catalogue.showing', { shown: 20, total: 2800 })).toBe(
      'Viser 20 av 2800 emner',
    );
  });

  test('translates known domain tokens and preserves an explicit fallback', () => {
    expect(translateToken('nb', 'written-exam')).toBe('Skriftlig eksamen');
    expect(translateToken('en', 'written-exam')).toBe('Written Exam');
    expect(translateToken('nb', 'provider-specific-value')).toBe('Provider Specific Value');
  });
});
