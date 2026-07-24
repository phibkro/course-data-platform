import type {
  CourseGradeSummaryDtoType,
  CourseInsightResponseDtoType,
  CourseSearchItemDtoType,
} from '@course-data/contracts';
import { Effect, Match as M, Schema as S } from 'effect';
import { Command, Navigation, Runtime, Url } from 'foldkit';
import type { ChildAttribute, Document, Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { ts } from 'foldkit/schema';
import { evo } from 'foldkit/struct';

import { Button, Checkbox, Dialog, Input, Select } from '@foldkit/ui';

import {
  CourseGradeSummariesResponseSchema,
  CourseInsightResponseSchema,
  CourseSearchResponseSchema,
  courseClient,
  type CourseGradeSummariesResponse,
  type CourseSearchRequest,
  type CourseSearchResponse,
  type CourseSearchSort,
} from './course-client';
import { courseInsightView } from './course-detail';
import { icon } from './icons';
import { desktopNavigation, mobileNavigation } from './navigation';

const DISPLAY_CHUNK = 40;
const DEFAULT_TERM = '2026-autumn';
const DEFAULT_SORT: CourseSearchSort = 'title-asc';

export const parseExternalHttpsUrl = (candidate: string | undefined): string | null => {
  if (candidate === undefined) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const sourceUrl = parseExternalHttpsUrl(import.meta.env.VITE_SOURCE_URL as string | undefined);
const tipUrl = parseExternalHttpsUrl(import.meta.env.VITE_TIP_URL as string | undefined);

type Campus = 'all' | 'trondheim' | 'gjovik' | 'alesund';
type Level = 'all' | 'bachelor' | 'master' | 'phd';
const CampusSchema = S.Literals(['all', 'trondheim', 'gjovik', 'alesund']);
const LevelSchema = S.Literals(['all', 'bachelor', 'master', 'phd']);
const SortSchema = S.Literals(['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc']);

export const CatalogueInitialLoading = ts('CatalogueInitialLoading');
export const CatalogueSuccess = ts('CatalogueSuccess', { response: CourseSearchResponseSchema });
export const CataloguePartial = ts('CataloguePartial', { response: CourseSearchResponseSchema });
export const CatalogueEmpty = ts('CatalogueEmpty');
export const CatalogueFailure = ts('CatalogueFailure', { error: S.String });

const CatalogueResult = S.Union([
  CatalogueInitialLoading,
  CatalogueSuccess,
  CataloguePartial,
  CatalogueEmpty,
  CatalogueFailure,
]);

type CatalogueResult =
  | ReturnType<typeof CatalogueInitialLoading>
  | { readonly _tag: 'CatalogueSuccess'; readonly response: CourseSearchResponse }
  | { readonly _tag: 'CataloguePartial'; readonly response: CourseSearchResponse }
  | ReturnType<typeof CatalogueEmpty>
  | ReturnType<typeof CatalogueFailure>;

export const GradeSignalsIdle = ts('GradeSignalsIdle');
export const GradeSignalsLoading = ts('GradeSignalsLoading', {
  previous: S.NullOr(CourseGradeSummariesResponseSchema),
  pendingCodes: S.Array(S.String),
});
export const GradeSignalsSuccess = ts('GradeSignalsSuccess', {
  response: CourseGradeSummariesResponseSchema,
});
export const GradeSignalsPartial = ts('GradeSignalsPartial', {
  response: CourseGradeSummariesResponseSchema,
});
export const GradeSignalsFailure = ts('GradeSignalsFailure', {
  previous: S.NullOr(CourseGradeSummariesResponseSchema),
  error: S.String,
});
const GradeSignalsResult = S.Union([
  GradeSignalsIdle,
  GradeSignalsLoading,
  GradeSignalsSuccess,
  GradeSignalsPartial,
  GradeSignalsFailure,
]);

type GradeSignalsResult =
  | ReturnType<typeof GradeSignalsIdle>
  | {
      readonly _tag: 'GradeSignalsLoading';
      readonly previous: CourseGradeSummariesResponse | null;
      readonly pendingCodes: ReadonlyArray<string>;
    }
  | { readonly _tag: 'GradeSignalsSuccess'; readonly response: CourseGradeSummariesResponse }
  | { readonly _tag: 'GradeSignalsPartial'; readonly response: CourseGradeSummariesResponse }
  | {
      readonly _tag: 'GradeSignalsFailure';
      readonly previous: CourseGradeSummariesResponse | null;
      readonly error: string;
    };

export const NextPageIdle = ts('NextPageIdle');
export const NextPageLoading = ts('NextPageLoading');
export const NextPageFailure = ts('NextPageFailure', { error: S.String });
const NextPageState = S.Union([NextPageIdle, NextPageLoading, NextPageFailure]);

export const DetailClosed = ts('DetailClosed');
export const DetailLoading = ts('DetailLoading');
export const DetailSuccess = ts('DetailSuccess', { response: CourseInsightResponseSchema });
export const DetailPartial = ts('DetailPartial', { response: CourseInsightResponseSchema });
export const DetailFailure = ts('DetailFailure', { error: S.String });
const DetailResult = S.Union([
  DetailClosed,
  DetailLoading,
  DetailSuccess,
  DetailPartial,
  DetailFailure,
]);

type DetailResult =
  | ReturnType<typeof DetailClosed>
  | ReturnType<typeof DetailLoading>
  | { readonly _tag: 'DetailSuccess'; readonly response: CourseInsightResponseDtoType }
  | { readonly _tag: 'DetailPartial'; readonly response: CourseInsightResponseDtoType }
  | ReturnType<typeof DetailFailure>;

export const Model = S.Struct({
  query: S.String,
  term: S.String,
  campus: CampusSchema,
  level: LevelSchema,
  sort: SortSchema,
  openOnly: S.Boolean,
  englishOnly: S.Boolean,
  activeRequestKey: S.String,
  visibleCount: S.Number,
  catalogue: CatalogueResult,
  gradeSignals: GradeSignalsResult,
  nextPage: NextPageState,
  selectedCode: S.NullOr(S.String),
  detail: DetailResult,
  refineDialog: Dialog.Model,
});

type SchemaModel = typeof Model.Type;
export type Model = Omit<SchemaModel, 'catalogue' | 'gradeSignals' | 'detail'> & {
  readonly catalogue: CatalogueResult;
  readonly gradeSignals: GradeSignalsResult;
  readonly detail: DetailResult;
};

export const UpdatedQuery = m('UpdatedQuery', { value: S.String });
export const SubmittedSearch = m('SubmittedSearch');
export const ChangedTerm = m('ChangedTerm', { value: S.String });
export const ChangedCampus = m('ChangedCampus', { value: S.String });
export const ChangedLevel = m('ChangedLevel', { value: S.String });
export const ChangedSort = m('ChangedSort', { value: S.String });
export const ToggledOpen = m('ToggledOpen', { isChecked: S.Boolean });
export const ToggledEnglish = m('ToggledEnglish', { isChecked: S.Boolean });
export const RequestedMoreCourses = m('RequestedMoreCourses');
export const RequestedUrl = m('RequestedUrl', { href: S.String, external: S.Boolean });
export const ChangedUrl = m('ChangedUrl', { href: S.String });
export const ClosedCourse = m('ClosedCourse');
export const SucceededCourseSearch = m('SucceededCourseSearch', {
  requestKey: S.String,
  append: S.Boolean,
  response: CourseSearchResponseSchema,
});
export const FailedCourseSearch = m('FailedCourseSearch', {
  requestKey: S.String,
  append: S.Boolean,
  error: S.String,
});
export const SucceededGradeSignals = m('SucceededGradeSignals', {
  requestKey: S.String,
  courseCodes: S.Array(S.String),
  response: CourseGradeSummariesResponseSchema,
});
export const FailedGradeSignals = m('FailedGradeSignals', {
  requestKey: S.String,
  courseCodes: S.Array(S.String),
  error: S.String,
});
export const SucceededCourseInsight = m('SucceededCourseInsight', {
  courseCode: S.String,
  response: CourseInsightResponseSchema,
});
export const FailedCourseInsight = m('FailedCourseInsight', {
  courseCode: S.String,
  error: S.String,
});
export const CompletedNavigation = m('CompletedNavigation');
export const FailedNavigation = m('FailedNavigation', { error: S.String });
export const GotRefineDialogMessage = m('GotRefineDialogMessage', {
  message: Dialog.Message,
});

export const Message = S.Union([
  UpdatedQuery,
  SubmittedSearch,
  ChangedTerm,
  ChangedCampus,
  ChangedLevel,
  ChangedSort,
  ToggledOpen,
  ToggledEnglish,
  RequestedMoreCourses,
  RequestedUrl,
  ChangedUrl,
  ClosedCourse,
  SucceededCourseSearch,
  FailedCourseSearch,
  SucceededGradeSignals,
  FailedGradeSignals,
  SucceededCourseInsight,
  FailedCourseInsight,
  CompletedNavigation,
  FailedNavigation,
  GotRefineDialogMessage,
]);
export type Message = typeof Message.Type;

const searchRequest = (model: Model, page: number): CourseSearchRequest => ({
  query: model.query,
  term: model.term,
  page,
  sort: model.sort,
  ...(model.campus === 'all' ? {} : { campus: model.campus }),
  ...(model.level === 'all' ? {} : { level: model.level }),
  continuingEducation: model.level === 'all',
  open: model.openOnly,
  english: model.englishOnly,
});

const requestKey = (request: CourseSearchRequest): string =>
  [
    request.query.trim(),
    request.term,
    request.sort,
    request.campus ?? 'all',
    request.level ?? 'all',
    request.continuingEducation,
    request.open,
    request.english,
  ].join('|');

export const FetchCourseSearch = Command.define(
  'FetchCourseSearch',
  {
    query: S.String,
    term: S.String,
    page: S.Number,
    sort: S.String,
    campus: S.NullOr(S.String),
    level: S.NullOr(S.String),
    continuingEducation: S.Boolean,
    open: S.Boolean,
    english: S.Boolean,
    requestKey: S.String,
    append: S.Boolean,
  },
  SucceededCourseSearch,
  FailedCourseSearch,
)((input) =>
  courseClient
    .search({
      query: input.query,
      term: input.term,
      page: input.page,
      sort: input.sort as CourseSearchSort,
      ...(input.campus === null ? {} : { campus: input.campus }),
      ...(input.level === null ? {} : { level: input.level }),
      continuingEducation: input.continuingEducation,
      open: input.open,
      english: input.english,
    })
    .pipe(
      Effect.map((response) =>
        SucceededCourseSearch({
          requestKey: input.requestKey,
          append: input.append,
          response,
        }),
      ),
      Effect.catch((error) =>
        Effect.succeed(
          FailedCourseSearch({
            requestKey: input.requestKey,
            append: input.append,
            error: error.message,
          }),
        ),
      ),
    ),
);

export const FetchCourseInsight = Command.define(
  'FetchCourseInsight',
  { courseCode: S.String, term: S.String },
  SucceededCourseInsight,
  FailedCourseInsight,
)(({ courseCode, term }) =>
  courseClient.getInsight(courseCode, term).pipe(
    Effect.map((response) => SucceededCourseInsight({ courseCode, response })),
    Effect.catch((error) =>
      Effect.succeed(FailedCourseInsight({ courseCode, error: error.message })),
    ),
  ),
);

export const FetchGradeSignals = Command.define(
  'FetchGradeSignals',
  { courseCodes: S.Array(S.String), requestKey: S.String },
  SucceededGradeSignals,
  FailedGradeSignals,
)(({ courseCodes, requestKey: key }) =>
  courseClient.getGradeSummaries(courseCodes).pipe(
    Effect.map((response) => SucceededGradeSignals({ requestKey: key, courseCodes, response })),
    Effect.catch((error) =>
      Effect.succeed(FailedGradeSignals({ requestKey: key, courseCodes, error: error.message })),
    ),
  ),
);

export const Navigate = Command.define(
  'Navigate',
  { href: S.String, mode: S.String },
  CompletedNavigation,
  FailedNavigation,
)(({ href, mode }) =>
  (mode === 'external'
    ? Navigation.load(href)
    : mode === 'replace'
      ? Navigation.replaceUrl(href)
      : Navigation.pushUrl(href)
  ).pipe(Effect.as(CompletedNavigation())),
);

const fetchCommand = (
  request: CourseSearchRequest,
  key: string,
  append: boolean,
): Command.Command<Message> =>
  FetchCourseSearch({
    ...request,
    campus: request.campus ?? null,
    level: request.level ?? null,
    requestKey: key,
    append,
  });

const catalogueResponse = (result: CatalogueResult): CourseSearchResponse | null =>
  result._tag === 'CatalogueSuccess' || result._tag === 'CataloguePartial' ? result.response : null;

const gradeSignalsResponse = (result: GradeSignalsResult): CourseGradeSummariesResponse | null => {
  switch (result._tag) {
    case 'GradeSignalsSuccess':
    case 'GradeSignalsPartial':
      return result.response;
    case 'GradeSignalsLoading':
    case 'GradeSignalsFailure':
      return result.previous;
    case 'GradeSignalsIdle':
      return null;
  }
};

const isPartial = (response: CourseSearchResponse): boolean =>
  response.sourceStatuses.some(
    (source) => source.status !== 'available' || source.warning !== null,
  );

const mergeResponses = (
  current: CourseSearchResponse | null,
  next: CourseSearchResponse,
): CourseSearchResponse => {
  if (current === null) return next;
  const byKey = new Map(current.items.map((item) => [item.courseKey, item]));
  for (const item of next.items) byKey.set(item.courseKey, item);
  return {
    ...next,
    items: [...byKey.values()],
    sourceStatuses: next.sourceStatuses,
    meta: { ...next.meta, count: byKey.size },
  };
};

const mergeGradeSignals = (
  current: CourseGradeSummariesResponse | null,
  next: CourseGradeSummariesResponse,
): CourseGradeSummariesResponse => {
  if (current === null) return next;
  const byCode = new Map(current.items.map((item) => [item.courseCode, item]));
  for (const item of next.items) byCode.set(item.courseCode, item);
  return {
    items: [...byCode.values()],
    sourceStatuses: next.sourceStatuses,
    meta: { ...next.meta, count: byCode.size },
  };
};

const isGradeSignalsPartial = (response: CourseGradeSummariesResponse): boolean =>
  response.sourceStatuses.some(
    (source) => source.status !== 'available' || source.warning !== null,
  );

const requestVisibleGradeSignals = (
  response: CourseSearchResponse,
  visibleCount: number,
  current: GradeSignalsResult,
  key: string,
  reset: boolean,
): readonly [GradeSignalsResult, ReadonlyArray<Command.Command<Message>>] => {
  const previous = reset ? null : gradeSignalsResponse(current);
  const pendingCodes = reset
    ? []
    : current._tag === 'GradeSignalsLoading'
      ? current.pendingCodes
      : [];
  const loadedCodes = new Set([
    ...(previous?.items.map((item) => item.courseCode) ?? []),
    ...pendingCodes,
  ]);
  const courseCodes = response.items
    .slice(0, visibleCount)
    .map((item) => item.code)
    .filter((courseCode) => !loadedCodes.has(courseCode));
  if (courseCodes.length === 0) {
    return [reset ? GradeSignalsIdle() : current, []];
  }
  return [
    GradeSignalsLoading({ previous, pendingCodes: [...pendingCodes, ...courseCodes] }),
    [FetchGradeSignals({ courseCodes, requestKey: key })],
  ];
};

const normalizedUrl = (model: Model, selectedCode: string | null): string => {
  const params = new URLSearchParams();
  if (model.query.trim().length > 0) params.set('q', model.query.trim());
  if (model.term !== DEFAULT_TERM) params.set('term', model.term);
  if (model.campus !== 'all') params.set('campus', model.campus);
  if (model.level !== 'all') params.set('level', model.level);
  if (model.sort !== DEFAULT_SORT) params.set('sort', model.sort);
  if (model.openOnly) params.set('open', '1');
  if (model.englishOnly) params.set('english', '1');
  if (selectedCode !== null) params.set('course', selectedCode);
  const query = params.toString();
  return query.length === 0 ? '/' : `/?${query}`;
};

const startCatalogue = (
  model: Model,
  patch: Partial<
    Pick<Model, 'query' | 'term' | 'campus' | 'level' | 'sort' | 'openOnly' | 'englishOnly'>
  >,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const next = { ...model, ...patch, selectedCode: null, detail: DetailClosed() };
  const request = searchRequest(next, 1);
  const key = requestKey(request);
  const nextModel: Model = {
    ...next,
    activeRequestKey: key,
    visibleCount: DISPLAY_CHUNK,
    catalogue: CatalogueInitialLoading(),
    gradeSignals: GradeSignalsIdle(),
    nextPage: NextPageIdle(),
  };
  return [
    nextModel,
    [
      Navigate({ href: normalizedUrl(nextModel, null), mode: 'replace' }),
      fetchCommand(request, key, false),
    ],
  ];
};

const oneOf = <A extends string>(value: string, values: ReadonlyArray<A>, fallback: A): A =>
  values.includes(value as A) ? (value as A) : fallback;

interface ParsedLocation {
  readonly query: string;
  readonly term: string;
  readonly campus: Campus;
  readonly level: Level;
  readonly sort: CourseSearchSort;
  readonly openOnly: boolean;
  readonly englishOnly: boolean;
  readonly selectedCode: string | null;
}

const parseLocation = (href: string): ParsedLocation => {
  const url = new URL(href, 'http://course-lens.local');
  return {
    query: url.searchParams.get('q') ?? '',
    term: url.searchParams.get('term') ?? DEFAULT_TERM,
    campus: oneOf(
      url.searchParams.get('campus') ?? 'all',
      ['all', 'trondheim', 'gjovik', 'alesund'] as const,
      'all',
    ),
    level: oneOf(
      url.searchParams.get('level') ?? 'all',
      ['all', 'bachelor', 'master', 'phd'] as const,
      'all',
    ),
    sort: oneOf(
      url.searchParams.get('sort') ?? DEFAULT_SORT,
      ['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc'] as const,
      DEFAULT_SORT,
    ),
    openOnly: url.searchParams.get('open') === '1',
    englishOnly: url.searchParams.get('english') === '1',
    selectedCode: url.searchParams.get('course')?.trim().toUpperCase() || null,
  };
};

const locationMatchesModel = (location: ParsedLocation, model: Model): boolean =>
  location.query === model.query &&
  location.term === model.term &&
  location.campus === model.campus &&
  location.level === model.level &&
  location.sort === model.sort &&
  location.openOnly === model.openOnly &&
  location.englishOnly === model.englishOnly;

export const update = (
  model: Model,
  message: Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] =>
  M.value(message).pipe(
    M.withReturnType<readonly [Model, ReadonlyArray<Command.Command<Message>>]>(),
    M.tagsExhaustive({
      UpdatedQuery: ({ value }) => [evo(model, { query: () => value }), []],
      SubmittedSearch: () =>
        startCatalogue(model, {
          query: model.query.trim(),
          sort: model.query.trim().length === 0 ? DEFAULT_SORT : 'relevance',
        }),
      ChangedTerm: ({ value }) => startCatalogue(model, { term: value }),
      ChangedCampus: ({ value }) =>
        startCatalogue(model, {
          campus: oneOf(value, ['all', 'trondheim', 'gjovik', 'alesund'], 'all'),
        }),
      ChangedLevel: ({ value }) =>
        startCatalogue(model, {
          level: oneOf(value, ['all', 'bachelor', 'master', 'phd'], 'all'),
        }),
      ChangedSort: ({ value }) =>
        startCatalogue(model, {
          sort: oneOf(
            value,
            ['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc'],
            'relevance',
          ),
        }),
      ToggledOpen: ({ isChecked }) => startCatalogue(model, { openOnly: isChecked }),
      ToggledEnglish: ({ isChecked }) => startCatalogue(model, { englishOnly: isChecked }),
      RequestedMoreCourses: () => {
        const response = catalogueResponse(model.catalogue);
        if (response === null || model.nextPage._tag === 'NextPageLoading') return [model, []];
        if (model.visibleCount < response.items.length) {
          const visibleCount = Math.min(response.items.length, model.visibleCount + DISPLAY_CHUNK);
          const [gradeSignals, gradeCommands] = requestVisibleGradeSignals(
            response,
            visibleCount,
            model.gradeSignals,
            model.activeRequestKey,
            false,
          );
          return [
            {
              ...model,
              visibleCount,
              gradeSignals,
              nextPage: NextPageIdle(),
            },
            gradeCommands,
          ];
        }
        if (!response.meta.hasMore) return [model, []];
        const request = searchRequest(model, response.meta.page + 1);
        return [
          evo(model, { nextPage: () => NextPageLoading() }),
          [fetchCommand(request, model.activeRequestKey, true)],
        ];
      },
      RequestedUrl: ({ href, external }) => [
        model,
        [Navigate({ href, mode: external ? 'external' : 'push' })],
      ],
      ChangedUrl: ({ href }) => {
        const location = parseLocation(href);
        if (!locationMatchesModel(location, model)) {
          const next: Model = {
            ...model,
            ...location,
            selectedCode: location.selectedCode,
            detail: location.selectedCode === null ? DetailClosed() : DetailLoading(),
            catalogue: CatalogueInitialLoading(),
            gradeSignals: GradeSignalsIdle(),
            nextPage: NextPageIdle(),
            visibleCount: DISPLAY_CHUNK,
          };
          const request = searchRequest(next, 1);
          const key = requestKey(request);
          return [
            { ...next, activeRequestKey: key },
            [
              fetchCommand(request, key, false),
              ...(location.selectedCode === null
                ? []
                : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
            ],
          ];
        }
        if (location.selectedCode === model.selectedCode) return [model, []];
        return location.selectedCode === null
          ? [{ ...model, selectedCode: null, detail: DetailClosed() }, []]
          : [
              {
                ...model,
                selectedCode: location.selectedCode,
                detail: DetailLoading(),
              },
              [FetchCourseInsight({ courseCode: location.selectedCode, term: model.term })],
            ];
      },
      ClosedCourse: () => [
        model,
        [Navigate({ href: normalizedUrl(model, null), mode: 'replace' })],
      ],
      SucceededCourseSearch: ({ requestKey: key, append, response: nextResponse }) => {
        if (key !== model.activeRequestKey) return [model, []];
        const response = mergeResponses(
          append ? catalogueResponse(model.catalogue) : null,
          nextResponse,
        );
        const result: CatalogueResult =
          response.items.length === 0
            ? CatalogueEmpty()
            : isPartial(response)
              ? { _tag: 'CataloguePartial', response }
              : { _tag: 'CatalogueSuccess', response };
        const visibleCount = append
          ? Math.min(response.items.length, model.visibleCount + DISPLAY_CHUNK)
          : Math.min(DISPLAY_CHUNK, response.items.length);
        const [gradeSignals, gradeCommands] = requestVisibleGradeSignals(
          response,
          visibleCount,
          model.gradeSignals,
          key,
          !append,
        );
        return [
          {
            ...model,
            catalogue: result,
            gradeSignals,
            visibleCount,
            nextPage: NextPageIdle(),
          },
          gradeCommands,
        ];
      },
      FailedCourseSearch: ({ requestKey: key, append, error }) => {
        if (key !== model.activeRequestKey) return [model, []];
        return append
          ? [{ ...model, nextPage: NextPageFailure({ error }) }, []]
          : [{ ...model, catalogue: CatalogueFailure({ error }) }, []];
      },
      SucceededGradeSignals: ({ requestKey: key, courseCodes, response: nextResponse }) => {
        if (key !== model.activeRequestKey) return [model, []];
        const response = mergeGradeSignals(gradeSignalsResponse(model.gradeSignals), nextResponse);
        const completedCodes = new Set(courseCodes);
        const pendingCodes =
          model.gradeSignals._tag === 'GradeSignalsLoading'
            ? model.gradeSignals.pendingCodes.filter((code) => !completedCodes.has(code))
            : [];
        return [
          {
            ...model,
            gradeSignals:
              pendingCodes.length > 0
                ? GradeSignalsLoading({ previous: response, pendingCodes })
                : isGradeSignalsPartial(response)
                  ? GradeSignalsPartial({ response })
                  : GradeSignalsSuccess({ response }),
          },
          [],
        ];
      },
      FailedGradeSignals: ({ requestKey: key, error }) =>
        key !== model.activeRequestKey
          ? [model, []]
          : [
              {
                ...model,
                gradeSignals: GradeSignalsFailure({
                  previous: gradeSignalsResponse(model.gradeSignals),
                  error,
                }),
              },
              [],
            ],
      SucceededCourseInsight: ({ courseCode, response }) => {
        if (courseCode !== model.selectedCode) return [model, []];
        return [
          {
            ...model,
            detail: response.meta.partial
              ? { _tag: 'DetailPartial', response }
              : { _tag: 'DetailSuccess', response },
          },
          [],
        ];
      },
      FailedCourseInsight: ({ courseCode, error }) =>
        courseCode === model.selectedCode
          ? [{ ...model, detail: DetailFailure({ error }) }, []]
          : [model, []],
      CompletedNavigation: () => [model, []],
      FailedNavigation: () => [model, []],
      GotRefineDialogMessage: ({ message: dialogMessage }) => {
        const [refineDialog, commands] = Dialog.update(model.refineDialog, dialogMessage);
        return [
          { ...model, refineDialog },
          Command.mapMessages(commands, (message) => GotRefineDialogMessage({ message })),
        ];
      },
    }),
  );

export const initForHref = (
  href: string,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const location = parseLocation(href);
  const base: Model = {
    query: location.query,
    term: location.term,
    campus: location.campus,
    level: location.level,
    sort: location.sort,
    openOnly: location.openOnly,
    englishOnly: location.englishOnly,
    activeRequestKey: '',
    visibleCount: DISPLAY_CHUNK,
    catalogue: CatalogueInitialLoading(),
    gradeSignals: GradeSignalsIdle(),
    nextPage: NextPageIdle(),
    selectedCode: location.selectedCode,
    detail: location.selectedCode === null ? DetailClosed() : DetailLoading(),
    refineDialog: Dialog.init({
      id: 'catalogue-refine',
      isAnimated: true,
      focusSelector: '#refine-course-query',
    }),
  };
  const request = searchRequest(base, 1);
  const key = requestKey(request);
  const model = { ...base, activeRequestKey: key };
  return [
    model,
    [
      fetchCommand(request, key, false),
      ...(location.selectedCode === null
        ? []
        : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
    ],
  ];
};

export const init: Runtime.ApplicationInit<Model, Message> = () =>
  initForHref(typeof window === 'undefined' ? 'http://course-lens.local/' : window.location.href);

export const routingInit: Runtime.RoutingApplicationInit<Model, Message> = (url) =>
  initForHref(Url.toString(url));

export const view = (model: Model): Document => ({
  title:
    model.detail._tag === 'DetailSuccess' || model.detail._tag === 'DetailPartial'
      ? `${model.detail.response.item.code} · Course lens`
      : 'Browse NTNU courses · Course lens',
  body: appView(model),
});

const eyebrowClass = 'mb-2 text-primary text-[0.78rem] font-[800] tracking-[0.1em] uppercase';

const fieldLabelClass =
  'block mt-0 mr-0 mb-[0.4rem] ml-1 text-on-surface-variant text-[0.85rem] font-[650]';

const mainContentClass =
  'w-[min(100%,76rem)] mx-auto pt-4 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-16.5rem),76rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:pt-4 [@media(min-width:48rem)_and_(min-height:34rem)]:px-6 [@media(min-width:48rem)_and_(min-height:34rem)]:pb-20 [@media(min-width:48rem)_and_(min-height:34rem)]:ml-66 [@media(min-width:64rem)]:px-10';

const buttonBase =
  'cursor-pointer [transition:box-shadow_140ms_ease,transform_140ms_ease] focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-[3px] data-[disabled]:cursor-wait data-[disabled]:opacity-[0.65] [@media(max-width:37rem)]:w-full';

const buttonPrimary = `${buttonBase} min-h-14 px-5 border-0 rounded-[1.75rem] font-[720] bg-primary text-on-primary shadow-m3-1 not-data-[disabled]:hover:shadow-m3-2 not-data-[disabled]:hover:-translate-y-px`;

const buttonSecondary = `${buttonBase} min-h-12 px-[1.15rem] border border-outline rounded-[1.5rem] bg-surface-container text-primary font-[700]`;

const backButtonClass =
  'min-h-12 px-[1.15rem] border border-outline rounded-[1.5rem] bg-surface-container text-primary font-[700] cursor-pointer justify-self-start';

const stateCardBase =
  'grid min-h-68 place-items-center content-center p-[clamp(2rem,6vw,4rem)] border border-outline-variant rounded-m3-extra-large bg-surface-container-low text-center';

const stateCardFailure = `${stateCardBase} border-error bg-error-container text-on-error-container`;

const stateCardH2Class = 'mt-3 mb-2 text-[clamp(1.4rem,3vw,2rem)]';

const stateCardPClass = 'max-w-144 mx-auto my-1 text-on-surface-variant leading-[1.6]';

const stateCardFailurePClass = 'max-w-144 mx-auto my-1 leading-[1.6] text-inherit';

const statusLabelErrorClass =
  'mb-2 text-[0.78rem] font-[800] tracking-[0.1em] uppercase text-error';

const loadingIndicatorClass =
  'size-12 border-[0.3rem] border-primary-container border-t-primary rounded-full animate-[spin_850ms_linear_infinite] motion-reduce:[animation-duration:1.8s]';

const appView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('min-h-screen')],
    [
      desktopNavigation<Message>(),
      h.main(
        [h.Class(mainContentClass)],
        [model.selectedCode === null ? catalogueView(model) : selectedCourseView(model)],
      ),
      catalogueRefineDialog(model),
      mobileNavigation<Message>(),
    ],
  );
};

const catalogueView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('grid gap-6')],
    [
      h.header(
        [h.Class('pt-[clamp(2rem,5vw,3.5rem)] pb-2')],
        [
          h.p([h.Class(eyebrowClass)], ['NTNU course catalogue']),
          h.h1(
            [
              h.Class(
                'max-w-[22ch] text-[clamp(2.1rem,6vw,4rem)] font-[720] tracking-[-0.05em] leading-none',
              ),
            ],
            ['Browse courses before you choose.'],
          ),
          h.p(
            [h.Class('max-w-192 mt-4 text-on-surface-variant text-[1.05rem] leading-[1.6]')],
            [
              'Scan official NTNU offerings, narrow the catalogue, then open a course for assessment, work-form, and grade evidence.',
            ],
          ),
        ],
      ),
      catalogueControls(model),
      catalogueRefineAction(model),
      catalogueResultView(model),
      productFooter(),
    ],
  );
};

interface CatalogueControlsOptions {
  readonly className?: string;
  readonly idPrefix?: string;
  readonly initialFocus?: ReadonlyArray<ChildAttribute>;
}

const catalogueControlsFrameClass =
  'grid gap-4 p-[clamp(1rem,3vw,1.5rem)] border border-outline-variant rounded-m3-extra-large bg-surface-container-low shadow-m3-1';

const catalogueControlsSearchClass =
  'flex items-end gap-3 [@media(max-width:37rem)]:items-stretch [@media(max-width:37rem)]:flex-col';

const catalogueControls = (model: Model, options: CatalogueControlsOptions = {}): Html => {
  const h = html<Message>();
  const loading = model.catalogue._tag === 'CatalogueInitialLoading';
  const idPrefix = options.idPrefix ?? '';
  const isDialog = options.className === 'catalogue-controls--dialog';
  return h.form(
    [
      h.Class(isDialog ? 'grid gap-4' : catalogueControlsFrameClass),
      h.Role('search'),
      h.OnSubmit(SubmittedSearch()),
      h.AriaLabel('Find and filter NTNU courses'),
    ],
    [
      h.div(
        [h.Class(catalogueControlsSearchClass)],
        [
          Input.view<Message>({
            id: `${idPrefix}course-query`,
            value: model.query,
            placeholder: 'Course code or title',
            onInput: (value) => UpdatedQuery({ value }),
            toView: (attributes) =>
              h.div(
                [h.Class('flex-1')],
                [
                  h.label([...attributes.label, h.Class(fieldLabelClass)], ['Search courses']),
                  h.input([
                    ...attributes.input,
                    ...(options.initialFocus ?? []),
                    h.Class(
                      'w-full min-h-14 px-4 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-[1.05rem] normal-case [transition:border-color_140ms_ease,box-shadow_140ms_ease] focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)] disabled:opacity-70',
                    ),
                    h.Autocomplete('off'),
                  ]),
                ],
              ),
          }),
          Button.view<Message>({
            type: 'submit',
            isDisabled: loading,
            toView: (attributes) =>
              h.button(
                [...attributes.button, h.Class(buttonPrimary)],
                [loading ? 'Searching…' : 'Search'],
              ),
          }),
        ],
      ),
      h.div(
        [h.Class('grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]')],
        [
          selectControl(`${idPrefix}term`, 'Term', model.term, ChangedTerm, [
            ['2026-autumn', 'Autumn 2026 · 2026/27'],
            ['2026-spring', 'Spring 2027 · 2026/27'],
            ['2027-autumn', 'Autumn 2027 · 2027/28'],
            ['2027-spring', 'Spring 2028 · 2027/28'],
          ]),
          selectControl(`${idPrefix}campus`, 'Campus', model.campus, ChangedCampus, [
            ['all', 'All campuses'],
            ['trondheim', 'Trondheim'],
            ['gjovik', 'Gjøvik'],
            ['alesund', 'Ålesund'],
          ]),
          selectControl(`${idPrefix}level`, 'Study level', model.level, ChangedLevel, [
            ['all', 'All levels'],
            ['bachelor', 'Bachelor'],
            ['master', 'Master'],
            ['phd', 'PhD'],
          ]),
          selectControl(`${idPrefix}sort`, 'Sort', model.sort, ChangedSort, [
            ['relevance', 'NTNU relevance'],
            ['title-asc', 'Title A–Z'],
            ['title-desc', 'Title Z–A'],
            ['code-asc', 'Code A–Z'],
            ['code-desc', 'Code Z–A'],
          ]),
        ],
      ),
      h.div(
        [h.Class('flex flex-wrap gap-3')],
        [
          checkboxControl(
            `${idPrefix}open-admission`,
            'Open admission',
            model.openOnly,
            (isChecked) => ToggledOpen({ isChecked }),
          ),
          checkboxControl(
            `${idPrefix}english`,
            'Taught in English',
            model.englishOnly,
            (isChecked) => ToggledEnglish({ isChecked }),
          ),
        ],
      ),
    ],
  );
};

const activeRefinementCount = (model: Model): number =>
  [
    model.query.trim().length > 0,
    model.term !== DEFAULT_TERM,
    model.campus !== 'all',
    model.level !== 'all',
    model.sort !== DEFAULT_SORT,
    model.openOnly,
    model.englishOnly,
  ].filter(Boolean).length;

const catalogueRefineActionClass =
  'fixed z-11 right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(6rem+env(safe-area-inset-bottom))] [@media(min-width:48rem)_and_(min-height:34rem)]:sticky [@media(min-width:48rem)_and_(min-height:34rem)]:z-5 [@media(min-width:48rem)_and_(min-height:34rem)]:top-4 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:flex [@media(min-width:48rem)_and_(min-height:34rem)]:min-h-17 [@media(min-width:48rem)_and_(min-height:34rem)]:items-center [@media(min-width:48rem)_and_(min-height:34rem)]:justify-between [@media(min-width:48rem)_and_(min-height:34rem)]:gap-4 [@media(min-width:48rem)_and_(min-height:34rem)]:py-[0.65rem] [@media(min-width:48rem)_and_(min-height:34rem)]:pr-3 [@media(min-width:48rem)_and_(min-height:34rem)]:pl-4 [@media(min-width:48rem)_and_(min-height:34rem)]:border [@media(min-width:48rem)_and_(min-height:34rem)]:border-outline-variant [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-[1.5rem] [@media(min-width:48rem)_and_(min-height:34rem)]:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container)_92%,transparent)] [@media(min-width:48rem)_and_(min-height:34rem)]:shadow-m3-1 [@media(min-width:48rem)_and_(min-height:34rem)]:backdrop-blur-[1rem]';

const catalogueRefineActionSummaryClass =
  'hidden [@media(min-width:48rem)_and_(min-height:34rem)]:grid [@media(min-width:48rem)_and_(min-height:34rem)]:min-w-0 [@media(min-width:48rem)_and_(min-height:34rem)]:gap-[0.15rem]';

const catalogueRefineActionButtonClass = `${buttonBase} inline-flex min-h-12 items-center gap-[0.55rem] py-3 px-4 border border-outline-variant rounded-[1.5rem] bg-primary-container shadow-m3-2 text-on-primary-container font-[750] [@media(min-width:48rem)_and_(min-height:34rem)]:flex-none [@media(min-width:48rem)_and_(min-height:34rem)]:shadow-none`;

const catalogueRefineAction = (model: Model): Html => {
  const h = html<Message>();
  const count = activeRefinementCount(model);
  return h.div(
    [h.Class(catalogueRefineActionClass)],
    [
      h.div(
        [h.Class(catalogueRefineActionSummaryClass)],
        [
          h.span(
            [h.Class('[@media(min-width:48rem)_and_(min-height:34rem)]:font-[750]')],
            [
              count === 0
                ? 'All NTNU courses'
                : `${count} active refinement${count === 1 ? '' : 's'}`,
            ],
          ),
          h.span(
            [
              h.Class(
                '[@media(min-width:48rem)_and_(min-height:34rem)]:overflow-hidden [@media(min-width:48rem)_and_(min-height:34rem)]:text-on-surface-variant [@media(min-width:48rem)_and_(min-height:34rem)]:text-[0.8rem] [@media(min-width:48rem)_and_(min-height:34rem)]:text-ellipsis [@media(min-width:48rem)_and_(min-height:34rem)]:whitespace-nowrap',
              ),
            ],
            ['Change search, filters, or sorting from anywhere in the list.'],
          ),
        ],
      ),
      h.button(
        [
          h.Class(catalogueRefineActionButtonClass),
          h.Type('button'),
          h.OnClick(GotRefineDialogMessage({ message: Dialog.RequestedOpen() })),
          h.AriaHasPopup('dialog'),
          h.AriaControls('catalogue-refine'),
        ],
        [
          icon<Message>('refine', 'block size-5 [&_svg]:block [&_svg]:w-full [&_svg]:h-full'),
          h.span([], [count === 0 ? 'Refine' : `Refine · ${count}`]),
        ],
      ),
    ],
  );
};

const refineDialogPanelClass =
  'fixed right-0 bottom-0 left-0 grid max-h-[min(92svh,52rem)] gap-5 pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] overflow-y-auto border border-outline-variant rounded-t-m3-extra-large bg-surface shadow-m3-2 [transform:translateY(0)] [transition:transform_180ms_ease] data-closed:[transform:translateY(100%)] [@media(min-width:48rem)_and_(min-height:34rem)]:top-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:left-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-3rem),44rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:p-6 [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-m3-extra-large [@media(min-width:48rem)_and_(min-height:34rem)]:[transform:translate(-50%,-50%)] [@media(min-width:48rem)_and_(min-height:34rem)]:[transition:opacity_160ms_ease,transform_180ms_ease] [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:opacity-0 [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:[transform:translate(-50%,-47%)_scale(0.98)]';

const catalogueRefineDialog = (model: Model): Html => {
  const h = html<Message>();
  return h.submodel({
    slotId: 'catalogue-refine-dialog',
    model: model.refineDialog,
    view: Dialog.view,
    viewInputs: {
      toView: ({
        dialog,
        backdrop,
        panel,
        title,
        description,
        initialFocus,
        closeButton,
        isVisible,
      }) =>
        h.dialog(
          [...dialog, h.Class('text-on-surface')],
          isVisible
            ? [
                h.div(
                  [
                    ...backdrop,
                    h.Class(
                      'fixed inset-0 bg-[color-mix(in_srgb,var(--md-sys-color-on-surface)_42%,transparent)] opacity-100 [transition:opacity_180ms_ease] data-closed:opacity-0',
                    ),
                  ],
                  [],
                ),
                h.section(
                  [...panel, h.Class(refineDialogPanelClass)],
                  [
                    h.header(
                      [h.Class('flex items-start justify-between gap-4')],
                      [
                        h.div(
                          [],
                          [
                            h.p([h.Class(eyebrowClass)], ['Explore']),
                            h.h2(
                              [
                                ...title,
                                h.Class('text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]'),
                              ],
                              ['Refine courses'],
                            ),
                            h.p(
                              [
                                ...description,
                                h.Class('mt-[0.4rem] text-on-surface-variant leading-[1.5]'),
                              ],
                              ['Changes apply immediately and stay in the shareable URL.'],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            ...closeButton,
                            h.Class(
                              'grid size-11 flex-none p-[0.7rem] place-items-center border-0 rounded-full bg-surface-container text-on-surface cursor-pointer',
                            ),
                            h.Type('button'),
                            h.AriaLabel('Close course refinements'),
                          ],
                          [icon<Message>('close')],
                        ),
                      ],
                    ),
                    catalogueControls(model, {
                      className: 'catalogue-controls--dialog',
                      idPrefix: 'refine-',
                      initialFocus,
                    }),
                    h.footer(
                      [h.Class('flex justify-end')],
                      [
                        h.button(
                          [
                            ...closeButton,
                            h.Class(`${buttonPrimary} min-w-[min(100%,12rem)]`),
                            h.Type('button'),
                          ],
                          ['View results'],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => GotRefineDialogMessage({ message }),
  });
};

const selectControl = (
  id: string,
  label: string,
  value: string,
  message: (input: { readonly value: string }) => Message,
  options: ReadonlyArray<readonly [string, string]>,
): Html => {
  const h = html<Message>();
  return Select.view<Message>({
    id,
    value,
    onChange: (next) => message({ value: next }),
    toView: (attributes) =>
      h.div(
        [],
        [
          h.label([...attributes.label, h.Class(fieldLabelClass)], [label]),
          h.select(
            [
              ...attributes.select,
              h.Class(
                'w-full min-h-12 pr-10 pl-[0.85rem] border border-outline rounded-m3-medium outline-0 bg-surface text-on-surface [font:inherit] focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)]',
              ),
            ],
            options.map(([optionValue, text]) =>
              h.option([h.Value(optionValue), h.Selected(optionValue === value)], [text]),
            ),
          ),
        ],
      ),
  });
};

const checkboxControl = (
  id: string,
  label: string,
  isChecked: boolean,
  onToggle: (isChecked: boolean) => Message,
): Html => {
  const h = html<Message>();
  return Checkbox.view<Message>({
    id,
    isChecked,
    onToggle,
    toView: (attributes) =>
      h.label(
        [
          ...attributes.label,
          h.Class(
            'inline-flex items-center gap-[0.55rem] min-h-11 py-[0.45rem] px-[0.85rem] border border-outline rounded-[1.5rem] text-on-surface-variant cursor-pointer has-[[data-checked]]:border-secondary-container has-[[data-checked]]:bg-secondary-container has-[[data-checked]]:text-on-secondary-container',
          ),
        ],
        [
          h.span(
            [
              ...attributes.checkbox,
              h.Class(
                'grid w-[1.2rem] h-[1.2rem] place-items-center border-2 border-current rounded-[0.3rem] text-[0.75rem] leading-none',
              ),
            ],
            [isChecked ? '✓' : ''],
          ),
          h.span([], [label]),
        ],
      ),
  });
};

const catalogueResultView = (model: Model): Html => {
  const h = html<Message>();
  switch (model.catalogue._tag) {
    case 'CatalogueInitialLoading':
      return h.section(
        [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
          h.h2([h.Class(stateCardH2Class)], ['Loading the NTNU catalogue']),
          h.p(
            [h.Class(stateCardPClass)],
            ['Official course summaries appear before deeper evidence is loaded.'],
          ),
        ],
      );
    case 'CatalogueFailure':
      return h.section(
        [h.Class(stateCardFailure), h.Role('alert')],
        [
          h.p([h.Class(statusLabelErrorClass)], ['Catalogue unavailable']),
          h.h2([h.Class(stateCardH2Class)], ['We could not load courses']),
          h.p([h.Class(stateCardFailurePClass)], [model.catalogue.error]),
          h.p(
            [h.Class(stateCardFailurePClass)],
            ['Your filters are preserved. Submit the search to try again.'],
          ),
        ],
      );
    case 'CatalogueEmpty':
      return h.section(
        [h.Class(stateCardBase), h.Role('status')],
        [
          h.h2([h.Class(stateCardH2Class)], ['No courses match these filters']),
          h.p([h.Class(stateCardPClass)], ['Try another phrase, campus, term, or study level.']),
        ],
      );
    case 'CataloguePartial':
      return catalogueList(model, model.catalogue.response, true);
    case 'CatalogueSuccess':
      return catalogueList(model, model.catalogue.response, false);
  }
};

const catalogueList = (model: Model, response: CourseSearchResponse, partial: boolean): Html => {
  const h = html<Message>();
  const shown = response.items.slice(0, model.visibleCount);
  const canRevealLocal = model.visibleCount < response.items.length;
  const canFetch = response.meta.hasMore;
  return h.section(
    [
      h.Class('grid gap-4'),
      h.AriaLabel('Course results'),
      h.AriaBusy(model.nextPage._tag === 'NextPageLoading'),
    ],
    [
      partial
        ? h.div(
            [
              h.Class('py-4 px-5 rounded-m3-medium bg-warning-container text-on-warning-container'),
              h.Role('status'),
            ],
            [
              'Some catalogue data could not be used. Official results that were validated remain visible.',
            ],
          )
        : h.empty,
      h.header(
        [
          h.Class(
            'flex items-end justify-between gap-4 py-2 px-1 border-b border-outline-variant [@media(max-width:37rem)]:items-start [@media(max-width:37rem)]:flex-col',
          ),
        ],
        [
          h.div(
            [],
            [
              h.h2([], ['Courses']),
              h.p(
                [h.AriaLive('polite'), h.Class('text-on-surface-variant text-[0.88rem]')],
                [`Showing ${shown.length} of ${response.meta.total} courses`],
              ),
            ],
          ),
          h.p([h.Class('text-on-surface-variant text-[0.88rem]')], ['Official NTNU catalogue']),
        ],
      ),
      h.ol(
        [h.Class('grid gap-3 p-0 list-none')],
        shown.map((course) => courseCard(model, course)),
      ),
      model.nextPage._tag === 'NextPageFailure'
        ? h.div(
            [
              h.Class(
                'py-[0.9rem] px-4 border border-error rounded-m3-medium bg-error-container text-on-error-container',
              ),
              h.Role('alert'),
            ],
            [
              h.strong([], ['More courses could not be loaded.']),
              h.span([], [` ${model.nextPage.error}`]),
            ],
          )
        : h.empty,
      canRevealLocal || canFetch
        ? Button.view<Message>({
            type: 'button',
            isDisabled: model.nextPage._tag === 'NextPageLoading',
            onClick: RequestedMoreCourses(),
            toView: (attributes) =>
              h.button(
                [
                  ...attributes.button,
                  h.Class(`${buttonSecondary} justify-self-center min-w-[min(100%,18rem)]`),
                ],
                [
                  model.nextPage._tag === 'NextPageLoading'
                    ? 'Loading more courses…'
                    : 'Show more courses',
                ],
              ),
          })
        : h.p([h.Class('m-0 text-on-surface-variant text-center')], ['End of results']),
    ],
  );
};

const courseCardClass =
  'relative grid gap-4 p-[1.1rem] border border-outline-variant rounded-m3-large bg-surface-container-low [transition:border-color_140ms_ease,box-shadow_140ms_ease] has-[a:hover]:border-primary has-[a:hover]:shadow-m3-1 has-[a:focus-visible]:border-primary has-[a:focus-visible]:shadow-m3-1 [@media(min-width:64rem)]:items-center [@media(min-width:64rem)]:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]';

const factDtClass = 'text-on-surface-variant text-[0.75rem] font-[700] tracking-[0.05em] uppercase';

const factDdClass = 'mt-[0.2rem] text-[0.9rem] leading-[1.35] [overflow-wrap:anywhere]';

const courseCard = (model: Model, course: CourseSearchItemDtoType): Html => {
  const h = html<Message>();
  const title = course.title.state === 'known' ? course.title.value : 'Title unavailable';
  const offering =
    course.offerings.state === 'known' && course.offerings.value.length > 0
      ? (course.offerings.value[0] ?? null)
      : null;
  const place =
    offering === null || offering.campuses.length === 0
      ? 'Campus not reported'
      : offering.campuses.join(', ');
  const term =
    offering === null
      ? 'Term unavailable'
      : formatOfferingPeriod(offering.academicYear, offering.season);
  const gradeSignal = gradeSignalFor(model.gradeSignals, course.code);
  return h.li(
    [],
    [
      h.article(
        [h.Class(courseCardClass)],
        [
          h.div(
            [],
            [
              h.p(
                [
                  h.Class(
                    'mb-[0.3rem] text-primary text-[0.78rem] font-[800] tracking-[0.1em] uppercase',
                  ),
                ],
                [course.code],
              ),
              h.h3(
                [h.Class('text-[1.1rem] leading-[1.35]')],
                [
                  h.a(
                    [
                      h.Href(normalizedUrl(model, course.code)),
                      h.AriaLabel(`Open ${course.code}: ${title}`),
                      h.Class(
                        "text-on-surface no-underline after:absolute after:inset-0 after:content-['']",
                      ),
                    ],
                    [title],
                  ),
                ],
              ),
            ],
          ),
          h.dl(
            [
              h.Class(
                'grid gap-3 grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] [@media(max-width:37rem)]:grid-cols-1',
              ),
            ],
            [
              h.div(
                [h.Class('min-w-0')],
                [h.dt([h.Class(factDtClass)], ['Term']), h.dd([h.Class(factDdClass)], [term])],
              ),
              h.div(
                [h.Class('min-w-0')],
                [h.dt([h.Class(factDtClass)], ['Campus']), h.dd([h.Class(factDdClass)], [place])],
              ),
              h.div(
                [h.Class('min-w-0')],
                [
                  h.dt([h.Class(factDtClass)], ['Historical outcomes']),
                  h.dd([h.Class(factDdClass)], [gradeSignal]),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

const gradeSignalFor = (state: GradeSignalsResult, courseCode: string): string => {
  const summary = gradeSignalsResponse(state)?.items.find((item) => item.courseCode === courseCode);
  if (summary !== undefined) return formatGradeSignal(summary);
  switch (state._tag) {
    case 'GradeSignalsLoading':
      return 'Checking HK-dir…';
    case 'GradeSignalsFailure':
      return 'Grade check unavailable';
    case 'GradeSignalsIdle':
      return 'Waiting to check';
    case 'GradeSignalsSuccess':
    case 'GradeSignalsPartial':
      return 'No grade summary';
  }
};

const formatGradeSignal = (summary: CourseGradeSummaryDtoType): string => {
  if (
    summary.sampleSize.state !== 'known' ||
    summary.failureRatePercent.state !== 'known' ||
    summary.gradingScale.state !== 'known'
  ) {
    return 'No published outcomes';
  }
  const scale = M.value(summary.gradingScale.value).pipe(
    M.when('letter', () => 'Letter grades'),
    M.when('pass-fail', () => 'Pass/fail'),
    M.when('mixed', () => 'Mixed scales'),
    M.exhaustive,
  );
  const period =
    summary.period.state === 'known'
      ? ` · ${summary.period.value.fromYear}–${summary.period.value.toYear}`
      : '';
  return `${scale} · ${summary.failureRatePercent.value}% failed · ${summary.sampleSize.value} results${period}`;
};

const selectedCourseView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('grid gap-4 pt-4')],
    [
      Button.view<Message>({
        type: 'button',
        onClick: ClosedCourse(),
        toView: (attributes) =>
          h.button([...attributes.button, h.Class(backButtonClass)], ['← Back to course results']),
      }),
      detailResultView(model.detail),
      productFooter(),
    ],
  );
};

const productFooter = (): Html => {
  const h = html<Message>();
  const externalLink = (url: string, label: string): Html =>
    h.a(
      [h.Href(url), h.Target('_blank'), h.Rel('noreferrer'), h.Class('relative font-[650]')],
      [label],
    );
  return h.footer(
    [
      h.Class(
        'flex flex-wrap gap-y-[0.35rem] gap-x-4 pt-6 pb-2 border-t border-outline-variant text-on-surface-variant text-[0.82rem] leading-[1.5]',
      ),
    ],
    [
      h.p(
        [],
        [
          'Copyright © Course Data Platform contributors. Free software licensed under ',
          externalLink('https://www.gnu.org/licenses/agpl-3.0.html', 'AGPL-3.0-only'),
          '; provided without warranty.',
        ],
      ),
      ...(sourceUrl === null ? [] : [h.p([], [externalLink(sourceUrl, 'View source code')])]),
      ...(tipUrl === null
        ? []
        : [
            h.p(
              [],
              [
                'Found this useful? ',
                externalLink(tipUrl, 'Support the project'),
                ' — completely optional.',
              ],
            ),
          ]),
    ],
  );
};

const detailResultView = (detail: DetailResult): Html => {
  const h = html<Message>();
  switch (detail._tag) {
    case 'DetailClosed':
      return h.empty;
    case 'DetailLoading':
      return h.section(
        [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
          h.h2([h.Class(stateCardH2Class)], ['Gathering course evidence']),
          h.p(
            [h.Class(stateCardPClass)],
            ['Official course details and historical outcomes load independently.'],
          ),
        ],
      );
    case 'DetailFailure':
      return h.section(
        [h.Class(stateCardFailure), h.Role('alert')],
        [
          h.p([h.Class(statusLabelErrorClass)], ['Course unavailable']),
          h.h2([h.Class(stateCardH2Class)], ['We could not load this course']),
          h.p([h.Class(stateCardFailurePClass)], [detail.error]),
        ],
      );
    case 'DetailPartial':
      return courseInsightView(detail.response, true);
    case 'DetailSuccess':
      return courseInsightView(detail.response, false);
  }
};

const formatOfferingPeriod = (academicYear: number, season: string): string => {
  const academicYearLabel = `${academicYear}/${String(academicYear + 1).slice(-2)}`;
  if (season === 'full-year') return `Academic year ${academicYearLabel}`;
  const calendarYear = season === 'autumn' ? academicYear : academicYear + 1;
  return `${formatToken(season)} ${calendarYear} · ${academicYearLabel}`;
};

const formatToken = (value: string): string =>
  value
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
