import { describe, expect, it } from 'vitest';

import { makeCourseSummary } from './index';

describe('CourseSummary', () => {
  it('rejects impossible credit values at construction', () => {
    expect(() =>
      makeCourseSummary({
        id: 'no.ntnu:TDT4136:2026',
        courseId: 'no.ntnu:TDT4136',
        institutionId: 'no.ntnu',
        institutionShortName: 'NTNU',
        code: 'TDT4136',
        title: 'Introduction to Artificial Intelligence',
        academicYear: 2026,
        credits: 100,
        level: 'bachelor',
        teachingLanguage: 'en',
        source: {
          provider: 'fixture',
          recordId: 'fixture:TDT4136:2026',
          retrievedAt: '2026-07-20T00:00:00.000Z',
        },
      }),
    ).toThrow(/between 0 and 60/);
  });
});
