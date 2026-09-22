import {
  CourseDecisionSignalsResponseDto,
  CourseGradeSummariesResponseDto,
  CourseInsightResponseDto,
  CourseScheduleResponseDto,
  CourseSearchResponseDto,
  ProblemDto,
  type CourseDecisionSignalsResponseDtoType,
  type CourseGradeSummariesResponseDtoType,
  type CourseInsightResponseDtoType,
  type CourseScheduleResponseDtoType,
  type CourseSearchResponseDtoType,
} from '@course-data/course-contracts';
import { Value } from '@sinclair/typebox/value';
import { Effect, Schema as S } from 'effect';

export interface CourseClient {
  readonly search: (request: CourseSearchRequest) => Effect.Effect<CourseSearchResponse, Error>;
  readonly getGradeSummaries: (
    courseCodes: ReadonlyArray<string>,
  ) => Effect.Effect<CourseGradeSummariesResponse, Error>;
  readonly getDecisionSignals: (
    courseCodes: ReadonlyArray<string>,
    term?: string,
  ) => Effect.Effect<CourseDecisionSignalsResponse, Error>;
  readonly getSchedule: (
    courseCodes: ReadonlyArray<string>,
    term: string,
    week: number,
  ) => Effect.Effect<CourseScheduleResponse, Error>;
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
export type CourseScheduleResponse = CourseScheduleResponseDtoType;

const isCourseInsightResponse = (input: unknown): input is CourseInsightResponseDtoType =>
  Value.Check(CourseInsightResponseDto, input);

const isCourseSearchResponse = (input: unknown): input is CourseSearchResponse =>
  Value.Check(CourseSearchResponseDto, input);

const isCourseGradeSummariesResponse = (input: unknown): input is CourseGradeSummariesResponse =>
  Value.Check(CourseGradeSummariesResponseDto, input);

const isCourseDecisionSignalsResponse = (input: unknown): input is CourseDecisionSignalsResponse =>
  Value.Check(CourseDecisionSignalsResponseDto, input);

const isCourseScheduleResponse = (input: unknown): input is CourseScheduleResponse =>
  Value.Check(CourseScheduleResponseDto, input);

export const CourseInsightResponseSchema = S.declare(isCourseInsightResponse);
export const CourseSearchResponseSchema = S.declare(isCourseSearchResponse);
export const CourseGradeSummariesResponseSchema = S.declare(isCourseGradeSummariesResponse);
export const CourseDecisionSignalsResponseSchema = S.declare(isCourseDecisionSignalsResponse);
export const CourseScheduleResponseSchema = S.declare(isCourseScheduleResponse);

const parseCourseInsight = (input: unknown): CourseInsightResponseDtoType => {
  if (!isCourseInsightResponse(input)) {
    throw new Error('The course API returned an invalid CourseInsight response.');
  }
  return input;
};

export const parseCourseSearch = (input: unknown): CourseSearchResponse => {
  if (!isCourseSearchResponse(input)) {
    throw new Error('The course API returned an invalid CourseSearch response.');
  }
  return input;
};

export const parseCourseGradeSummaries = (input: unknown): CourseGradeSummariesResponse => {
  if (!isCourseGradeSummariesResponse(input)) {
    throw new Error('The course API returned an invalid CourseGradeSummaries response.');
  }
  return input;
};

export const parseCourseDecisionSignals = (input: unknown): CourseDecisionSignalsResponse => {
  if (!isCourseDecisionSignalsResponse(input)) {
    throw new Error('The course API returned an invalid CourseDecisionSignals response.');
  }
  return input;
};

export const parseCourseSchedule = (input: unknown): CourseScheduleResponse => {
  if (!isCourseScheduleResponse(input)) {
    throw new Error('The course API returned an invalid CourseSchedule response.');
  }
  return input;
};

const readProblem = async (response: Response, fallback: string): Promise<never> => {
  const problem: unknown = await response.json().catch(() => null);
  if (Value.Check(ProblemDto, problem)) {
    throw new Error(problem.detail);
  }
  throw new Error(fallback);
};

export const makeCourseClient = (apiBaseUrl?: string): CourseClient => ({
  search: (request) => {
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
  getSchedule: (courseCodes, term, week) => {
    if (apiBaseUrl === undefined || apiBaseUrl.length === 0) {
      return Effect.fail(
        new Error(
          'Course API URL is not configured. Set VITE_API_URL or explicitly enable the local fixture.',
        ),
      );
    }

    return Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/v1/course-schedules`, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ courseCodes, term, week }),
          signal,
        });
        if (!response.ok) {
          return readProblem(
            response,
            `Course schedule request failed with status ${response.status}.`,
          );
        }
        return parseCourseSchedule(await response.json());
      },
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error('The course schedule request failed unexpectedly.'),
    });
  },
  getInsight: (courseCode, term) => {
    const normalizedCode = courseCode.trim().toUpperCase();

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
