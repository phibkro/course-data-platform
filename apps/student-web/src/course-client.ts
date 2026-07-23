import {
  CourseInsightResponseDto,
  CourseSearchResponseDto,
  ProblemDto,
  type CourseInsightResponseDtoType,
  type CourseSearchResponseDtoType,
} from '@course-data/contracts';
import { Value } from '@sinclair/typebox/value';
import { Effect, Schema as S } from 'effect';

import { partialCourseInsightFixture } from './course-insight.fixture';

export interface CourseClient {
  readonly search: (request: CourseSearchRequest) => Effect.Effect<CourseSearchResponse, Error>;
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

const isCourseInsightResponse = (input: unknown): input is CourseInsightResponseDtoType =>
  Value.Check(CourseInsightResponseDto, input);

const isCourseSearchResponse = (input: unknown): input is CourseSearchResponse =>
  Value.Check(CourseSearchResponseDto, input);

export const CourseInsightResponseSchema = S.declare(isCourseInsightResponse);
export const CourseSearchResponseSchema = S.declare(isCourseSearchResponse);

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
