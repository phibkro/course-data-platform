import type { CourseInsight, CourseSearchItem, SourceStatus } from '@course-data/course-model';
import * as Data from 'effect/Data';
import type * as Effect from 'effect/Effect';

export interface CourseSearchInput {
  readonly query: string;
  readonly term?: string;
  readonly language?: 'en' | 'nb';
}

export interface CourseInsightInput {
  readonly courseCode: string;
  readonly term?: string;
  readonly language?: 'en' | 'nb';
}

export interface CourseSearchResult {
  readonly items: ReadonlyArray<CourseSearchItem>;
  readonly sourceStatuses: ReadonlyArray<SourceStatus>;
  readonly exactMatchCode: string | null;
}

export interface CourseInsightResult {
  readonly item: CourseInsight;
  readonly partial: boolean;
}

export class CourseNotFoundError extends Data.TaggedError('CourseNotFoundError')<{
  readonly courseCode: string;
}> {}

export class CourseSourcesUnavailableError extends Data.TaggedError(
  'CourseSourcesUnavailableError',
)<{
  readonly operation: 'search' | 'insight';
  readonly message: string;
}> {}

export type CourseSearchError = CourseSourcesUnavailableError;
export type CourseInsightError = CourseNotFoundError | CourseSourcesUnavailableError;

export interface CourseDecisionService {
  readonly search: (
    input: CourseSearchInput,
  ) => Effect.Effect<CourseSearchResult, CourseSearchError>;
  readonly getInsight: (
    input: CourseInsightInput,
  ) => Effect.Effect<CourseInsightResult, CourseInsightError>;
}
