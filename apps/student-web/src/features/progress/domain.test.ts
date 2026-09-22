import { describe, expect, test } from 'vitest';

import {
  calculateProgress,
  decodeProgressState,
  defaultPolicy,
  parseTranscript,
  ntnuResultCourses,
  serializeProgressState,
  type CourseResult,
  type ProgressState,
} from './domain';

const course = (overrides: Partial<CourseResult> = {}): CourseResult => ({
  institution: 'NTNU',
  code: 'TDT4100',
  name: 'Object-oriented programming',
  year: 2025,
  term: 1,
  credits: 7.5,
  grade: 'A',
  included: true,
  ...overrides,
});

describe('student progress domain', () => {
  test('calculates a decimal-credit weighted average without treating pass or fail as zero grades', () => {
    const summary = calculateProgress([
      course({ credits: 7.5, grade: 'A' }),
      course({ code: 'TMA4100', name: 'Calculus', credits: 2.5, grade: 'C' }),
      course({ code: 'EXPH0300', name: 'Examen philosophicum', credits: 10, grade: 'pass' }),
      course({ code: 'HMS0001', name: 'Safety training', credits: 5, grade: 'fail' }),
    ]);

    expect(summary).toEqual({
      average: 4.5,
      weightedSum: 45,
      earnedCredits: 20,
      gradedCredits: 10,
      includedCourses: 4,
      supersededAttempts: 0,
      gradeCredits: {
        A: 7.5,
        B: 0,
        C: 2.5,
        D: 0,
        E: 0,
        F: 0,
        pass: 10,
        fail: 5,
        recognized: 0,
      },
    });
  });

  test('selects the latest or best result according to the explicit retake policy', () => {
    const results = [
      course({ year: 2023, term: 2, grade: 'A' }),
      course({ year: 2025, term: 1, grade: 'C' }),
    ];

    expect(calculateProgress(results, { includeF: true, retakes: 'latest' }).average).toBe(3);
    expect(calculateProgress(results, { includeF: true, retakes: 'best' }).average).toBe(5);
  });

  test('groups normalized NTNU attempts without projecting other institutions', () => {
    const courses = ntnuResultCourses([
      course({ institution: ' ntnu ', code: 'TDT4100', name: 'Older title', year: 2023, term: 2 }),
      course({ code: 'tdt4100', name: 'Current title', year: 2025, term: 1, grade: 'B' }),
      course({ code: 'TDT4100-1', name: 'Variant', year: 2024, term: 2 }),
      course({ institution: 'UiO', code: 'IN1000', name: 'UiO course' }),
      course({ institution: 'Unknown', code: 'ABC123', name: 'Unknown course' }),
    ]);

    expect(courses).toHaveLength(2);
    expect(courses[0]).toMatchObject({
      identity: { savedCourseId: 'ntnu:TDT4100', courseCode: 'TDT4100' },
      title: 'Current title',
      latest: { year: 2025, term: 1, grade: 'B' },
    });
    expect(courses[0]?.results).toHaveLength(2);
    expect(courses[1]).toMatchObject({
      identity: { savedCourseId: 'ntnu:TDT4100-1', courseCode: 'TDT4100-1' },
      title: 'Variant',
    });
  });

  test('rejects conflicting results for the same course and semester', () => {
    expect(() => calculateProgress([course({ grade: 'B' }), course({ grade: 'C' })])).toThrow(
      /Conflicting results/u,
    );
  });

  test('parses synthetic NTNU and UiO FS rows while retaining an unknown-row warning', () => {
    const ntnu = parseTranscript(
      [
        'TDT4100 Object-oriented programming 2025 Vår 7,5 A',
        'TMA4100 Calculus 2025 Høst 7,5 Bestått',
        'ABC123 Course line with an unsupported result',
        'Sum studiepoeng 15',
      ].join('\n'),
      'NTNU',
    );
    const uio = parseTranscript('IN1000 Introduction to IT 2024 Spring 10 Passed', 'UiO');

    expect(ntnu.results).toMatchObject([
      { institution: 'NTNU', code: 'TDT4100', credits: 7.5, grade: 'A' },
      { institution: 'NTNU', code: 'TMA4100', credits: 7.5, grade: 'pass' },
    ]);
    expect(ntnu.warnings).toContain(
      'A course-looking row could not be read. Review the original transcript before saving.',
    );
    expect(uio.results).toMatchObject([
      { institution: 'UiO', code: 'IN1000', credits: 10, grade: 'pass' },
    ]);
  });

  test('migrates version 1 history and preserves corrupt or unsupported stored bytes', () => {
    const legacy = {
      version: 1 as const,
      results: [course()],
      policy: defaultPolicy,
    };
    const state: ProgressState = {
      version: 2,
      results: legacy.results,
      policy: legacy.policy,
      targetCredits: 180,
      importReceipts: [],
    };
    const serialized = serializeProgressState(state);

    expect(decodeProgressState(JSON.stringify(legacy))).toEqual({ ok: true, state });
    expect(decodeProgressState(serialized)).toEqual({ ok: true, state });
    expect(decodeProgressState('{not json')).toEqual({
      ok: false,
      reason: 'invalid-json',
      raw: '{not json',
    });
    expect(decodeProgressState(JSON.stringify({ ...state, version: 3 }))).toMatchObject({
      ok: false,
      reason: 'unsupported-version',
    });
    expect(
      decodeProgressState(
        JSON.stringify({
          ...state,
          results: [course({ credits: 7.123 })],
        }),
      ),
    ).toMatchObject({ ok: false, reason: 'invalid-shape' });
  });
});
