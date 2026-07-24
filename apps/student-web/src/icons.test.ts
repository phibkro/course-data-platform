import { expect, test } from 'vitest';

import { collaborationIconName, termSeasonIconName } from './icons';

test('collaboration facts map to distinct semantic icons', () => {
  expect(collaborationIconName('individual')).toBe('collaboration-individual');
  expect(collaborationIconName('group')).toBe('collaboration-group');
  expect(collaborationIconName('mixed')).toBe('collaboration-mixed');
});

test('term seasons include reserved winter and summer icon mappings', () => {
  expect(termSeasonIconName('autumn')).toBe('term-autumn');
  expect(termSeasonIconName('winter')).toBe('term-winter');
  expect(termSeasonIconName('spring')).toBe('term-spring');
  expect(termSeasonIconName('summer')).toBe('term-summer');
  expect(termSeasonIconName('full-year')).toBe('term-full-year');
});
