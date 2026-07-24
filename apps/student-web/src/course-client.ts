import {
  CourseDecisionSignalsResponseDto,
  CourseGradeSummariesResponseDto,
  CourseInsightResponseDto,
  CourseSearchResponseDto,
  ProblemDto,
  type CourseDecisionSignalsResponseDtoType,
  type CourseGradeSummariesResponseDtoType,
  type CourseInsightResponseDtoType,
  type CourseSearchResponseDtoType,
} from '@course-data/contracts';
import { Value } from '@sinclair/typebox/value';
import { Effect, Schema as S } from 'effect';

import { partialCourseInsightFixture } from './course-insight.fixture';

export interface CourseClient {
  readonly search: (request: CourseSearchRequest) => Effect.Effect<CourseSearchResponse, Error>;
  readonly getGradeSummaries: (
    courseCodes: ReadonlyArray<string>,
  ) => Effect.Effect<CourseGradeSummariesResponse, Error>;
  readonly getDecisionSignals: (
    courseCodes: ReadonlyArray<string>,
    term?: string,
  ) => Effect.Effect<CourseDecisionSignalsResponse, Error>;
  readonly getInsight: (
    courseCode: string,
    term?: string,
  ) => Effect.Effect<CourseInsightResponseDtoType, Error>;
}

export type CourseSearchSort = 'relevance' | 'title-asc' | 'title-desc' | 'code-asc' | 'code-desc';

export interface CourseSearchRequest {
  readonly query: string;
  readonly term: string;
  readonly page: number;
  readonly sort: CourseSearchSort;
  readonly campus?: string;
  readonly level?: string;
  readonly continuingEducation: boolean;
  readonly open: boolean;
  readonly english: boolean;
}

export type CourseSearchResponse = CourseSearchResponseDtoType;
export type CourseGradeSummariesResponse = CourseGradeSummariesResponseDtoType;
export type CourseDecisionSignalsResponse = CourseDecisionSignalsResponseDtoType;

const isCourseInsightResponse = (input: unknown): input is CourseInsightResponseDtoType =>
  Value.Check(CourseInsightResponseDto, input);

const isCourseSearchResponse = (input: unknown): input is CourseSearchResponse =>
  Value.Check(CourseSearchResponseDto, input);

const isCourseGradeSummariesResponse = (input: unknown): input is CourseGradeSummariesResponse =>
  Value.Check(CourseGradeSummariesResponseDto, input);

const isCourseDecisionSignalsResponse = (input: unknown): input is CourseDecisionSignalsResponse =>
  Value.Check(CourseDecisionSignalsResponseDto, input);

export const CourseInsightResponseSchema = S.declare(isCourseInsightResponse);
export const CourseSearchResponseSchema = S.declare(isCourseSearchResponse);
export const CourseGradeSummariesResponseSchema = S.declare(isCourseGradeSummariesResponse);
export const CourseDecisionSignalsResponseSchema = S.declare(isCourseDecisionSignalsResponse);

const parseCourseInsight = (input: unknown): CourseInsightResponseDtoType => {
  if (!isCourseInsightResponse(input)) {
    throw new Error('The course API returned an invalid CourseInsight response.');
  }
  return input;
};

const parseCourseSearch = (input: unknown): CourseSearchResponse => {
  if (!isCourseSearchResponse(input)) {
    throw new Error('The course API returned an invalid CourseSearch response.');
  }
  return input;
};

const parseCourseGradeSummaries = (input: unknown): CourseGradeSummariesResponse => {
  if (!isCourseGradeSummariesResponse(input)) {
    throw new Error('The course API returned an invalid CourseGradeSummaries response.');
  }
  return input;
};

const parseCourseDecisionSignals = (input: unknown): CourseDecisionSignalsResponse => {
  if (!isCourseDecisionSignalsResponse(input)) {
    throw new Error('The course API returned an invalid CourseDecisionSignals response.');
  }
  return input;
};

export const fixtureSearchResponse = (page: number): CourseSearchResponse =>
  parseCourseSearch({
    items:
      page === 1
        ? [
            {
              courseKey: partialCourseInsightFixture.item.courseKey,
              institutionCode: 'NTNU',
              code: partialCourseInsightFixture.item.code,
              title: partialCourseInsightFixture.item.title,
              credits: partialCourseInsightFixture.item.credits,
              level: partialCourseInsightFixture.item.level,
              offerings: partialCourseInsightFixture.item.offerings,
              assessmentSignals: {
                state: 'known',
                value:
                  partialCourseInsightFixture.item.assessment.state === 'known'
                    ? partialCourseInsightFixture.item.assessment.value.map((part) => part.form)
                    : [],
                evidenceIds: partialCourseInsightFixture.item.assessment.evidenceIds,
              },
              workFormSignals: partialCourseInsightFixture.item.workForms,
              enrichment: 'partial',
              evidence: partialCourseInsightFixture.item.evidence,
            },
          ]
        : [],
    sourceStatuses: partialCourseInsightFixture.item.sourceStatuses,
    meta: {
      count: page === 1 ? 1 : 0,
      total: 1,
      page,
      pageSize: 1,
      hasMore: false,
      exactMatchCode: null,
    },
  });

export const fixtureGradeSummariesResponse = (
  courseCodes: ReadonlyArray<string>,
): CourseGradeSummariesResponse =>
  parseCourseGradeSummaries({
    items: courseCodes.map((courseCode) => {
      const normalizedCode = courseCode.trim().toUpperCase();
      const available = normalizedCode === 'TDT4136';
      const reason = 'No official DBH/HK-dir grade outcomes were found for this period.';
      const evidenceId = 'grades-fixture';
      return {
        courseCode: normalizedCode,
        period: available
          ? { state: 'known', value: { fromYear: 2022, toYear: 2025 }, evidenceIds: [evidenceId] }
          : { state: 'unavailable', reason, evidenceIds: [] },
        sampleSize: available
          ? { state: 'known', value: 1951, evidenceIds: [evidenceId] }
          : { state: 'unavailable', reason, evidenceIds: [] },
        distribution: available
          ? {
              state: 'known',
              value: [
                { grade: 'A', count: 200, percentage: 10.25 },
                { grade: 'B', count: 430, percentage: 22.04 },
                { grade: 'C', count: 650, percentage: 33.32 },
                { grade: 'D', count: 350, percentage: 17.94 },
                { grade: 'E', count: 112, percentage: 5.74 },
                { grade: 'F', count: 209, percentage: 10.71 },
              ],
              evidenceIds: [evidenceId],
            }
          : { state: 'unavailable', reason, evidenceIds: [] },
        failureRatePercent: available
          ? { state: 'known', value: 10.7, evidenceIds: [evidenceId] }
          : { state: 'unavailable', reason, evidenceIds: [] },
        gradingScale: available
          ? { state: 'known', value: 'letter' as const, evidenceIds: [evidenceId] }
          : { state: 'unavailable', reason, evidenceIds: [] },
        evidence: available
          ? [
              {
                id: evidenceId,
                provider: 'dbh',
                kind: 'fixture' as const,
                recordId: `dbh:308:${normalizedCode}:2022-2025`,
                sourceUrl: null,
                sourcePeriod: '2022-2025',
                observedAt: '2026-07-24T01:00:00.000Z',
                excerpt: null,
                inferenceRule: null,
              },
            ]
          : [],
      };
    }),
    sourceStatuses: [
      {
        provider: 'dbh',
        status: 'available',
        observedAt: '2026-07-24T01:00:00.000Z',
        warning: null,
      },
    ],
    meta: { count: courseCodes.length, fromYear: 2022, toYear: 2025 },
  });

export const fixtureDecisionSignalsResponse = (
  courseCodes: ReadonlyArray<string>,
): CourseDecisionSignalsResponse =>
  parseCourseDecisionSignals({
    items: courseCodes.map((courseCode) => {
      const normalizedCode = courseCode.trim().toUpperCase();
      const available = normalizedCode === partialCourseInsightFixture.item.code;
      const reason = 'The fixture contains no NTNU decision signals for this course.';
      return {
        courseCode: normalizedCode,
        credits: available
          ? partialCourseInsightFixture.item.credits
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        assessment: available
          ? partialCourseInsightFixture.item.assessment
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        workFormSignals: available
          ? partialCourseInsightFixture.item.workForms
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        obligatoryActivities: available
          ? partialCourseInsightFixture.item.obligatoryActivities
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        collaboration: available
          ? partialCourseInsightFixture.item.collaboration
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        attendance: available
          ? partialCourseInsightFixture.item.attendance
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        onlineParticipation: available
          ? partialCourseInsightFixture.item.onlineParticipation
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        sourceStatus: {
          provider: 'ntnu-course-page',
          status: available ? ('available' as const) : ('unavailable' as const),
          observedAt: available ? '2026-07-24T01:00:00.000Z' : null,
          warning: available ? null : reason,
        },
        evidence: available ? partialCourseInsightFixture.item.evidence : [],
      };
    }),
    meta: { count: courseCodes.length },
  });

const readProblem = async (response: Response, fallback: string): Promise<never> => {
  const problem: unknown = await response.json().catch(() => null);
  if (Value.Check(ProblemDto, problem)) {
    throw new Error(problem.detail);
  }
  throw new Error(fallback);
};

export const makeCourseClient = (apiBaseUrl?: string, useFixture = false): CourseClient => ({
  search: (request) => {
    if (useFixture) {
      return Effect.sleep('150 millis').pipe(Effect.as(fixtureSearchResponse(request.page)));
    }

    if (apiBaseUrl === undefined || apiBaseUrl.length === 0) {
      return Effect.fail(
        new Error(
          'Course API URL is not configured. Set VITE_API_URL or explicitly enable the local fixture.',
        ),
      );
    }

    return Effect.tryPromise({
      try: async () => {
        const query = new URLSearchParams({
          term: request.term,
          page: String(request.page),
          sort: request.sort,
          continuingEducation: String(request.continuingEducation),
          open: String(request.open),
          english: String(request.english),
        });
        const normalizedQuery = request.query.trim();
        if (normalizedQuery.length > 0) query.set('query', normalizedQuery);
        if (request.campus !== undefined) query.set('campuses', request.campus);
        if (request.level !== undefined) query.set('levels', request.level);

        const response = await fetch(
          `${apiBaseUrl.replace(/\/$/, '')}/v1/course-search?${query.toString()}`,
          { headers: { accept: 'application/json' } },
        );
        if (!response.ok) {
          return readProblem(
            response,
            `Course search request failed with status ${response.status}.`,
          );
        }
        return parseCourseSearch(await response.json());
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error('The course search failed unexpectedly.'),
    });
  },
  getGradeSummaries: (courseCodes) => {
    if (useFixture) {
      return Effect.sleep('100 millis').pipe(Effect.as(fixtureGradeSummariesResponse(courseCodes)));
    }

    if (apiBaseUrl === undefined || apiBaseUrl.length === 0) {
      return Effect.fail(
        new Error(
          'Course API URL is not configured. Set VITE_API_URL or explicitly enable the local fixture.',
        ),
      );
    }

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/v1/course-grade-summaries`, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ courseCodes }),
        });
        if (!response.ok) {
          return readProblem(
            response,
            `Course grade-summary request failed with status ${response.status}.`,
          );
        }
        return parseCourseGradeSummaries(await response.json());
      },
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error('The course grade-summary request failed unexpectedly.'),
    });
  },
  getDecisionSignals: (courseCodes, term) => {
    if (useFixture) {
      return Effect.sleep('120 millis').pipe(
        Effect.as(fixtureDecisionSignalsResponse(courseCodes)),
      );
    }

    if (apiBaseUrl === undefined || apiBaseUrl.length === 0) {
      return Effect.fail(
        new Error(
          'Course API URL is not configured. Set VITE_API_URL or explicitly enable the local fixture.',
        ),
      );
    }

    return Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(
          `${apiBaseUrl.replace(/\/$/, '')}/v1/course-decision-signals`,
          {
            method: 'POST',
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({ courseCodes, ...(term === undefined ? {} : { term }) }),
            signal,
          },
        );
        if (!response.ok) {
          return readProblem(
            response,
            `Course decision-signal request failed with status ${response.status}.`,
          );
        }
        return parseCourseDecisionSignals(await response.json());
      },
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error('The course decision-signal request failed unexpectedly.'),
    });
  },
  getInsight: (courseCode, term) => {
    const normalizedCode = courseCode.trim().toUpperCase();

    if (useFixture) {
      if (normalizedCode !== 'TDT4136') {
        return Effect.fail(
          new Error('The local walking skeleton currently contains only TDT4136.'),
        );
      }

      return Effect.sleep('250 millis').pipe(Effect.as(partialCourseInsightFixture));
    }

    if (apiBaseUrl === undefined || apiBaseUrl.length === 0) {
      return Effect.fail(
        new Error(
          'Course API URL is not configured. Set VITE_API_URL or explicitly enable the local fixture.',
        ),
      );
    }

    return Effect.tryPromise({
      try: async () => {
        const query = new URLSearchParams();
        if (term !== undefined) query.set('term', term);
        const suffix = query.size === 0 ? '' : `?${query.toString()}`;
        const response = await fetch(
          `${apiBaseUrl.replace(/\/$/, '')}/v1/courses/${encodeURIComponent(normalizedCode)}/insight${suffix}`,
          {
            headers: { accept: 'application/json' },
          },
        );
        if (!response.ok) {
          return readProblem(response, `Course API request failed with status ${response.status}.`);
        }
        return parseCourseInsight(await response.json());
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error('The course API request failed unexpectedly.'),
    });
  },
});

const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

export const courseClient = makeCourseClient(
  apiBaseUrl,
  import.meta.env.VITE_USE_FIXTURE === 'true',
);
