import {
  decodeCourseGradeSummary,
  decodeCourseInsight,
  decodeCourseSearchItem,
  known,
  unavailable,
  unknown,
  type CourseInsight,
  type CourseSearchItem,
  type Fact,
} from '@course-data/course-model';
import * as Effect from 'effect/Effect';

import { CourseNotFoundError, type CourseDecisionService } from './index';

const observedAt = '2026-07-23T10:00:00.000Z';
const coursePageEvidenceId = 'fixture:ntnu-course-page:TDT4136:2026-spring';
const gradesEvidenceId = 'fixture:grades-no:TDT4136:all-time';

const coursePageEvidence = {
  id: coursePageEvidenceId,
  provider: 'ntnu-course-page',
  kind: 'fixture' as const,
  recordId: 'TDT4136:2026-spring',
  sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
  sourcePeriod: '2026-spring',
  observedAt,
  excerpt: 'Fixture captured from the prototype path; replace with live validated source evidence.',
  inferenceRule: null,
};

const gradesEvidence = {
  id: gradesEvidenceId,
  provider: 'grades-no',
  kind: 'fixture' as const,
  recordId: 'TDT4136:all-time',
  sourceUrl: 'https://grades.no/course/TDT4136',
  sourcePeriod: 'all-time through 2025',
  observedAt,
  excerpt: 'Prototype observation: sample size 1951, failure rate 10.7%, average grade C.',
  inferenceRule: null,
};

const missing = <A>(reason: string): Fact<A> => unknown(reason);

const encodedInsight = {
  courseKey: 'ntnu:TDT4136:2026-spring',
  institutionCode: 'NTNU' as const,
  code: 'TDT4136',
  title: known('Introduction to Artificial Intelligence', [coursePageEvidenceId]),
  credits: known(7.5, [coursePageEvidenceId]),
  level: missing<'bachelor' | 'master' | 'phd' | 'continuing-education' | 'unknown'>(
    'The fixture does not classify course level.',
  ),
  teachingLanguage: known('English', [coursePageEvidenceId]),
  offerings: known(
    [
      {
        academicYear: 2026,
        season: 'spring' as const,
        campuses: ['Trondheim'],
        deliveryModes: ['in-person' as const],
      },
    ],
    [coursePageEvidenceId],
  ),
  content: known(
    'Problem solving by search, knowledge representation, reasoning, and foundational artificial intelligence methods.',
    [coursePageEvidenceId],
  ),
  learningOutcomes: known(
    'Explain and apply foundational methods for search, representation, and reasoning.',
    [coursePageEvidenceId],
  ),
  teachingMethods: known('Lectures and exercises with obligatory assignments.', [
    coursePageEvidenceId,
  ]),
  workForms: known(['lectures' as const, 'exercises' as const], [coursePageEvidenceId]),
  assessment: known(
    [
      {
        form: 'written-exam' as const,
        description: 'Written school examination',
        weightPercent: 100,
        duration: null,
      },
    ],
    [coursePageEvidenceId],
  ),
  obligatoryActivities: known(
    ['Exercises must be approved before assessment.'],
    [coursePageEvidenceId],
  ),
  collaboration: missing<'individual' | 'group' | 'mixed'>(
    'The source text does not establish whether obligatory work is individual or collaborative.',
  ),
  attendance: missing<'required' | 'not-required'>(
    'The source text does not establish an attendance requirement.',
  ),
  onlineParticipation: missing<'available' | 'not-available'>(
    'The source text does not establish whether remote participation is available.',
  ),
  prerequisites: missing<string>('The fixture does not contain prerequisite evidence.'),
  accessRestrictions: missing<string>('The fixture does not contain access restrictions.'),
  gradeOutcomes: {
    period: unavailable<{ fromYear: number; toYear: number }>(
      'The prototype aggregate did not expose a bounded from/to period.',
      [gradesEvidenceId],
    ),
    sampleSize: known(1951, [gradesEvidenceId]),
    distribution: unavailable<
      ReadonlyArray<{
        grade: string;
        count: number;
        percentage: number;
      }>
    >('The captured prototype observation did not retain grade buckets.', [gradesEvidenceId]),
    failureRatePercent: known(10.7, [gradesEvidenceId]),
    averageGrade: known('C', [gradesEvidenceId]),
    medianGrade: unavailable<string>('The provider observation did not expose a median.', [
      gradesEvidenceId,
    ]),
  },
  sourceStatuses: [
    {
      provider: 'ntnu-course-page',
      status: 'available' as const,
      observedAt,
      warning: 'Fixture evidence; live adapter not connected.',
    },
    {
      provider: 'grades-no',
      status: 'available' as const,
      observedAt,
      warning: 'Fixture evidence; live adapter not connected.',
    },
  ],
  evidence: [coursePageEvidence, gradesEvidence],
};

export const fixtureCourseInsight: CourseInsight = decodeCourseInsight(encodedInsight);

export const fixtureCourseSearchItem: CourseSearchItem = decodeCourseSearchItem({
  courseKey: encodedInsight.courseKey,
  institutionCode: encodedInsight.institutionCode,
  code: encodedInsight.code,
  title: encodedInsight.title,
  credits: encodedInsight.credits,
  level: encodedInsight.level,
  offerings: encodedInsight.offerings,
  assessmentSignals: known(['written-exam' as const], [coursePageEvidenceId]),
  workFormSignals: encodedInsight.workForms,
  enrichment: 'enriched',
  evidence: [coursePageEvidence],
});

export const fixtureCourseDecisionService: CourseDecisionService = {
  search: ({ query, page = 1 }) => {
    const normalizedQuery = query?.trim().toUpperCase() ?? '';
    const matches =
      normalizedQuery.length === 0 ||
      ['TDT4136', 'ARTIFICIAL INTELLIGENCE'].some((candidate) =>
        candidate.includes(normalizedQuery),
      );
    return Effect.succeed({
      items: matches && page === 1 ? [fixtureCourseSearchItem] : [],
      sourceStatuses: fixtureCourseInsight.sourceStatuses,
      exactMatchCode: normalizedQuery === 'TDT4136' ? 'TDT4136' : null,
      total: matches ? 1 : 0,
      page,
      pageSize: 500,
      hasMore: false,
    });
  },
  getInsight: ({ courseCode }) =>
    courseCode.trim().toUpperCase() === 'TDT4136'
      ? Effect.succeed({ item: fixtureCourseInsight, partial: true })
      : Effect.fail(new CourseNotFoundError({ courseCode })),
  getGradeSummaries: ({ courseCodes }) => {
    const normalizedCodes = [
      ...new Set(courseCodes.map((courseCode) => courseCode.trim().toUpperCase())),
    ];
    const missingReason = 'The fixture contains no grade summary for this course.';
    return Effect.succeed({
      items: normalizedCodes.map((courseCode) =>
        courseCode === 'TDT4136'
          ? decodeCourseGradeSummary({
              courseCode,
              period: known({ fromYear: 2022, toYear: 2025 }, [gradesEvidenceId]),
              sampleSize: known(1951, [gradesEvidenceId]),
              failureRatePercent: known(10.7, [gradesEvidenceId]),
              gradingScale: known('letter', [gradesEvidenceId]),
              evidence: [gradesEvidence],
            })
          : decodeCourseGradeSummary({
              courseCode,
              period: unavailable(missingReason),
              sampleSize: unavailable(missingReason),
              failureRatePercent: unavailable(missingReason),
              gradingScale: unavailable(missingReason),
              evidence: [],
            }),
      ),
      sourceStatuses: [
        {
          provider: 'dbh',
          status: 'available' as const,
          observedAt: new Date(observedAt),
          warning: 'Fixture evidence; live adapter not connected.',
        },
      ],
      fromYear: 2022,
      toYear: 2025,
    });
  },
};
