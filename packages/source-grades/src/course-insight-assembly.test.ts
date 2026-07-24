import {
  decodeCourseInsight,
  known,
  unknown,
  validateEvidenceReferences,
} from '@course-data/course-model';
import { describe, expect, it } from 'vitest';

import dbhFixture from '../fixtures/tdt4136-dbh-308.json';
import dbhSource from '../fixtures/tdt4136-dbh-308.source.json';
import gradesNoFixture from '../fixtures/tdt4136-grades-no.json';
import gradesNoSource from '../fixtures/tdt4136-grades-no.source.json';
import { parseDbhGrades } from './dbh-grades';
import { mapGradesToOutcomes } from './grade-outcomes';
import { parseGradesNoResponse } from './grades-no';

// The NTNU-side facts below mirror what packages/source-ntnu-course's own
// mapper produces for the fixtures in that package (verified by its own
// tests); they are inlined here rather than imported so each source package
// stays isolated, per the bounded workstream scope.
const ntnuEvidenceId = 'evidence:ntnu-course-search:TDT4136';
const ntnuEvidence = {
  id: ntnuEvidenceId,
  provider: 'ntnu-course-search',
  kind: 'source-fact' as const,
  recordId: 'ntnu-course-search:TDT4136',
  sourceUrl: 'https://www.ntnu.no/studier/emner/TDT4136',
  sourcePeriod: 'autumn-2026',
  observedAt: '2026-07-20T09:00:00Z',
  excerpt: 'Introduction to Artificial Intelligence',
  inferenceRule: null,
};

const gradesNoCapture = {
  retrievedAt: gradesNoSource.capturedAt,
  contentHash: gradesNoSource.contentHash.rawBody,
  requestUrl: gradesNoSource.requestUrl,
  courseCode: gradesNoSource.courseCode,
  evidenceKind: 'fixture' as const,
};
const dbhCapture = {
  retrievedAt: dbhSource.capturedAt,
  contentHash: dbhSource.contentHash.rawBody,
  courseCode: dbhSource.courseCode,
  fromYear: dbhSource.fromYear,
  toYear: dbhSource.toYear,
  evidenceKind: 'fixture' as const,
};
const gradesNo = parseGradesNoResponse(gradesNoFixture, gradesNoCapture).accepted;
const dbh = parseDbhGrades(dbhFixture, dbhCapture).accepted;

const missing = <A>() => unknown<A>('Not exercised by this bounded slice.');

const buildBase = (gradeOutcomesInput: {
  period: unknown;
  sampleSize: unknown;
  distribution: unknown;
  failureRatePercent: unknown;
  averageGrade: unknown;
  medianGrade: unknown;
  evidence: ReadonlyArray<unknown>;
  sourceStatuses: ReadonlyArray<unknown>;
}) => ({
  courseKey: 'ntnu:TDT4136:2026-autumn',
  institutionCode: 'NTNU' as const,
  code: 'TDT4136',
  title: known('Introduction to Artificial Intelligence', [ntnuEvidenceId]),
  credits: known(7.5, [ntnuEvidenceId]),
  level: missing<'bachelor' | 'master' | 'phd' | 'continuing-education' | 'unknown'>(),
  teachingLanguage: known('English', [ntnuEvidenceId]),
  offerings: known(
    [
      {
        academicYear: 2026,
        season: 'autumn' as const,
        campuses: ['Trondheim'],
        deliveryModes: ['in-person' as const],
      },
    ],
    [ntnuEvidenceId],
  ),
  content: known(
    'Search and knowledge representation, planning, and reasoning under uncertainty.',
    [ntnuEvidenceId],
  ),
  learningOutcomes: known('Apply foundational AI methods.', [ntnuEvidenceId]),
  teachingMethods: known('Lectures and exercises.', [ntnuEvidenceId]),
  workForms: known(['lectures' as const, 'exercises' as const], [ntnuEvidenceId]),
  assessment: known(
    [
      {
        form: 'written-exam' as const,
        description: 'Skoleeksamen',
        requirement: missing<'required' | 'optional' | 'choice' | 'conditional'>(),
        weightPercent: known(100, [ntnuEvidenceId]),
        duration: missing<string>(),
        workloadPattern: missing<'distributed' | 'concentrated' | 'recurring' | 'milestone'>(),
      },
    ],
    [ntnuEvidenceId],
  ),
  obligatoryActivities: known(
    [
      {
        description: 'Øvinger må være godkjent for å kunne gå opp til eksamen.',
        form: known('assignment' as const, [ntnuEvidenceId]),
        workloadPattern: missing<'distributed' | 'concentrated' | 'recurring' | 'milestone'>(),
      },
    ],
    [ntnuEvidenceId],
  ),
  collaboration: known('mixed' as const, [ntnuEvidenceId]),
  attendance: known('not-required' as const, [ntnuEvidenceId]),
  onlineParticipation: missing<'available' | 'not-available'>(),
  prerequisites: known('Ingen', [ntnuEvidenceId]),
  accessRestrictions: known('Ingen', [ntnuEvidenceId]),
  gradeOutcomes: {
    period: gradeOutcomesInput.period,
    sampleSize: gradeOutcomesInput.sampleSize,
    distribution: gradeOutcomesInput.distribution,
    failureRatePercent: gradeOutcomesInput.failureRatePercent,
    averageGrade: gradeOutcomesInput.averageGrade,
    medianGrade: gradeOutcomesInput.medianGrade,
  },
  sourceStatuses: [
    {
      provider: 'ntnu-course-search',
      status: 'available' as const,
      observedAt: '2026-07-20T09:00:00Z',
      warning: null,
    },
    {
      provider: 'ntnu-course-page',
      status: 'available' as const,
      observedAt: '2026-07-20T09:00:05Z',
      warning: null,
    },
    ...gradeOutcomesInput.sourceStatuses,
  ],
  evidence: [ntnuEvidence, ...gradeOutcomesInput.evidence],
});

describe('TDT4136 CourseInsight assembly (NTNU + grades)', () => {
  it('decodes a full CourseInsight combining NTNU content facts with agreeing grade evidence', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', gradesNo, dbh, {
      fromYear: 2023,
      toYear: 2024,
      semesters: ['AUTUMN', 'SPRING'],
      minimumCohortSize: 4,
    });
    const encoded = buildBase(outcomes);

    const insight = decodeCourseInsight(encoded);

    expect(insight.gradeOutcomes.sampleSize).toMatchObject({ state: 'known', value: 408 });
    expect(insight.gradeOutcomes.averageGrade).toMatchObject({ state: 'known', value: 'C' });
    expect(validateEvidenceReferences(insight)).toEqual([]);
  });

  it('stays partially useful when both grade providers fail: NTNU facts known, grade facts unavailable', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', null, null, {
      fromYear: 2023,
      toYear: 2024,
      semesters: ['AUTUMN', 'SPRING'],
      minimumCohortSize: 4,
    });
    const encoded = buildBase(outcomes);

    const insight = decodeCourseInsight(encoded);

    expect(insight.title).toMatchObject({ state: 'known' });
    expect(insight.content).toMatchObject({ state: 'known' });
    expect(insight.gradeOutcomes.sampleSize.state).toBe('unavailable');
    expect(insight.sourceStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'grades-no', status: 'failed' }),
        expect.objectContaining({ provider: 'dbh', status: 'failed' }),
      ]),
    );
    expect(validateEvidenceReferences(insight)).toEqual([]);
  });
});
