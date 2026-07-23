import { describe, expect, it } from 'vitest';

import {
  decodeCourseInsight,
  known,
  unknown,
  validateEvidenceReferences,
  type CourseInsight,
  type Fact,
} from './index';

const evidence = {
  id: 'ntnu-course-page:TDT4136:2026-spring',
  provider: 'ntnu-course-page',
  kind: 'source-fact' as const,
  recordId: 'TDT4136:2026-spring',
  sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
  sourcePeriod: '2026-spring',
  observedAt: '2026-07-23T10:00:00.000Z',
  excerpt: 'Written school exam and mandatory exercises.',
  inferenceRule: null,
};

const missing = <A>(): Fact<A> => unknown('The provider did not expose this fact.');

const encodedInsight = {
  courseKey: 'ntnu:TDT4136:2026-spring',
  institutionCode: 'NTNU' as const,
  code: 'TDT4136',
  title: known('Introduction to Artificial Intelligence', [evidence.id]),
  credits: known(7.5, [evidence.id]),
  level: known('bachelor' as const, [evidence.id]),
  teachingLanguage: known('English', [evidence.id]),
  offerings: known(
    [
      {
        academicYear: 2026,
        season: 'spring' as const,
        campuses: ['Trondheim'],
        deliveryModes: ['in-person' as const],
      },
    ],
    [evidence.id],
  ),
  content: known('Search and knowledge representation.', [evidence.id]),
  learningOutcomes: known('Apply foundational AI methods.', [evidence.id]),
  teachingMethods: known('Lectures and exercises.', [evidence.id]),
  workForms: known(['lectures' as const, 'exercises' as const], [evidence.id]),
  assessment: known(
    [
      {
        form: 'written-exam' as const,
        description: 'Written school exam',
        weightPercent: 100,
        duration: '4 hours',
      },
    ],
    [evidence.id],
  ),
  obligatoryActivities: known(['Exercises'], [evidence.id]),
  collaboration: missing<'individual' | 'group' | 'mixed'>(),
  attendance: missing<'required' | 'not-required'>(),
  onlineParticipation: missing<'available' | 'not-available'>(),
  prerequisites: missing<string>(),
  accessRestrictions: missing<string>(),
  gradeOutcomes: {
    period: missing<{ fromYear: number; toYear: number }>(),
    sampleSize: missing<number>(),
    distribution: missing<ReadonlyArray<{ grade: string; count: number; percentage: number }>>(),
    failureRatePercent: missing<number>(),
    averageGrade: missing<string>(),
    medianGrade: missing<string>(),
  },
  sourceStatuses: [
    {
      provider: 'ntnu-course-page',
      status: 'available' as const,
      observedAt: '2026-07-23T10:00:00.000Z',
      warning: null,
    },
  ],
  evidence: [evidence],
};

describe('CourseInsight', () => {
  it('decodes explicit fact states and source evidence', () => {
    const insight = decodeCourseInsight(encodedInsight);

    expect(insight.title).toMatchObject({
      state: 'known',
      value: 'Introduction to Artificial Intelligence',
    });
    expect(insight.attendance).toMatchObject({ state: 'unknown' });
    expect(insight.evidence[0]?.observedAt).toBeInstanceOf(Date);
  });

  it('reports dangling evidence references', () => {
    const insight = decodeCourseInsight({
      ...encodedInsight,
      credits: known(7.5, ['missing-evidence']),
    });

    expect(validateEvidenceReferences(insight)).toContainEqual({
      path: '$.credits.evidenceIds',
      evidenceId: 'missing-evidence',
    });
  });

  it('rejects a known fact without attribution', () => {
    expect(() =>
      decodeCourseInsight({
        ...encodedInsight,
        title: {
          state: 'known',
          value: 'Introduction to Artificial Intelligence',
          evidenceIds: [],
        },
      }),
    ).toThrow();
  });

  it('distinguishes a known false-like value from an unknown fact', () => {
    const notRequired = known<'required' | 'not-required'>('not-required', [evidence.id]);

    expect(notRequired.state).toBe('known');
    expect(missing<'required' | 'not-required'>().state).toBe('unknown');
  });

  it('accepts a fully typed internal CourseInsight', () => {
    const insight: CourseInsight = decodeCourseInsight(encodedInsight);

    expect(validateEvidenceReferences(insight)).toEqual([]);
  });
});
