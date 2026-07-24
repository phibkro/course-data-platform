import type {
  CourseDecisionSignals,
  CourseGradeSummary,
  CourseInsight,
  CourseSearchItem,
  SourceStatus,
} from '@course-data/course-model';
import * as Data from 'effect/Data';
import type * as Effect from 'effect/Effect';

export type CourseSearchSort = 'relevance' | 'title-asc' | 'title-desc' | 'code-asc' | 'code-desc';
export type CourseSearchCampus = 'trondheim' | 'gjovik' | 'alesund';
export type CourseSearchLevel = 'bachelor' | 'master' | 'phd' | 'other';

export interface CourseSearchInput {
  readonly query?: string;
  readonly term?: string;
  readonly page?: number;
  readonly sort?: CourseSearchSort;
  readonly campuses?: ReadonlyArray<CourseSearchCampus>;
  readonly levels?: ReadonlyArray<CourseSearchLevel>;
  readonly continuingEducation?: boolean;
  readonly open?: boolean;
  readonly english?: boolean;
}

export interface CourseInsightInput {
  readonly courseCode: string;
  readonly term?: string;
}

export interface CourseGradeSummariesInput {
  readonly courseCodes: ReadonlyArray<string>;
}

export interface CourseDecisionSignalsInput {
  readonly courseCodes: ReadonlyArray<string>;
  readonly term?: string;
}

export interface CourseSearchResult {
  readonly items: ReadonlyArray<CourseSearchItem>;
  readonly sourceStatuses: ReadonlyArray<SourceStatus>;
  readonly exactMatchCode: string | null;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

export interface CourseInsightResult {
  readonly item: CourseInsight;
  readonly partial: boolean;
}

export interface CourseGradeSummariesResult {
  readonly items: ReadonlyArray<CourseGradeSummary>;
  readonly sourceStatuses: ReadonlyArray<SourceStatus>;
  readonly fromYear: number;
  readonly toYear: number;
}

export interface CourseDecisionSignalsResult {
  readonly items: ReadonlyArray<CourseDecisionSignals>;
}

export class CourseNotFoundError extends Data.TaggedError('CourseNotFoundError')<{
  readonly courseCode: string;
}> {}

export class CourseSourcesUnavailableError extends Data.TaggedError(
  'CourseSourcesUnavailableError',
)<{
  readonly operation: 'search' | 'insight' | 'grade-summaries' | 'decision-signals';
  readonly message: string;
}> {}

export class CourseInvalidTermError extends Data.TaggedError('CourseInvalidTermError')<{
  readonly term: string;
  readonly message: string;
}> {}

export type CourseSearchError = CourseInvalidTermError | CourseSourcesUnavailableError;
export type CourseInsightError =
  | CourseNotFoundError
  | CourseInvalidTermError
  | CourseSourcesUnavailableError;

export interface CourseDecisionService {
  readonly search: (
    input: CourseSearchInput,
  ) => Effect.Effect<CourseSearchResult, CourseSearchError>;
  readonly getInsight: (
    input: CourseInsightInput,
  ) => Effect.Effect<CourseInsightResult, CourseInsightError>;
  readonly getGradeSummaries: (
    input: CourseGradeSummariesInput,
  ) => Effect.Effect<CourseGradeSummariesResult, CourseSourcesUnavailableError>;
  readonly getDecisionSignals: (
    input: CourseDecisionSignalsInput,
  ) => Effect.Effect<
    CourseDecisionSignalsResult,
    CourseInvalidTermError | CourseSourcesUnavailableError
  >;
}
