import type {
  CourseDecisionSignalsDtoType,
  CourseGradeSummaryDtoType,
  CourseInsightResponseDtoType,
  CourseSearchItemDtoType,
} from '@course-data/contracts';
import { Effect, Match as M, Option, Schema as S } from 'effect';
import { Command, Navigation, Runtime, Url } from 'foldkit';
import type { Document, Html } from 'foldkit/html';
import { createKeyedLazy, createLazy, html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { ts } from 'foldkit/schema';
import { evo } from 'foldkit/struct';

import { Button, Checkbox, Dialog, Input } from '@foldkit/ui';

import {
  CourseDecisionSignalsResponseSchema,
  CourseGradeSummariesResponseSchema,
  CourseInsightResponseSchema,
  CourseSearchResponseSchema,
  courseClient,
  type CourseDecisionSignalsResponse,
  type CourseGradeSummariesResponse,
  type CourseSearchRequest,
  type CourseSearchResponse,
  type CourseSearchSort,
} from './course-client';
import { courseInsightView } from './course-detail';
import { isLocale, localeTag, translate, translateToken, type Locale } from './i18n';
import { collaborationIconName, icon, termSeasonIconName, type AppIcon } from './icons';
import { desktopNavigation, mobileNavigation } from './navigation';
import {
  initSelectField,
  selectField,
  SelectFieldMessage,
  SelectFieldModel,
  updateSelectField,
  type SelectOption,
} from './select-field';
import {
  colorModes,
  decodeThemePreference,
  defaultThemePreference,
  persistThemePreference,
  presetPreference,
  readThemePreference,
  selectedPresetId,
  themePresets,
  type ColorMode,
  type ThemePreference,
  type ThemePresetId,
} from './theme';

const DISPLAY_CHUNK = 20;
const DEFAULT_TERM = '2026-autumn';
const DEFAULT_SORT: CourseSearchSort = 'relevance';
const lazyCourseCard = createKeyedLazy();
const lazyDesktopNavigation = createLazy();
const lazyMobileNavigation = createLazy();
const lazyCatalogueHeader = createLazy();
const lazyCatalogueControls = createLazy();
const lazyCatalogueRefineDialog = createLazy();
const lazyAppearanceDialog = createLazy();
const lazyCatalogueFooter = createLazy();
const lazyDetailFooter = createLazy();

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
type OutcomeView = 'letter' | 'pass-fail';
const CampusSchema = S.Literals(['all', 'trondheim', 'gjovik', 'alesund']);
const LevelSchema = S.Literals(['all', 'bachelor', 'master', 'phd']);
const OutcomeViewSchema = S.Literals(['letter', 'pass-fail']);
const SortSchema = S.Literals(['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc']);
const LocaleSchema = S.Literals(['en', 'nb']);
const BaseColorSchema = S.Literals(['mist', 'zinc', 'stone', 'mauve', 'olive', 'neutral']);
const ThemeColorSchema = S.Literals(['blue', 'violet', 'amber', 'rose', 'emerald', 'sky']);
const ChartColorSchema = S.Literals(['sky', 'violet', 'emerald', 'rose', 'indigo', 'amber']);
const ColorModeSchema = S.Literals(colorModes);
const ThemePresetIdSchema = S.Literals([
  'fjord',
  'aurora',
  'birch',
  'heather',
  'pine',
  'polar-night',
]);
const ThemePreferenceSchema = S.Struct({
  version: S.Literal(1),
  baseColor: BaseColorSchema,
  themeColor: ThemeColorSchema,
  chartColor: ChartColorSchema,
  mode: ColorModeSchema,
});
const SelectControlIdSchema = S.Literals([
  'campus-inline',
  'term-refine',
  'campus-refine',
  'level-refine',
  'sort-refine',
  'language-desktop',
  'language-mobile',
]);
type SelectControlId = typeof SelectControlIdSchema.Type;
const SelectFieldModels = S.Struct({
  campusInline: SelectFieldModel,
  termRefine: SelectFieldModel,
  campusRefine: SelectFieldModel,
  levelRefine: SelectFieldModel,
  sortRefine: SelectFieldModel,
  languageDesktop: SelectFieldModel,
  languageMobile: SelectFieldModel,
});

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

export const DecisionSignalsIdle = ts('DecisionSignalsIdle');
export const DecisionSignalsLoading = ts('DecisionSignalsLoading', {
  previous: S.NullOr(CourseDecisionSignalsResponseSchema),
  pendingCodes: S.Array(S.String),
});
export const DecisionSignalsSuccess = ts('DecisionSignalsSuccess', {
  response: CourseDecisionSignalsResponseSchema,
});
export const DecisionSignalsFailure = ts('DecisionSignalsFailure', {
  previous: S.NullOr(CourseDecisionSignalsResponseSchema),
  error: S.String,
});
const DecisionSignalsResult = S.Union([
  DecisionSignalsIdle,
  DecisionSignalsLoading,
  DecisionSignalsSuccess,
  DecisionSignalsFailure,
]);

type DecisionSignalsResult =
  | ReturnType<typeof DecisionSignalsIdle>
  | {
      readonly _tag: 'DecisionSignalsLoading';
      readonly previous: CourseDecisionSignalsResponse | null;
      readonly pendingCodes: ReadonlyArray<string>;
    }
  | { readonly _tag: 'DecisionSignalsSuccess'; readonly response: CourseDecisionSignalsResponse }
  | {
      readonly _tag: 'DecisionSignalsFailure';
      readonly previous: CourseDecisionSignalsResponse | null;
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
  locale: LocaleSchema,
  query: S.String,
  term: S.String,
  campus: CampusSchema,
  level: LevelSchema,
  sort: SortSchema,
  openOnly: S.Boolean,
  englishOnly: S.Boolean,
  outcomeView: OutcomeViewSchema,
  activeRequestKey: S.String,
  visibleCount: S.Number,
  catalogue: CatalogueResult,
  gradeSignals: GradeSignalsResult,
  decisionSignals: DecisionSignalsResult,
  nextPage: NextPageState,
  selectedCode: S.NullOr(S.String),
  detail: DetailResult,
  sidebarCollapsed: S.Boolean,
  refineDialog: Dialog.Model,
  appearanceDialog: Dialog.Model,
  themePreference: ThemePreferenceSchema,
  selectFields: SelectFieldModels,
});

type SchemaModel = typeof Model.Type;
export type Model = Omit<
  SchemaModel,
  'catalogue' | 'gradeSignals' | 'decisionSignals' | 'detail'
> & {
  readonly catalogue: CatalogueResult;
  readonly gradeSignals: GradeSignalsResult;
  readonly decisionSignals: DecisionSignalsResult;
  readonly detail: DetailResult;
};

export const UpdatedQuery = m('UpdatedQuery', { value: S.String });
export const ChangedLocale = m('ChangedLocale', { value: S.String });
export const SubmittedSearch = m('SubmittedSearch');
export const ChangedTerm = m('ChangedTerm', { value: S.String });
export const ChangedCampus = m('ChangedCampus', { value: S.String });
export const ChangedLevel = m('ChangedLevel', { value: S.String });
export const ChangedSort = m('ChangedSort', { value: S.String });
export const ToggledOpen = m('ToggledOpen', { isChecked: S.Boolean });
export const ToggledEnglish = m('ToggledEnglish', { isChecked: S.Boolean });
export const ChangedOutcomeView = m('ChangedOutcomeView', { value: S.String });
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
export const SucceededDecisionSignals = m('SucceededDecisionSignals', {
  requestKey: S.String,
  courseCodes: S.Array(S.String),
  response: CourseDecisionSignalsResponseSchema,
});
export const FailedDecisionSignals = m('FailedDecisionSignals', {
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
export const PersistedLocale = m('PersistedLocale');
export const FailedLocalePersistence = m('FailedLocalePersistence');
export const ToggledSidebar = m('ToggledSidebar');
export const RequestedAppearance = m('RequestedAppearance');
export const PersistedSidebarPreference = m('PersistedSidebarPreference');
export const FailedSidebarPreferencePersistence = m('FailedSidebarPreferencePersistence');
export const GotRefineDialogMessage = m('GotRefineDialogMessage', {
  message: Dialog.Message,
});
export const GotAppearanceDialogMessage = m('GotAppearanceDialogMessage', {
  message: Dialog.Message,
});
export const ChangedThemePreset = m('ChangedThemePreset', { value: ThemePresetIdSchema });
export const ChangedColorMode = m('ChangedColorMode', { value: ColorModeSchema });
export const ResetThemePreference = m('ResetThemePreference');
export const PersistedThemePreference = m('PersistedThemePreference');
export const FailedThemePreferencePersistence = m('FailedThemePreferencePersistence');
export const GotSelectFieldMessage = m('GotSelectFieldMessage', {
  id: SelectControlIdSchema,
  message: SelectFieldMessage,
});

export const Message = S.Union([
  UpdatedQuery,
  ChangedLocale,
  SubmittedSearch,
  ChangedTerm,
  ChangedCampus,
  ChangedLevel,
  ChangedSort,
  ToggledOpen,
  ToggledEnglish,
  ChangedOutcomeView,
  RequestedMoreCourses,
  RequestedUrl,
  ChangedUrl,
  ClosedCourse,
  SucceededCourseSearch,
  FailedCourseSearch,
  SucceededGradeSignals,
  FailedGradeSignals,
  SucceededDecisionSignals,
  FailedDecisionSignals,
  SucceededCourseInsight,
  FailedCourseInsight,
  CompletedNavigation,
  FailedNavigation,
  PersistedLocale,
  FailedLocalePersistence,
  ToggledSidebar,
  RequestedAppearance,
  PersistedSidebarPreference,
  FailedSidebarPreferencePersistence,
  GotRefineDialogMessage,
  GotAppearanceDialogMessage,
  ChangedThemePreset,
  ChangedColorMode,
  ResetThemePreference,
  PersistedThemePreference,
  FailedThemePreferencePersistence,
  GotSelectFieldMessage,
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

export const FetchDecisionSignals = Command.define(
  'FetchDecisionSignals',
  { courseCodes: S.Array(S.String), term: S.String, requestKey: S.String },
  SucceededDecisionSignals,
  FailedDecisionSignals,
)(({ courseCodes, term, requestKey: key }) =>
  courseClient.getDecisionSignals(courseCodes, term).pipe(
    Effect.map((response) => SucceededDecisionSignals({ requestKey: key, courseCodes, response })),
    Effect.catch((error) =>
      Effect.succeed(FailedDecisionSignals({ requestKey: key, courseCodes, error: error.message })),
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

export const PersistLocale = Command.define(
  'PersistLocale',
  { locale: LocaleSchema },
  PersistedLocale,
  FailedLocalePersistence,
)(({ locale }) =>
  Effect.try({
    try: () => {
      localStorage.setItem('course-lens:locale', locale);
      document.documentElement.lang = localeTag(locale);
    },
    catch: () => new Error('Locale preference could not be persisted'),
  }).pipe(
    Effect.as(PersistedLocale()),
    Effect.catch(() => Effect.succeed(FailedLocalePersistence())),
  ),
);

export const PersistSidebarPreference = Command.define(
  'PersistSidebarPreference',
  { collapsed: S.Boolean },
  PersistedSidebarPreference,
  FailedSidebarPreferencePersistence,
)(({ collapsed }) =>
  Effect.try({
    try: () => {
      localStorage.setItem('course-lens:sidebar-collapsed', collapsed ? '1' : '0');
    },
    catch: () => new Error('Sidebar preference could not be persisted'),
  }).pipe(
    Effect.as(PersistedSidebarPreference()),
    Effect.catch(() => Effect.succeed(FailedSidebarPreferencePersistence())),
  ),
);

export const PersistThemePreference = Command.define(
  'PersistThemePreference',
  { preference: ThemePreferenceSchema },
  PersistedThemePreference,
  FailedThemePreferencePersistence,
)(({ preference }) =>
  Effect.try({
    try: () => persistThemePreference(preference),
    catch: () => new Error('Theme preference could not be persisted'),
  }).pipe(
    Effect.as(PersistedThemePreference()),
    Effect.catch(() => Effect.succeed(FailedThemePreferencePersistence())),
  ),
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

const decisionSignalsResponse = (
  result: DecisionSignalsResult,
): CourseDecisionSignalsResponse | null => {
  switch (result._tag) {
    case 'DecisionSignalsSuccess':
      return result.response;
    case 'DecisionSignalsLoading':
    case 'DecisionSignalsFailure':
      return result.previous;
    case 'DecisionSignalsIdle':
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

const mergeDecisionSignals = (
  current: CourseDecisionSignalsResponse | null,
  next: CourseDecisionSignalsResponse,
): CourseDecisionSignalsResponse => {
  if (current === null) return next;
  const byCode = new Map(current.items.map((item) => [item.courseCode, item]));
  for (const item of next.items) byCode.set(item.courseCode, item);
  return {
    items: [...byCode.values()],
    meta: { count: byCode.size },
  };
};

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

const requestVisibleDecisionSignals = (
  response: CourseSearchResponse,
  visibleCount: number,
  current: DecisionSignalsResult,
  term: string,
  key: string,
  reset: boolean,
): readonly [DecisionSignalsResult, ReadonlyArray<Command.Command<Message>>] => {
  const previous = reset ? null : decisionSignalsResponse(current);
  const pendingCodes = reset
    ? []
    : current._tag === 'DecisionSignalsLoading'
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
    return [reset ? DecisionSignalsIdle() : current, []];
  }
  return [
    DecisionSignalsLoading({ previous, pendingCodes: [...pendingCodes, ...courseCodes] }),
    [FetchDecisionSignals({ courseCodes, term, requestKey: key })],
  ];
};

const normalizedUrl = (model: Model, selectedCode: string | null, pathname = '/'): string => {
  const params = new URLSearchParams();
  params.set('lang', model.locale);
  if (model.query.trim().length > 0) params.set('q', model.query.trim());
  if (model.term !== DEFAULT_TERM) params.set('term', model.term);
  if (model.campus !== 'all') params.set('campus', model.campus);
  if (model.level !== 'all') params.set('level', model.level);
  if (model.sort !== DEFAULT_SORT) params.set('sort', model.sort);
  if (model.openOnly) params.set('open', '1');
  if (model.englishOnly) params.set('english', '1');
  if (selectedCode !== null) params.set('course', selectedCode);
  const query = params.toString();
  return query.length === 0 ? pathname : `${pathname}?${query}`;
};

const appearanceUrl = (model: Model): string =>
  normalizedUrl(model, model.selectedCode, '/appearance');

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
    decisionSignals: DecisionSignalsIdle(),
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
  readonly locale: Locale;
  readonly query: string;
  readonly term: string;
  readonly campus: Campus;
  readonly level: Level;
  readonly sort: CourseSearchSort;
  readonly openOnly: boolean;
  readonly englishOnly: boolean;
  readonly selectedCode: string | null;
  readonly appearanceOpen: boolean;
}

const parseLocation = (href: string, fallbackLocale: Locale = 'en'): ParsedLocation => {
  const url = new URL(href, 'http://course-lens.local');
  const requestedLocale = url.searchParams.get('lang');
  return {
    locale: isLocale(requestedLocale) ? requestedLocale : fallbackLocale,
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
    appearanceOpen: url.pathname === '/appearance' || url.pathname === '/appearance/',
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

const selectFieldModel = (
  fields: Model['selectFields'],
  id: SelectControlId,
): typeof fields.campusInline => {
  switch (id) {
    case 'campus-inline':
      return fields.campusInline;
    case 'term-refine':
      return fields.termRefine;
    case 'campus-refine':
      return fields.campusRefine;
    case 'level-refine':
      return fields.levelRefine;
    case 'sort-refine':
      return fields.sortRefine;
    case 'language-desktop':
      return fields.languageDesktop;
    case 'language-mobile':
      return fields.languageMobile;
  }
};

const replaceSelectFieldModel = (
  fields: Model['selectFields'],
  id: SelectControlId,
  field: typeof fields.campusInline,
): Model['selectFields'] => {
  switch (id) {
    case 'campus-inline':
      return { ...fields, campusInline: field };
    case 'term-refine':
      return { ...fields, termRefine: field };
    case 'campus-refine':
      return { ...fields, campusRefine: field };
    case 'level-refine':
      return { ...fields, levelRefine: field };
    case 'sort-refine':
      return { ...fields, sortRefine: field };
    case 'language-desktop':
      return { ...fields, languageDesktop: field };
    case 'language-mobile':
      return { ...fields, languageMobile: field };
  }
};

const applySelectValue = (
  model: Model,
  id: SelectControlId,
  value: string,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  switch (id) {
    case 'campus-inline':
    case 'campus-refine':
      return startCatalogue(model, {
        campus: oneOf(value, ['all', 'trondheim', 'gjovik', 'alesund'], 'all'),
      });
    case 'term-refine':
      return startCatalogue(model, { term: value });
    case 'level-refine':
      return startCatalogue(model, {
        level: oneOf(value, ['all', 'bachelor', 'master', 'phd'], 'all'),
      });
    case 'sort-refine':
      return startCatalogue(model, {
        sort: oneOf(
          value,
          ['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc'],
          'relevance',
        ),
      });
    case 'language-desktop':
    case 'language-mobile': {
      const locale = isLocale(value) ? value : 'en';
      const next = { ...model, locale };
      return [
        next,
        [
          PersistLocale({ locale }),
          Navigate({ href: normalizedUrl(next, next.selectedCode), mode: 'replace' }),
        ],
      ];
    }
  }
};

const syncAppearanceDialog = (
  model: Model,
  shouldOpen: boolean,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  if (model.appearanceDialog.isOpen === shouldOpen) return [model, []];
  const [appearanceDialog, commands] = shouldOpen
    ? Dialog.open(model.appearanceDialog)
    : Dialog.close(model.appearanceDialog);
  return [
    { ...model, appearanceDialog },
    Command.mapMessages(commands, (message) => GotAppearanceDialogMessage({ message })),
  ];
};

export const update = (
  model: Model,
  message: Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] =>
  M.value(message).pipe(
    M.withReturnType<readonly [Model, ReadonlyArray<Command.Command<Message>>]>(),
    M.tagsExhaustive({
      UpdatedQuery: ({ value }) => [evo(model, { query: () => value }), []],
      ChangedLocale: ({ value }) => {
        const locale = isLocale(value) ? value : 'en';
        const next = { ...model, locale };
        return [
          next,
          [
            PersistLocale({ locale }),
            Navigate({ href: normalizedUrl(next, next.selectedCode), mode: 'replace' }),
          ],
        ];
      },
      ToggledSidebar: () => {
        const sidebarCollapsed = !model.sidebarCollapsed;
        return [
          { ...model, sidebarCollapsed },
          [PersistSidebarPreference({ collapsed: sidebarCollapsed })],
        ];
      },
      RequestedAppearance: () => [model, [Navigate({ href: appearanceUrl(model), mode: 'push' })]],
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
      ChangedOutcomeView: ({ value }) => [
        { ...model, outcomeView: oneOf(value, ['letter', 'pass-fail'], 'letter') },
        [],
      ],
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
          const [decisionSignals, decisionCommands] = requestVisibleDecisionSignals(
            response,
            visibleCount,
            model.decisionSignals,
            model.term,
            model.activeRequestKey,
            false,
          );
          return [
            {
              ...model,
              visibleCount,
              gradeSignals,
              decisionSignals,
              nextPage: NextPageIdle(),
            },
            [...gradeCommands, ...decisionCommands],
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
        const withAppearance = (
          result: readonly [Model, ReadonlyArray<Command.Command<Message>>],
        ): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
          const [next, commands] = result;
          const [synced, appearanceCommands] = syncAppearanceDialog(next, location.appearanceOpen);
          return [synced, [...commands, ...appearanceCommands]];
        };
        if (!locationMatchesModel(location, model)) {
          const next: Model = {
            ...model,
            locale: location.locale,
            query: location.query,
            term: location.term,
            campus: location.campus,
            level: location.level,
            sort: location.sort,
            openOnly: location.openOnly,
            englishOnly: location.englishOnly,
            selectedCode: location.selectedCode,
            detail: location.selectedCode === null ? DetailClosed() : DetailLoading(),
            catalogue: CatalogueInitialLoading(),
            gradeSignals: GradeSignalsIdle(),
            decisionSignals: DecisionSignalsIdle(),
            nextPage: NextPageIdle(),
            visibleCount: DISPLAY_CHUNK,
          };
          const request = searchRequest(next, 1);
          const key = requestKey(request);
          return withAppearance([
            { ...next, activeRequestKey: key },
            [
              fetchCommand(request, key, false),
              ...(location.selectedCode === null
                ? []
                : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
            ],
          ]);
        }
        const localizedModel =
          location.locale === model.locale ? model : { ...model, locale: location.locale };
        const localeCommands =
          location.locale === model.locale ? [] : [PersistLocale({ locale: location.locale })];
        if (location.selectedCode === model.selectedCode) {
          return withAppearance([localizedModel, localeCommands]);
        }
        return withAppearance(
          location.selectedCode === null
            ? [{ ...localizedModel, selectedCode: null, detail: DetailClosed() }, localeCommands]
            : [
                {
                  ...localizedModel,
                  selectedCode: location.selectedCode,
                  detail: DetailLoading(),
                },
                [
                  ...localeCommands,
                  FetchCourseInsight({ courseCode: location.selectedCode, term: model.term }),
                ],
              ],
        );
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
        const [decisionSignals, decisionCommands] = requestVisibleDecisionSignals(
          response,
          visibleCount,
          model.decisionSignals,
          model.term,
          key,
          !append,
        );
        return [
          {
            ...model,
            catalogue: result,
            gradeSignals,
            decisionSignals,
            visibleCount,
            nextPage: NextPageIdle(),
          },
          [...gradeCommands, ...decisionCommands],
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
      SucceededDecisionSignals: ({ requestKey: key, courseCodes, response: nextResponse }) => {
        if (key !== model.activeRequestKey) return [model, []];
        const response = mergeDecisionSignals(
          decisionSignalsResponse(model.decisionSignals),
          nextResponse,
        );
        const completedCodes = new Set(courseCodes);
        const pendingCodes =
          model.decisionSignals._tag === 'DecisionSignalsLoading'
            ? model.decisionSignals.pendingCodes.filter((code) => !completedCodes.has(code))
            : [];
        return [
          {
            ...model,
            decisionSignals:
              pendingCodes.length > 0
                ? DecisionSignalsLoading({ previous: response, pendingCodes })
                : DecisionSignalsSuccess({ response }),
          },
          [],
        ];
      },
      FailedDecisionSignals: ({ requestKey: key, error }) =>
        key !== model.activeRequestKey
          ? [model, []]
          : [
              {
                ...model,
                decisionSignals: DecisionSignalsFailure({
                  previous: decisionSignalsResponse(model.decisionSignals),
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
      PersistedLocale: () => [model, []],
      FailedLocalePersistence: () => [model, []],
      PersistedSidebarPreference: () => [model, []],
      FailedSidebarPreferencePersistence: () => [model, []],
      GotRefineDialogMessage: ({ message: dialogMessage }) => {
        const [refineDialog, commands] = Dialog.update(model.refineDialog, dialogMessage);
        return [
          { ...model, refineDialog },
          Command.mapMessages(commands, (message) => GotRefineDialogMessage({ message })),
        ];
      },
      GotAppearanceDialogMessage: ({ message: dialogMessage }) => {
        if (dialogMessage._tag === 'RequestedClose') {
          return [
            model,
            [Navigate({ href: normalizedUrl(model, model.selectedCode), mode: 'replace' })],
          ];
        }
        const [appearanceDialog, commands] = Dialog.update(model.appearanceDialog, dialogMessage);
        return [
          { ...model, appearanceDialog },
          Command.mapMessages(commands, (message) => GotAppearanceDialogMessage({ message })),
        ];
      },
      ChangedThemePreset: ({ value }) => {
        const themePreference = presetPreference(value, model.themePreference.mode);
        return [
          { ...model, themePreference },
          [PersistThemePreference({ preference: themePreference })],
        ];
      },
      ChangedColorMode: ({ value }) => {
        const themePreference = decodeThemePreference({ ...model.themePreference, mode: value });
        return [
          { ...model, themePreference },
          [PersistThemePreference({ preference: themePreference })],
        ];
      },
      ResetThemePreference: () => [
        { ...model, themePreference: defaultThemePreference },
        [PersistThemePreference({ preference: defaultThemePreference })],
      ],
      PersistedThemePreference: () => [model, []],
      FailedThemePreferencePersistence: () => [model, []],
      GotSelectFieldMessage: ({ id, message: selectMessage }) => {
        const [field, commands, maybeSelection] = updateSelectField(
          selectFieldModel(model.selectFields, id),
          selectMessage,
        );
        const next = {
          ...model,
          selectFields: replaceSelectFieldModel(model.selectFields, id, field),
        };
        const selectCommands = Command.mapMessages(commands, (message) =>
          GotSelectFieldMessage({ id, message }),
        );
        return Option.match(maybeSelection, {
          onNone: () => [next, selectCommands],
          onSome: ({ value }) => {
            const [selected, domainCommands] = applySelectValue(next, id, value);
            return [selected, [...selectCommands, ...domainCommands]];
          },
        });
      },
    }),
  );

export const initForHref = (
  href: string,
  fallbackLocale: Locale = 'en',
  sidebarCollapsed = false,
  themePreference: ThemePreference = defaultThemePreference,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const location = parseLocation(href, fallbackLocale);
  const initialAppearanceDialog = Dialog.init({
    id: 'appearance-settings',
    isAnimated: true,
    focusSelector: '#appearance-settings-close',
  });
  const [appearanceDialog, appearanceCommands] = location.appearanceOpen
    ? Dialog.open(initialAppearanceDialog)
    : [initialAppearanceDialog, []];
  const base: Model = {
    locale: location.locale,
    query: location.query,
    term: location.term,
    campus: location.campus,
    level: location.level,
    sort: location.sort,
    openOnly: location.openOnly,
    englishOnly: location.englishOnly,
    outcomeView: 'letter',
    activeRequestKey: '',
    visibleCount: DISPLAY_CHUNK,
    catalogue: CatalogueInitialLoading(),
    gradeSignals: GradeSignalsIdle(),
    decisionSignals: DecisionSignalsIdle(),
    nextPage: NextPageIdle(),
    selectedCode: location.selectedCode,
    detail: location.selectedCode === null ? DetailClosed() : DetailLoading(),
    sidebarCollapsed,
    refineDialog: Dialog.init({
      id: 'catalogue-refine',
      isAnimated: true,
      focusSelector: '#catalogue-refine-close',
    }),
    appearanceDialog,
    themePreference: decodeThemePreference(themePreference),
    selectFields: {
      campusInline: initSelectField('campus-inline'),
      termRefine: initSelectField('term-refine'),
      campusRefine: initSelectField('campus-refine'),
      levelRefine: initSelectField('level-refine'),
      sortRefine: initSelectField('sort-refine'),
      languageDesktop: initSelectField('language-desktop'),
      languageMobile: initSelectField('language-mobile'),
    },
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
      ...Command.mapMessages(appearanceCommands, (message) =>
        GotAppearanceDialogMessage({ message }),
      ),
    ],
  ];
};

export const init: Runtime.ApplicationInit<Model, Message> = () =>
  initForHref(
    typeof window === 'undefined' ? 'http://course-lens.local/' : window.location.href,
    browserPreferredLocale(),
    browserSidebarCollapsed(),
    readThemePreference(),
  );

export const routingInit: Runtime.RoutingApplicationInit<Model, Message> = (url) =>
  initForHref(
    Url.toString(url),
    browserPreferredLocale(),
    browserSidebarCollapsed(),
    readThemePreference(),
  );

const browserPreferredLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('course-lens:locale');
  if (isLocale(stored)) return stored;
  return navigator.languages.some((language) => language.toLowerCase().startsWith('nb'))
    ? 'nb'
    : 'en';
};

const browserSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('course-lens:sidebar-collapsed') === '1';
};

export const view = (model: Model): Document => ({
  title:
    model.detail._tag === 'DetailSuccess' || model.detail._tag === 'DetailPartial'
      ? `${model.detail.response.item.code} · ${translate(model.locale, 'app.name')}`
      : translate(model.locale, 'app.catalogueTitle'),
  body: appView(model),
});

const eyebrowClass = 'mb-2 text-primary text-[0.78rem] font-[800] tracking-[0.1em] uppercase';

const fieldLabelClass =
  'block mt-0 mr-0 mb-[0.4rem] ml-1 text-on-surface-variant text-[0.85rem] font-[650]';

const mainContentClass = (sidebarCollapsed: boolean): string =>
  `w-[min(100%,76rem)] mx-auto pt-4 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] [@media(min-width:48rem)_and_(min-height:34rem)]:pt-4 [@media(min-width:48rem)_and_(min-height:34rem)]:px-6 [@media(min-width:48rem)_and_(min-height:34rem)]:pb-20 [@media(min-width:64rem)]:px-10 ${
    sidebarCollapsed
      ? '[@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-5rem),76rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:ml-20'
      : '[@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-16.5rem),76rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:ml-66'
  }`;

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
      lazyDesktopNavigation(desktopNavigation<Message>, [
        model.locale,
        model.sidebarCollapsed,
        ToggledSidebar(),
        RequestedAppearance(),
        languageSelectControl(
          model.selectFields,
          'language-desktop',
          model.locale,
          model.sidebarCollapsed,
        ),
      ]),
      h.main(
        [h.Class(mainContentClass(model.sidebarCollapsed))],
        [model.selectedCode === null ? catalogueView(model) : selectedCourseView(model)],
      ),
      lazyCatalogueRefineDialog(catalogueRefineDialogFromValues, [
        model.locale,
        model.query,
        model.term,
        model.campus,
        model.level,
        model.sort,
        model.openOnly,
        model.englishOnly,
        model.catalogue._tag === 'CatalogueInitialLoading',
        model.refineDialog,
        model.selectFields,
      ]),
      lazyAppearanceDialog(appearanceDialogFromValues, [
        model.locale,
        model.themePreference,
        model.appearanceDialog,
      ]),
      lazyMobileNavigation(mobileNavigation<Message>, [model.locale, RequestedAppearance()]),
    ],
  );
};

const catalogueView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('grid gap-6')],
    [
      lazyCatalogueHeader(catalogueHeader, [model.locale]),
      lazyCatalogueControls(catalogueControlsFromValues, [
        model.locale,
        model.query,
        model.term,
        model.campus,
        model.level,
        model.sort,
        model.openOnly,
        model.englishOnly,
        model.catalogue._tag === 'CatalogueInitialLoading',
        model.selectFields,
      ]),
      catalogueRefineAction(model),
      catalogueResultView(model),
      lazyCatalogueFooter(productFooter, [model.locale, model.selectFields]),
    ],
  );
};

const catalogueHeader = (locale: Locale): Html => {
  const h = html<Message>();
  return h.header(
    [h.Class('pt-[clamp(2rem,5vw,3.5rem)] pb-2')],
    [
      h.p([h.Class(eyebrowClass)], [translate(locale, 'catalogue.eyebrow')]),
      h.h1(
        [
          h.Class(
            'max-w-[22ch] text-[clamp(2.1rem,6vw,4rem)] font-[720] tracking-[-0.05em] leading-none',
          ),
        ],
        [translate(locale, 'catalogue.heading')],
      ),
      h.p(
        [h.Class('max-w-192 mt-4 text-on-surface-variant text-[1.05rem] leading-[1.6]')],
        [translate(locale, 'catalogue.intro')],
      ),
    ],
  );
};

interface CatalogueControlsState {
  readonly locale: Locale;
  readonly query: string;
  readonly term: string;
  readonly campus: Campus;
  readonly level: Level;
  readonly sort: CourseSearchSort;
  readonly openOnly: boolean;
  readonly englishOnly: boolean;
  readonly loading: boolean;
  readonly selectFields: Model['selectFields'];
}

const catalogueControlsFromValues = (
  locale: Locale,
  query: string,
  term: string,
  campus: Campus,
  level: Level,
  sort: CourseSearchSort,
  openOnly: boolean,
  englishOnly: boolean,
  loading: boolean,
  selectFields: Model['selectFields'],
): Html =>
  catalogueControls({
    locale,
    query,
    term,
    campus,
    level,
    sort,
    openOnly,
    englishOnly,
    loading,
    selectFields,
  });

const catalogueRefineDialogFromValues = (
  locale: Locale,
  query: string,
  term: string,
  campus: Campus,
  level: Level,
  sort: CourseSearchSort,
  openOnly: boolean,
  englishOnly: boolean,
  loading: boolean,
  refineDialog: Model['refineDialog'],
  selectFields: Model['selectFields'],
): Html =>
  catalogueRefineDialog(
    {
      locale,
      query,
      term,
      campus,
      level,
      sort,
      openOnly,
      englishOnly,
      loading,
      selectFields,
    },
    refineDialog,
  );

interface CatalogueControlsOptions {
  readonly className?: string;
  readonly idPrefix?: string;
}

const catalogueControlsFrameClass =
  'grid gap-4 p-[clamp(1rem,3vw,1.5rem)] border border-outline-variant rounded-m3-extra-large bg-surface-container-low shadow-m3-1';

const catalogueControlsSearchClass =
  'flex items-end gap-3 [@media(max-width:37rem)]:items-stretch [@media(max-width:37rem)]:flex-col';

const catalogueControls = (
  model: CatalogueControlsState,
  options: CatalogueControlsOptions = {},
): Html => {
  const h = html<Message>();
  const loading = model.loading;
  const idPrefix = options.idPrefix ?? '';
  const isDialog = options.className === 'catalogue-controls--dialog';
  return h.form(
    [
      h.Class(isDialog ? 'grid gap-4' : catalogueControlsFrameClass),
      h.Role('search'),
      h.OnSubmit(SubmittedSearch()),
      h.AriaLabel(translate(model.locale, 'catalogue.searchRegion')),
    ],
    [
      h.div(
        [h.Class(catalogueControlsSearchClass)],
        [
          Input.view<Message>({
            id: `${idPrefix}course-query`,
            value: model.query,
            placeholder: translate(model.locale, 'catalogue.searchPlaceholder'),
            onInput: (value) => UpdatedQuery({ value }),
            toView: (attributes) =>
              h.div(
                [h.Class('flex-1')],
                [
                  h.label(
                    [...attributes.label, h.Class(fieldLabelClass)],
                    [translate(model.locale, 'catalogue.searchLabel')],
                  ),
                  h.input([
                    ...attributes.input,
                    h.Placeholder(translate(model.locale, 'catalogue.searchPlaceholder')),
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
                [
                  loading
                    ? translate(model.locale, 'catalogue.searching')
                    : translate(model.locale, 'catalogue.search'),
                ],
              ),
          }),
        ],
      ),
      h.div(
        [
          h.Class(
            isDialog
              ? 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]'
              : 'grid max-w-80',
          ),
        ],
        isDialog
          ? [
              selectControl(
                model.selectFields,
                'term-refine',
                translate(model.locale, 'catalogue.term'),
                model.term,
                [
                  [
                    '2026-autumn',
                    formatOfferingPeriod(2026, 'autumn', model.locale),
                    termSeasonIconName('autumn'),
                  ],
                  [
                    '2026-spring',
                    formatOfferingPeriod(2026, 'spring', model.locale),
                    termSeasonIconName('spring'),
                  ],
                  [
                    '2027-autumn',
                    formatOfferingPeriod(2027, 'autumn', model.locale),
                    termSeasonIconName('autumn'),
                  ],
                  [
                    '2027-spring',
                    formatOfferingPeriod(2027, 'spring', model.locale),
                    termSeasonIconName('spring'),
                  ],
                ],
                { portal: false },
              ),
              selectControl(
                model.selectFields,
                'campus-refine',
                translate(model.locale, 'catalogue.campus'),
                model.campus,
                [
                  ['all', translate(model.locale, 'catalogue.allCampuses')],
                  ['trondheim', translate(model.locale, 'catalogue.trondheim')],
                  ['gjovik', translate(model.locale, 'catalogue.gjovik')],
                  ['alesund', translate(model.locale, 'catalogue.alesund')],
                ],
                { portal: false },
              ),
              selectControl(
                model.selectFields,
                'level-refine',
                translate(model.locale, 'catalogue.level'),
                model.level,
                [
                  ['all', translate(model.locale, 'catalogue.allLevels')],
                  ['bachelor', translate(model.locale, 'catalogue.bachelor')],
                  ['master', translate(model.locale, 'catalogue.master')],
                  ['phd', translate(model.locale, 'catalogue.phd')],
                ],
                { portal: false },
              ),
              selectControl(
                model.selectFields,
                'sort-refine',
                translate(model.locale, 'catalogue.sort'),
                model.sort,
                [
                  ['relevance', translate(model.locale, 'catalogue.relevance')],
                  ['title-asc', translate(model.locale, 'catalogue.titleAsc')],
                  ['title-desc', translate(model.locale, 'catalogue.titleDesc')],
                  ['code-asc', translate(model.locale, 'catalogue.codeAsc')],
                  ['code-desc', translate(model.locale, 'catalogue.codeDesc')],
                ],
                { portal: false },
              ),
            ]
          : [
              selectControl(
                model.selectFields,
                'campus-inline',
                translate(model.locale, 'catalogue.campus'),
                model.campus,
                [
                  ['all', translate(model.locale, 'catalogue.allCampuses')],
                  ['trondheim', translate(model.locale, 'catalogue.trondheim')],
                  ['gjovik', translate(model.locale, 'catalogue.gjovik')],
                  ['alesund', translate(model.locale, 'catalogue.alesund')],
                ],
              ),
            ],
      ),
      isDialog
        ? h.div(
            [h.Class('flex flex-wrap gap-3')],
            [
              checkboxControl(
                `${idPrefix}open-admission`,
                translate(model.locale, 'catalogue.openAdmission'),
                model.openOnly,
                (isChecked) => ToggledOpen({ isChecked }),
              ),
              checkboxControl(
                `${idPrefix}english`,
                translate(model.locale, 'catalogue.english'),
                model.englishOnly,
                (isChecked) => ToggledEnglish({ isChecked }),
              ),
            ],
          )
        : h.empty,
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
                ? translate(model.locale, 'catalogue.allCourses')
                : translate(model.locale, 'catalogue.activeRefinements', {
                    count,
                    suffix: model.locale === 'en' && count !== 1 ? 's' : '',
                  }),
            ],
          ),
          h.span(
            [
              h.Class(
                '[@media(min-width:48rem)_and_(min-height:34rem)]:overflow-hidden [@media(min-width:48rem)_and_(min-height:34rem)]:text-on-surface-variant [@media(min-width:48rem)_and_(min-height:34rem)]:text-[0.8rem] [@media(min-width:48rem)_and_(min-height:34rem)]:text-ellipsis [@media(min-width:48rem)_and_(min-height:34rem)]:whitespace-nowrap',
              ),
            ],
            [translate(model.locale, 'catalogue.refineHelp')],
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
          h.span(
            [],
            [
              count === 0
                ? translate(model.locale, 'catalogue.refine')
                : translate(model.locale, 'catalogue.refineCount', { count }),
            ],
          ),
        ],
      ),
    ],
  );
};

const refineDialogPanelClass =
  'fixed right-0 bottom-0 left-0 grid max-h-[min(92svh,52rem)] gap-5 pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] overflow-y-auto border border-outline-variant rounded-t-m3-extra-large bg-surface shadow-m3-2 [transform:translateY(0)] [transition:transform_180ms_ease] data-closed:[transform:translateY(100%)] [@media(min-width:48rem)_and_(min-height:34rem)]:top-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:left-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-3rem),44rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:p-6 [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-m3-extra-large [@media(min-width:48rem)_and_(min-height:34rem)]:[transform:translate(-50%,-50%)] [@media(min-width:48rem)_and_(min-height:34rem)]:[transition:opacity_160ms_ease,transform_180ms_ease] [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:opacity-0 [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:[transform:translate(-50%,-47%)_scale(0.98)]';

const catalogueRefineDialog = (
  model: CatalogueControlsState,
  refineDialog: Model['refineDialog'],
): Html => {
  const h = html<Message>();
  return h.submodel({
    slotId: 'catalogue-refine-dialog',
    model: refineDialog,
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
                            h.p([h.Class(eyebrowClass)], [translate(model.locale, 'nav.explore')]),
                            h.h2(
                              [
                                ...title,
                                h.Class('text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]'),
                              ],
                              [translate(model.locale, 'catalogue.refineHeading')],
                            ),
                            h.p(
                              [
                                ...description,
                                h.Class('mt-[0.4rem] text-on-surface-variant leading-[1.5]'),
                              ],
                              [translate(model.locale, 'catalogue.refineDescription')],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            ...closeButton,
                            ...initialFocus,
                            h.Id('catalogue-refine-close'),
                            h.Class(
                              'grid size-11 flex-none p-[0.7rem] place-items-center border-0 rounded-full bg-surface-container text-on-surface cursor-pointer',
                            ),
                            h.Type('button'),
                            h.AriaLabel(translate(model.locale, 'catalogue.closeRefinements')),
                          ],
                          [icon<Message>('close')],
                        ),
                      ],
                    ),
                    catalogueControls(model, {
                      className: 'catalogue-controls--dialog',
                      idPrefix: 'refine-',
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
                          [translate(model.locale, 'catalogue.viewResults')],
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

const appearanceDialogFromValues = (
  locale: Locale,
  themePreference: ThemePreference,
  appearanceDialog: Model['appearanceDialog'],
): Html => appearanceDialogView(locale, themePreference, appearanceDialog);

const themePresetName = (locale: Locale, presetId: ThemePresetId): string => {
  switch (presetId) {
    case 'fjord':
      return translate(locale, 'appearance.fjord');
    case 'aurora':
      return translate(locale, 'appearance.aurora');
    case 'birch':
      return translate(locale, 'appearance.birch');
    case 'heather':
      return translate(locale, 'appearance.heather');
    case 'pine':
      return translate(locale, 'appearance.pine');
    case 'polar-night':
      return translate(locale, 'appearance.polarNight');
  }
};

const themePresetDescription = (locale: Locale, presetId: ThemePresetId): string => {
  switch (presetId) {
    case 'fjord':
      return translate(locale, 'appearance.fjordDescription');
    case 'aurora':
      return translate(locale, 'appearance.auroraDescription');
    case 'birch':
      return translate(locale, 'appearance.birchDescription');
    case 'heather':
      return translate(locale, 'appearance.heatherDescription');
    case 'pine':
      return translate(locale, 'appearance.pineDescription');
    case 'polar-night':
      return translate(locale, 'appearance.polarNightDescription');
  }
};

const colorModeLabel = (locale: Locale, mode: ColorMode): string => {
  switch (mode) {
    case 'system':
      return translate(locale, 'appearance.system');
    case 'light':
      return translate(locale, 'appearance.light');
    case 'dark':
      return translate(locale, 'appearance.dark');
  }
};

const themePreview = (locale: Locale): Html => {
  const h = html<Message>();
  return h.section(
    [
      h.Class(
        'grid overflow-hidden border border-outline-variant rounded-m3-large bg-surface-container-low shadow-m3-1',
      ),
      h.AriaLabel(translate(locale, 'appearance.preview')),
    ],
    [
      h.header(
        [h.Class('grid gap-2 p-4 bg-primary-container text-on-primary-container')],
        [
          h.div(
            [h.Class('flex items-center justify-between gap-3')],
            [
              h.span(
                [h.Class('text-xs font-[800] tracking-[0.08em] uppercase')],
                [translate(locale, 'appearance.previewTerm')],
              ),
              h.span(
                [h.Class('rounded-full border border-current/40 py-1 px-2.5 text-xs font-[750]')],
                [translate(locale, 'appearance.previewCredits')],
              ),
            ],
          ),
          h.h3(
            [h.Class('text-[1.2rem] tracking-[-0.025em]')],
            [translate(locale, 'appearance.previewCourse')],
          ),
        ],
      ),
      h.div(
        [h.Class('grid gap-4 p-4')],
        [
          h.div(
            [h.Class('grid h-18 grid-cols-5 items-end gap-2'), h.AriaHidden(true)],
            [
              h.span([h.Class('h-[38%] rounded-t-md bg-chart-1')], []),
              h.span([h.Class('h-[72%] rounded-t-md bg-chart-2')], []),
              h.span([h.Class('h-[54%] rounded-t-md bg-chart-3')], []),
              h.span([h.Class('h-full rounded-t-md bg-chart-4')], []),
              h.span([h.Class('h-[63%] rounded-t-md bg-chart-5')], []),
            ],
          ),
          h.div(
            [h.Class('flex flex-wrap gap-2 text-xs font-[750]')],
            [
              h.span(
                [h.Class('rounded-full bg-constraint py-1.5 px-3 text-on-constraint')],
                [translate(locale, 'appearance.previewRequired')],
              ),
              h.span(
                [h.Class('rounded-full bg-valid py-1.5 px-3 text-on-valid')],
                [translate(locale, 'appearance.previewValid')],
              ),
              h.span(
                [
                  h.Class(
                    'rounded-full bg-warning-container py-1.5 px-3 text-on-warning-container',
                  ),
                ],
                [translate(locale, 'appearance.previewWarning')],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

const appearanceDialogView = (
  locale: Locale,
  preference: ThemePreference,
  appearanceDialog: Model['appearanceDialog'],
): Html => {
  const h = html<Message>();
  const selectedPreset = selectedPresetId(preference);
  return h.submodel({
    slotId: 'appearance-settings-dialog',
    model: appearanceDialog,
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
                  [
                    ...panel,
                    h.Class(
                      'fixed right-0 bottom-0 left-0 grid max-h-[min(94svh,60rem)] gap-5 overflow-y-auto rounded-t-m3-extra-large border border-outline-variant bg-surface pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] shadow-m3-2 [transform:translateY(0)] [transition:transform_180ms_ease] data-closed:[transform:translateY(100%)] [@media(min-width:48rem)_and_(min-height:34rem)]:top-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:left-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-3rem),58rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:p-6 [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-m3-extra-large [@media(min-width:48rem)_and_(min-height:34rem)]:[transform:translate(-50%,-50%)] [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:opacity-0 [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:[transform:translate(-50%,-47%)_scale(0.98)]',
                    ),
                  ],
                  [
                    h.header(
                      [h.Class('flex items-start justify-between gap-4')],
                      [
                        h.div(
                          [],
                          [
                            h.p([h.Class(eyebrowClass)], [translate(locale, 'appearance.label')]),
                            h.h2(
                              [
                                ...title,
                                h.Class('text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]'),
                              ],
                              [translate(locale, 'appearance.heading')],
                            ),
                            h.p(
                              [
                                ...description,
                                h.Class(
                                  'mt-[0.4rem] max-w-168 text-on-surface-variant leading-[1.5]',
                                ),
                              ],
                              [translate(locale, 'appearance.description')],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            ...closeButton,
                            ...initialFocus,
                            h.Id('appearance-settings-close'),
                            h.Class(
                              'grid size-11 flex-none place-items-center rounded-full border-0 bg-surface-container text-on-surface cursor-pointer',
                            ),
                            h.Type('button'),
                            h.AriaLabel(translate(locale, 'appearance.close')),
                          ],
                          [icon<Message>('close')],
                        ),
                      ],
                    ),
                    h.div(
                      [
                        h.Class(
                          'grid gap-5 [@media(min-width:48rem)]:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.8fr)]',
                        ),
                      ],
                      [
                        h.div(
                          [h.Class('grid gap-3')],
                          [
                            h.h3(
                              [h.Class('text-sm font-[800]')],
                              [translate(locale, 'appearance.palettes')],
                            ),
                            h.div(
                              [
                                h.Class(
                                  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3',
                                ),
                                h.Role('group'),
                                h.AriaLabel(translate(locale, 'appearance.palettes')),
                              ],
                              themePresets.map((preset) => {
                                const isSelected = selectedPreset === preset.id;
                                return h.button(
                                  [
                                    h.Type('button'),
                                    h.Class(
                                      `theme-preset-card theme-preset-card--${preset.id} relative grid min-h-28 gap-2 overflow-hidden rounded-m3-large border p-3 text-left [font:inherit] cursor-pointer focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-2 ${
                                        isSelected
                                          ? 'border-primary shadow-[0_0_0_2px_var(--md-sys-color-primary)]'
                                          : 'border-outline-variant'
                                      }`,
                                    ),
                                    h.OnClick(ChangedThemePreset({ value: preset.id })),
                                    h.AriaPressed(String(isSelected)),
                                  ],
                                  [
                                    h.span(
                                      [
                                        h.Class(
                                          'theme-preset-card__swatch h-10 rounded-m3-medium border border-black/10',
                                        ),
                                        h.AriaHidden(true),
                                      ],
                                      [],
                                    ),
                                    h.span(
                                      [h.Class('flex items-center justify-between gap-2')],
                                      [
                                        h.span(
                                          [h.Class('font-[800]')],
                                          [themePresetName(locale, preset.id)],
                                        ),
                                        isSelected
                                          ? icon<Message>(
                                              'check',
                                              'block size-5 text-primary [&_svg]:block [&_svg]:size-full',
                                            )
                                          : h.empty,
                                      ],
                                    ),
                                    h.span(
                                      [h.Class('text-xs text-on-surface-variant leading-[1.4]')],
                                      [themePresetDescription(locale, preset.id)],
                                    ),
                                  ],
                                );
                              }),
                            ),
                            h.div(
                              [
                                h.Class('grid gap-2 pt-1'),
                                h.Role('group'),
                                h.AriaLabel(translate(locale, 'appearance.mode')),
                              ],
                              [
                                h.h3(
                                  [h.Class('text-sm font-[800]')],
                                  [translate(locale, 'appearance.mode')],
                                ),
                                h.div(
                                  [
                                    h.Class(
                                      'grid grid-cols-3 overflow-hidden rounded-m3-medium border border-outline',
                                    ),
                                  ],
                                  colorModes.map((mode) =>
                                    h.button(
                                      [
                                        h.Type('button'),
                                        h.Class(
                                          `min-h-11 border-0 border-r border-outline last:border-r-0 [font:inherit] font-[750] cursor-pointer ${
                                            preference.mode === mode
                                              ? 'bg-primary text-on-primary'
                                              : 'bg-surface-container text-on-surface'
                                          }`,
                                        ),
                                        h.OnClick(ChangedColorMode({ value: mode })),
                                        h.AriaPressed(String(preference.mode === mode)),
                                      ],
                                      [colorModeLabel(locale, mode)],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        h.div(
                          [h.Class('grid content-start gap-3')],
                          [
                            themePreview(locale),
                            h.button(
                              [
                                h.Type('button'),
                                h.Class(buttonSecondary),
                                h.OnClick(ResetThemePreference()),
                              ],
                              [translate(locale, 'appearance.reset')],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => GotAppearanceDialogMessage({ message }),
  });
};

const selectControl = (
  fields: Model['selectFields'],
  id: SelectControlId,
  label: string,
  value: string,
  options: ReadonlyArray<readonly [string, string, AppIcon?]>,
  config: Readonly<{ compact?: boolean; portal?: boolean }> = {},
): Html =>
  selectField<Message>({
    model: selectFieldModel(fields, id),
    label,
    value,
    options: options.map(
      ([optionValue, optionLabel, optionIcon]): SelectOption => ({
        value: optionValue,
        label: optionLabel,
        ...(optionIcon === undefined ? {} : { icon: optionIcon }),
      }),
    ),
    ...(config.compact === undefined ? {} : { compact: config.compact }),
    ...(config.portal === undefined ? {} : { portal: config.portal }),
    toParentMessage: (message) => GotSelectFieldMessage({ id, message }),
  });

const languageSelectControl = (
  fields: Model['selectFields'],
  id: 'language-desktop' | 'language-mobile',
  locale: Locale,
  compact = false,
): Html =>
  selectControl(
    fields,
    id,
    translate(locale, 'locale.label'),
    locale,
    [
      ['en', compact ? 'EN' : translate(locale, 'locale.en')],
      ['nb', compact ? 'NO' : translate(locale, 'locale.nb')],
    ],
    { compact },
  );

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
          h.h2([h.Class(stateCardH2Class)], [translate(model.locale, 'catalogue.loading')]),
          h.p([h.Class(stateCardPClass)], [translate(model.locale, 'catalogue.loadingHelp')]),
        ],
      );
    case 'CatalogueFailure':
      return h.section(
        [h.Class(stateCardFailure), h.Role('alert')],
        [
          h.p([h.Class(statusLabelErrorClass)], [translate(model.locale, 'catalogue.unavailable')]),
          h.h2([h.Class(stateCardH2Class)], [translate(model.locale, 'catalogue.loadFailed')]),
          h.p([h.Class(stateCardFailurePClass)], [model.catalogue.error]),
          h.p([h.Class(stateCardFailurePClass)], [translate(model.locale, 'catalogue.retry')]),
        ],
      );
    case 'CatalogueEmpty':
      return h.section(
        [h.Class(stateCardBase), h.Role('status')],
        [
          h.h2([h.Class(stateCardH2Class)], [translate(model.locale, 'catalogue.empty')]),
          h.p([h.Class(stateCardPClass)], [translate(model.locale, 'catalogue.emptyHelp')]),
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
      h.AriaLabel(translate(model.locale, 'catalogue.results')),
      h.AriaBusy(model.nextPage._tag === 'NextPageLoading'),
    ],
    [
      partial
        ? h.div(
            [
              h.Class('py-4 px-5 rounded-m3-medium bg-warning-container text-on-warning-container'),
              h.Role('status'),
            ],
            [translate(model.locale, 'catalogue.partial')],
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
              h.h2([], [translate(model.locale, 'catalogue.courses')]),
              h.p(
                [h.AriaLive('polite'), h.Class('text-on-surface-variant text-[0.88rem]')],
                [
                  translate(model.locale, 'catalogue.showing', {
                    shown: shown.length,
                    total: response.meta.total,
                  }),
                ],
              ),
            ],
          ),
          h.p(
            [h.Class('text-on-surface-variant text-[0.88rem]')],
            [translate(model.locale, 'catalogue.official')],
          ),
        ],
      ),
      h.ol(
        [h.Class('grid gap-3 p-0 list-none')],
        shown.map((course) =>
          lazyCourseCard(course.courseKey, courseCard, [
            normalizedUrl(model, course.code),
            course,
            decisionSignalForCourse(model.decisionSignals, course.code),
            gradeSignalForCourse(model.gradeSignals, course.code),
            model.locale,
            model.outcomeView,
          ]),
        ),
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
              h.strong([], [translate(model.locale, 'catalogue.moreFailed')]),
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
                    ? translate(model.locale, 'catalogue.loadingMore')
                    : translate(model.locale, 'catalogue.showMore'),
                ],
              ),
          })
        : h.p(
            [h.Class('m-0 text-on-surface-variant text-center')],
            [translate(model.locale, 'catalogue.end')],
          ),
    ],
  );
};

const courseCardClass =
  'relative grid gap-4 p-[1.1rem] border border-outline-variant rounded-m3-large bg-surface-container-low [transition:border-color_140ms_ease,box-shadow_140ms_ease] has-[a:hover]:border-primary has-[a:hover]:shadow-m3-1 has-[a:focus-visible]:border-primary has-[a:focus-visible]:shadow-m3-1 [@media(min-width:64rem)]:items-stretch [@media(min-width:64rem)]:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.65fr)]';

const factDtClass = 'text-current text-[0.75rem] font-[750] tracking-[0.05em] uppercase';

const factDdClass = 'mt-[0.2rem] text-[0.9rem] leading-[1.35] [overflow-wrap:anywhere]';

type GradeSignal =
  | CourseGradeSummaryDtoType
  | 'loading'
  | 'failure'
  | 'idle'
  | 'missing'
  | 'partial-missing';

type DecisionSignal = CourseDecisionSignalsDtoType | 'loading' | 'failure' | 'idle' | 'missing';

const decisionSignalForCourse = (
  state: DecisionSignalsResult,
  courseCode: string,
): DecisionSignal => {
  const signals = decisionSignalsResponse(state)?.items.find(
    (item) => item.courseCode === courseCode,
  );
  if (signals !== undefined) return signals;
  return M.value(state._tag).pipe(
    M.when('DecisionSignalsLoading', () => 'loading' as const),
    M.when('DecisionSignalsFailure', () => 'failure' as const),
    M.when('DecisionSignalsIdle', () => 'idle' as const),
    M.when('DecisionSignalsSuccess', () => 'missing' as const),
    M.exhaustive,
  );
};

const gradeSignalForCourse = (state: GradeSignalsResult, courseCode: string): GradeSignal => {
  const summary = gradeSignalsResponse(state)?.items.find((item) => item.courseCode === courseCode);
  if (summary !== undefined) return summary;
  return M.value(state._tag).pipe(
    M.when('GradeSignalsLoading', () => 'loading' as const),
    M.when('GradeSignalsFailure', () => 'failure' as const),
    M.when('GradeSignalsIdle', () => 'idle' as const),
    M.when('GradeSignalsSuccess', () => 'missing' as const),
    M.when('GradeSignalsPartial', () => 'partial-missing' as const),
    M.exhaustive,
  );
};

const factStateLabel = (state: string, locale: Locale): string => translateToken(locale, state);

const courseCard = (
  href: string,
  course: CourseSearchItemDtoType,
  decisionSignal: DecisionSignal,
  gradeSignal: GradeSignal,
  locale: Locale,
  outcomeView: OutcomeView,
): Html => {
  const h = html<Message>();
  const title =
    course.title.state === 'known'
      ? course.title.value
      : translate(locale, 'course.titleUnavailable');
  const offering =
    course.offerings.state === 'known' && course.offerings.value.length > 0
      ? (course.offerings.value[0] ?? null)
      : null;
  const place =
    offering === null
      ? course.offerings.state === 'known'
        ? translate(locale, 'course.campusUnreported')
        : factStateLabel(course.offerings.state, locale)
      : offering.campuses.length === 0
        ? translate(locale, 'course.campusUnreported')
        : offering.campuses.join(', ');
  const term =
    offering === null
      ? course.offerings.state === 'known'
        ? translate(locale, 'course.termUnavailable')
        : factStateLabel(course.offerings.state, locale)
      : formatOfferingPeriod(offering.academicYear, offering.season, locale);
  const creditsFact =
    typeof decisionSignal !== 'string' && decisionSignal.credits.state === 'known'
      ? decisionSignal.credits
      : course.credits;
  const credits =
    creditsFact.state === 'known'
      ? translate(locale, 'course.creditsValue', {
          value: new Intl.NumberFormat(localeTag(locale), {
            maximumFractionDigits: 1,
          }).format(creditsFact.value),
        })
      : factStateLabel(creditsFact.state, locale);
  return h.li(
    [],
    [
      h.article(
        [h.Class(courseCardClass)],
        [
          h.div(
            [
              h.Class(
                'grid min-w-0 content-start gap-3 [@media(min-width:64rem)]:pr-5 [@media(min-width:64rem)]:border-r [@media(min-width:64rem)]:border-outline-variant',
              ),
            ],
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
                          h.Href(href),
                          h.AriaLabel(
                            translate(locale, 'course.open', { code: course.code, title }),
                          ),
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
                [h.Class('grid gap-x-4 gap-y-3 grid-cols-2')],
                [
                  h.div(
                    [h.Class('min-w-0')],
                    [
                      h.dt([h.Class(factDtClass)], [translate(locale, 'detail.credits')]),
                      h.dd([h.Class(factDdClass)], [credits]),
                    ],
                  ),
                  h.div(
                    [h.Class('min-w-0')],
                    [
                      h.dt([h.Class(factDtClass)], [translate(locale, 'course.termFact')]),
                      h.dd(
                        [h.Class(`${factDdClass} inline-flex items-start gap-1.5`)],
                        [
                          offering === null
                            ? h.empty
                            : icon<Message>(
                                termSeasonIconName(offering.season),
                                'mt-0.5 block size-4 flex-none text-primary [&_svg]:block [&_svg]:size-full',
                              ),
                          h.span([], [term]),
                        ],
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class('min-w-0')],
                    [
                      h.dt([h.Class(factDtClass)], [translate(locale, 'course.campusFact')]),
                      h.dd([h.Class(factDdClass)], [place]),
                    ],
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                'grid min-w-0 gap-3 [@media(min-width:80rem)]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]',
              ),
            ],
            [
              decisionSignalView(decisionSignal, locale),
              gradeSignalView(gradeSignal, locale, outcomeView),
            ],
          ),
        ],
      ),
    ],
  );
};

type AssessmentForm =
  | 'written-exam'
  | 'oral-exam'
  | 'home-exam'
  | 'project'
  | 'portfolio'
  | 'practical'
  | 'assignment'
  | 'other';

const assessmentIconName = (form: AssessmentForm): AppIcon =>
  M.value(form).pipe(
    M.when('written-exam', () => 'assessment-written' as const),
    M.when('oral-exam', () => 'assessment-oral' as const),
    M.when('home-exam', () => 'assessment-home-exam' as const),
    M.when('project', () => 'assessment-project' as const),
    M.when('portfolio', () => 'assessment-portfolio' as const),
    M.when('practical', () => 'assessment-practical' as const),
    M.when('assignment', () => 'assessment-assignment' as const),
    M.when('other', () => 'assessment-other' as const),
    M.exhaustive,
  );

const assessmentLabel = (form: AssessmentForm, locale: Locale): string =>
  M.value(form).pipe(
    M.when('written-exam', () => translate(locale, 'signals.writtenExam')),
    M.when('oral-exam', () => translate(locale, 'signals.oralExam')),
    M.when('home-exam', () => translate(locale, 'signals.homeExam')),
    M.when('project', () => translate(locale, 'signals.project')),
    M.when('portfolio', () => translate(locale, 'signals.portfolio')),
    M.when('practical', () => translate(locale, 'signals.practical')),
    M.when('assignment', () => translate(locale, 'signals.assignment')),
    M.when('other', () => translate(locale, 'signals.otherAssessment')),
    M.exhaustive,
  );

const collaborationLabel = (
  collaboration: 'individual' | 'group' | 'mixed',
  locale: Locale,
): string =>
  M.value(collaboration).pipe(
    M.when('individual', () => translate(locale, 'signals.individual')),
    M.when('group', () => translate(locale, 'signals.group')),
    M.when('mixed', () => translate(locale, 'signals.mixedCollaboration')),
    M.exhaustive,
  );

const formatAssessmentWeight = (value: number, locale: Locale): string =>
  `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 2 }).format(value)}%`;

const decisionSignalView = (signal: DecisionSignal, locale: Locale): Html => {
  const h = html<Message>();
  const stateClass =
    '@container grid min-w-0 content-start gap-3 p-3 rounded-m3-medium bg-secondary-container text-on-secondary-container';
  if (typeof signal === 'string') {
    const message = M.value(signal).pipe(
      M.when('loading', () => translate(locale, 'signals.checking')),
      M.when('failure', () => translate(locale, 'signals.failed')),
      M.when('idle', () => translate(locale, 'signals.waiting')),
      M.when('missing', () => translateToken(locale, 'unknown')),
      M.exhaustive,
    );
    return h.div(
      [h.Class(`${stateClass} bg-surface-container text-on-surface-variant`)],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'signals.heading')]),
        h.p([h.Class('m-0 text-[0.84rem] leading-[1.4]')], [message]),
      ],
    );
  }

  if (signal.sourceStatus.status === 'failed') {
    return h.div(
      [h.Class(`${stateClass} bg-surface-container text-on-surface-variant`)],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'signals.heading')]),
        h.p([h.Class('m-0 text-[0.84rem] leading-[1.4]')], [translate(locale, 'signals.failed')]),
      ],
    );
  }

  const parts = signal.assessment.state === 'known' ? signal.assessment.value : [];
  const hasProportionalWeights =
    parts.length > 1 &&
    parts.every((part) => part.weightPercent.state === 'known') &&
    parts.reduce(
      (total, part) =>
        total + (part.weightPercent.state === 'known' ? part.weightPercent.value : 0),
      0,
    ) > 0;
  const assessmentPart = (part: (typeof parts)[number], index: number, grouped: boolean): Html => {
    const label = assessmentLabel(part.form, locale);
    const weight =
      part.weightPercent.state === 'known'
        ? formatAssessmentWeight(part.weightPercent.value, locale)
        : null;
    const accessibleLabel =
      weight === null ? label : `${label}, ${weight} ${translate(locale, 'signals.graded')}`;
    return h.li(
      [
        h.Class(
          grouped
            ? `flex w-full items-center justify-between gap-2 bg-secondary px-3 py-2 text-left text-on-secondary text-[0.76rem] font-[750] leading-[1.25] @min-[28rem]:w-auto @min-[28rem]:justify-center @min-[28rem]:px-2.5 @min-[28rem]:py-1.5 @min-[28rem]:text-center ${
                index === 0
                  ? ''
                  : 'border-t border-on-secondary/30 @min-[28rem]:border-t-0 @min-[28rem]:border-l'
              }`
            : 'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-on-secondary text-[0.76rem] font-[750]',
        ),
        ...(grouped
          ? [
              h.Style({
                flexGrow:
                  hasProportionalWeights && part.weightPercent.state === 'known'
                    ? String(part.weightPercent.value)
                    : '1',
              }),
            ]
          : []),
        h.Title(accessibleLabel),
        h.AriaLabel(accessibleLabel),
      ],
      [
        icon<Message>(
          assessmentIconName(part.form),
          'block size-4 shrink-0 [&_svg]:block [&_svg]:size-full',
        ),
        h.span([h.Class('flex-1 @min-[28rem]:flex-none')], [label]),
        weight === null ? h.empty : h.span([h.Class('shrink-0 font-[850] tabular-nums')], [weight]),
      ],
    );
  };
  const assessment =
    signal.assessment.state === 'known'
      ? parts.length === 0
        ? h.p([h.Class('m-0 text-[0.84rem]')], [translate(locale, 'signals.noneReported')])
        : parts.length === 1
          ? h.ul([h.Class('flex flex-wrap p-0 list-none')], [assessmentPart(parts[0]!, 0, false)])
          : h.ul(
              [
                h.Class(
                  'flex w-full max-w-full flex-col overflow-hidden rounded-m3-medium border border-secondary p-0 list-none @min-[28rem]:flex-row @min-[28rem]:rounded-full',
                ),
                h.AriaLabel(translate(locale, 'signals.gradedAssessment')),
              ],
              parts.map((part, index) => assessmentPart(part, index, true)),
            )
      : h.p([h.Class('m-0 text-[0.84rem]')], [factStateLabel(signal.assessment.state, locale)]);
  const obligatory =
    signal.obligatoryActivities.state === 'known'
      ? signal.obligatoryActivities.value.length > 0
        ? h.div(
            [h.Class('flex flex-wrap items-center gap-1.5')],
            [
              h.span(
                [
                  h.Class(
                    'inline-flex min-h-7 items-center rounded-full bg-constraint px-2.5 text-[0.75rem] font-[800] text-on-constraint',
                  ),
                ],
                [translate(locale, 'signals.required')],
              ),
              h.span(
                [
                  h.Class(
                    'inline-flex min-h-7 items-center rounded-full bg-surface-container-highest px-2.5 text-[0.75rem] font-[800] text-on-surface-variant',
                  ),
                ],
                [translate(locale, 'signals.ungraded')],
              ),
              h.span(
                [h.Class('text-[0.78rem] font-[700]')],
                [
                  signal.obligatoryActivities.value.length === 1
                    ? translate(locale, 'signals.oneActivity')
                    : translate(locale, 'signals.activityCount', {
                        count: signal.obligatoryActivities.value.length,
                      }),
                ],
              ),
            ],
          )
        : h.p(
            [h.Class('m-0 text-[0.84rem] font-[700]')],
            [translate(locale, 'signals.noneReported')],
          )
      : h.p(
          [h.Class('m-0 text-[0.84rem] font-[700]')],
          [factStateLabel(signal.obligatoryActivities.state, locale)],
        );
  const collaboration =
    signal.collaboration.state === 'known'
      ? h.span(
          [
            h.Class(
              'inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-container-highest px-2.5 text-[0.76rem] font-[800] text-on-surface',
            ),
          ],
          [
            icon<Message>(
              collaborationIconName(signal.collaboration.value),
              'block size-4 flex-none [&_svg]:block [&_svg]:size-full',
            ),
            collaborationLabel(signal.collaboration.value, locale),
          ],
        )
      : h.span([], [factStateLabel(signal.collaboration.state, locale)]);
  const inferred = signal.evidence.some((evidence) => evidence.kind === 'inference');
  const factRowClass =
    'grid gap-1.5 @min-[24rem]:grid-cols-[minmax(7.5rem,0.8fr)_minmax(0,1fr)] @min-[24rem]:gap-3';

  return h.div(
    [h.Class(stateClass)],
    [
      h.div(
        [h.Class('flex items-baseline justify-between gap-3')],
        [
          h.p([h.Class(factDtClass)], [translate(locale, 'signals.heading')]),
          inferred
            ? h.p(
                [
                  h.Class('m-0 shrink-0 text-[0.68rem] font-[750]'),
                  h.Title(translate(locale, 'signals.inferred')),
                ],
                [translate(locale, 'detail.inferred')],
              )
            : h.empty,
        ],
      ),
      h.dl(
        [h.Class('grid gap-2.5')],
        [
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'signals.gradedAssessment')]),
              h.dd([h.Class('m-0 min-w-0')], [assessment]),
            ],
          ),
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'signals.obligatory')]),
              h.dd([h.Class('m-0')], [obligatory]),
            ],
          ),
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'detail.collaboration')]),
              h.dd([h.Class('m-0 text-[0.84rem] font-[700]')], [collaboration]),
            ],
          ),
        ],
      ),
    ],
  );
};

const outcomeStateClass =
  'grid gap-2 min-w-0 p-3 rounded-m3-medium bg-primary-container text-on-primary-container';

const gradeSignalView = (signal: GradeSignal, locale: Locale, outcomeView: OutcomeView): Html => {
  if (typeof signal !== 'string') return gradeSummaryView(signal, locale, outcomeView);
  const h = html<Message>();
  const message = M.value(signal).pipe(
    M.when('loading', () => translate(locale, 'outcomes.checking')),
    M.when('failure', () => translate(locale, 'outcomes.failed')),
    M.when('idle', () => translate(locale, 'outcomes.waiting')),
    M.when('missing', () => translate(locale, 'outcomes.missing')),
    M.when('partial-missing', () => translate(locale, 'outcomes.missing')),
    M.exhaustive,
  );
  return h.div(
    [h.Class(`${outcomeStateClass} bg-surface-container text-on-surface-variant`)],
    [
      h.p([h.Class(factDtClass)], [translate(locale, 'outcomes.heading')]),
      h.p([h.Class('m-0 text-[0.88rem] leading-[1.4]')], [message]),
    ],
  );
};

const gradeOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const gradeDisplayLabel = (grade: string, locale: Locale): string =>
  M.value(grade).pipe(
    M.when('G', () => translate(locale, 'outcomes.pass')),
    M.when('H', () => translate(locale, 'outcomes.fail')),
    M.orElse(() => grade),
  );

const gradeScaleLabel = (scale: 'letter' | 'pass-fail' | 'mixed', locale: Locale): string =>
  M.value(scale).pipe(
    M.when('letter', () => translate(locale, 'outcomes.letter')),
    M.when('pass-fail', () => translate(locale, 'outcomes.passFail')),
    M.when('mixed', () => translate(locale, 'outcomes.mixed')),
    M.exhaustive,
  );

const formatPercentage = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 1 }).format(value);

const distributionStateMessage = (
  distribution: CourseGradeSummaryDtoType['distribution'],
  locale: Locale,
): string => {
  switch (distribution.state) {
    case 'known':
      return distribution.value.length === 0
        ? translate(locale, 'outcomes.noBuckets')
        : translate(locale, 'outcomes.available');
    case 'suppressed':
      return translate(locale, 'outcomes.protected');
    case 'conflicting':
      return translate(locale, 'outcomes.conflicting');
    case 'unknown':
      return translate(locale, 'outcomes.unknown');
    case 'unavailable':
      return translate(locale, 'outcomes.unavailable');
  }
};

type GradeBucket = {
  readonly grade: string;
  readonly count: number;
  readonly percentage: number;
};

const normalizeGradeBuckets = (buckets: ReadonlyArray<GradeBucket>): ReadonlyArray<GradeBucket> => {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total <= 0) return [];
  return buckets.map((bucket) => ({
    ...bucket,
    percentage: (bucket.count / total) * 100,
  }));
};

const gradeSummaryView = (
  summary: CourseGradeSummaryDtoType,
  locale: Locale,
  requestedView: OutcomeView,
): Html => {
  const h = html<Message>();
  const period =
    summary.period.state === 'known'
      ? `${summary.period.value.fromYear}–${summary.period.value.toYear}`
      : null;
  const sourceBuckets =
    summary.distribution.state === 'known'
      ? [...summary.distribution.value].sort(
          (left, right) =>
            gradeOrder.indexOf(left.grade as (typeof gradeOrder)[number]) -
            gradeOrder.indexOf(right.grade as (typeof gradeOrder)[number]),
        )
      : [];

  if (sourceBuckets.length === 0) {
    const sample =
      summary.sampleSize.state === 'known'
        ? translate(locale, 'outcomes.sample', {
            value: summary.sampleSize.value.toLocaleString(localeTag(locale)),
          })
        : null;
    const failure =
      summary.failureRatePercent.state === 'known'
        ? translate(locale, 'outcomes.failedRate', {
            value: formatPercentage(summary.failureRatePercent.value, locale),
          })
        : null;
    const metadata = [failure, sample, period].filter((value): value is string => value !== null);
    return h.div(
      [h.Class(`${outcomeStateClass} bg-surface-container text-on-surface-variant`)],
      [
        h.div(
          [h.Class('flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1')],
          [
            h.p([h.Class(factDtClass)], [translate(locale, 'outcomes.heading')]),
            h.p([h.Class('m-0 text-[0.72rem] font-[750]')], [translate(locale, 'outcomes.source')]),
          ],
        ),
        h.p(
          [h.Class('m-0 text-[0.88rem] leading-[1.4]')],
          [
            metadata.length === 0
              ? distributionStateMessage(summary.distribution, locale)
              : `${distributionStateMessage(summary.distribution, locale)} · ${metadata.join(' · ')}`,
          ],
        ),
      ],
    );
  }

  const letterBuckets = sourceBuckets.filter((bucket) => /^[A-F]$/.test(bucket.grade));
  const passFailBuckets = sourceBuckets.filter(
    (bucket) => bucket.grade === 'G' || bucket.grade === 'H',
  );
  const hasLetter = letterBuckets.some((bucket) => bucket.count > 0);
  const hasPassFail = passFailBuckets.some((bucket) => bucket.count > 0);
  const hasBothScales = hasLetter && hasPassFail;
  const selectedScale: OutcomeView = hasBothScales
    ? requestedView
    : hasPassFail
      ? 'pass-fail'
      : 'letter';
  const buckets = normalizeGradeBuckets(
    selectedScale === 'letter' ? letterBuckets : passFailBuckets,
  );
  const selectedSampleSize = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const failedGrade = selectedScale === 'letter' ? 'F' : 'H';
  const failedBucket = buckets.find((bucket) => bucket.grade === failedGrade);
  const failure =
    failedBucket === undefined
      ? null
      : translate(locale, 'outcomes.failedRate', {
          value: formatPercentage(failedBucket.percentage, locale),
        });
  const sample =
    selectedSampleSize > 0
      ? translate(locale, 'outcomes.sample', {
          value: selectedSampleSize.toLocaleString(localeTag(locale)),
        })
      : null;
  const metadata = [failure, sample, period].filter((value): value is string => value !== null);
  const scale = gradeScaleLabel(selectedScale, locale);
  const maxPercentage = Math.max(...buckets.map((bucket) => bucket.percentage), 1);
  const accessibleDistribution = buckets
    .map((bucket) =>
      translate(locale, 'outcomes.percent', {
        label: gradeDisplayLabel(bucket.grade, locale),
        value: formatPercentage(bucket.percentage, locale),
      }),
    )
    .join(', ');
  const accessibleSummary = `${scale}. ${accessibleDistribution}.${metadata.length === 0 ? '' : ` ${metadata.join(', ')}.`}`;
  const passBucket = buckets.find((bucket) => bucket.grade === 'G');
  const failBucket = buckets.find((bucket) => bucket.grade === 'H');
  const isPassFail =
    selectedScale === 'pass-fail' && passBucket !== undefined && failBucket !== undefined;
  const distributionChart = isPassFail
    ? (() => {
        const total = Math.max(passBucket.percentage + failBucket.percentage, 1);
        const passShare = Math.max(0, Math.min((passBucket.percentage / total) * 100, 100));
        const legendItem = (colorClass: string, label: string, percentage: number): Html =>
          h.div(
            [h.Class('grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-center gap-2')],
            [
              h.span([h.Class(`size-3 rounded-full ${colorClass}`)], []),
              h.span([h.Class('text-[0.78rem] font-[750]')], [label]),
              h.span(
                [h.Class('text-[0.78rem] font-[850] tabular-nums')],
                [`${formatPercentage(percentage, locale)}%`],
              ),
            ],
          );

        return h.div(
          [
            h.Class('grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-4 py-1'),
            h.AriaHidden(true),
          ],
          [
            h.div(
              [
                h.Class(
                  'grid size-19 place-items-center rounded-full shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--md-sys-color-outline-variant)_65%,transparent)]',
                ),
                h.Style({
                  backgroundImage: `conic-gradient(var(--color-valid) 0 ${passShare}%, var(--color-danger) ${passShare}% 100%)`,
                }),
              ],
              [h.span([h.Class('size-11 rounded-full bg-primary-container')], [])],
            ),
            h.div(
              [h.Class('grid gap-2')],
              [
                legendItem(
                  'bg-valid',
                  gradeDisplayLabel(passBucket.grade, locale),
                  passBucket.percentage,
                ),
                legendItem(
                  'bg-danger',
                  gradeDisplayLabel(failBucket.grade, locale),
                  failBucket.percentage,
                ),
              ],
            ),
          ],
        );
      })()
    : h.div(
        [
          h.Class('grid items-end gap-x-1 gap-y-1'),
          h.Style({
            gridTemplateColumns: `repeat(${buckets.length}, minmax(1.75rem, 1fr))`,
          }),
          h.AriaHidden(true),
        ],
        [
          ...buckets.map((bucket) =>
            h.div(
              [
                h.Class('flex h-14 items-end justify-center'),
                h.Title(
                  translate(locale, 'outcomes.percent', {
                    label: gradeDisplayLabel(bucket.grade, locale),
                    value: formatPercentage(bucket.percentage, locale),
                  }),
                ),
              ],
              [
                h.span(
                  [
                    h.Class(
                      `block min-h-1 w-[clamp(0.6rem,48%,1.35rem)] rounded-t-sm ${
                        bucket.grade === 'F' || bucket.grade === 'H' ? 'bg-danger' : 'bg-valid'
                      }`,
                    ),
                    h.Style({
                      height: `${Math.max((bucket.percentage / maxPercentage) * 100, 4)}%`,
                    }),
                  ],
                  [],
                ),
              ],
            ),
          ),
          ...buckets.map((bucket) =>
            h.span(
              [h.Class('text-center text-[0.72rem] font-[850] leading-none')],
              [gradeDisplayLabel(bucket.grade, locale)],
            ),
          ),
        ],
      );

  const toggle = hasBothScales
    ? h.div(
        [
          h.Class(
            'grid grid-cols-2 overflow-hidden rounded-full border border-outline bg-surface-container-low',
          ),
          h.Role('group'),
          h.AriaLabel(translate(locale, 'outcomes.view')),
        ],
        (['letter', 'pass-fail'] as const).map((view) =>
          h.button(
            [
              h.Type('button'),
              h.Class(
                `min-h-9 cursor-pointer border-0 px-3 text-[0.75rem] font-[800] ${
                  selectedScale === view
                    ? 'bg-primary text-on-primary'
                    : 'bg-transparent text-on-surface-variant'
                }`,
              ),
              h.AriaPressed(String(selectedScale === view)),
              h.OnClick(ChangedOutcomeView({ value: view })),
            ],
            [gradeScaleLabel(view, locale)],
          ),
        ),
      )
    : h.empty;

  return h.div(
    [h.Class(outcomeStateClass)],
    [
      h.div(
        [h.Class('flex flex-wrap items-start justify-between gap-x-3 gap-y-1')],
        [
          h.div(
            [h.Class('grid gap-0.5')],
            [
              h.p([h.Class(factDtClass)], [translate(locale, 'outcomes.heading')]),
              h.p([h.Class('m-0 text-[0.78rem] font-[750]')], [scale]),
            ],
          ),
          h.span(
            [h.Class('text-[0.72rem] font-[800] tracking-[0.04em] uppercase')],
            [translate(locale, 'outcomes.source')],
          ),
        ],
      ),
      toggle,
      h.figure(
        [
          h.Class('grid gap-2 m-0'),
          h.Role('img'),
          h.AriaLabel(translate(locale, 'outcomes.chartLabel', { summary: accessibleSummary })),
        ],
        [
          distributionChart,
          metadata.length === 0
            ? h.empty
            : h.p(
                [h.Class('m-0 text-[0.75rem] font-[650] leading-[1.35]')],
                [metadata.join(' · ')],
              ),
        ],
      ),
    ],
  );
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
          h.button(
            [...attributes.button, h.Class(backButtonClass)],
            [translate(model.locale, 'course.back')],
          ),
      }),
      detailResultView(model.detail, model.locale),
      lazyDetailFooter(productFooter, [model.locale, model.selectFields]),
    ],
  );
};

const productFooter = (locale: Locale, selectFields: Model['selectFields']): Html => {
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
          translate(locale, 'footer.licensePrefix'),
          externalLink(
            'https://www.gnu.org/licenses/agpl-3.0.html',
            translate(locale, 'footer.licenseName'),
          ),
          translate(locale, 'footer.licenseSuffix'),
        ],
      ),
      ...(sourceUrl === null
        ? []
        : [h.p([], [externalLink(sourceUrl, translate(locale, 'footer.source'))])]),
      ...(tipUrl === null
        ? []
        : [
            h.p(
              [],
              [
                translate(locale, 'footer.useful'),
                externalLink(tipUrl, translate(locale, 'footer.tip')),
                translate(locale, 'footer.optional'),
              ],
            ),
          ]),
      h.div(
        [h.Class('w-full [@media(min-width:48rem)_and_(min-height:34rem)]:hidden')],
        [
          selectControl(
            selectFields,
            'language-mobile',
            translate(locale, 'locale.label'),
            locale,
            [
              ['en', translate(locale, 'locale.en')],
              ['nb', translate(locale, 'locale.nb')],
            ],
          ),
        ],
      ),
    ],
  );
};

const detailResultView = (detail: DetailResult, locale: Locale): Html => {
  const h = html<Message>();
  switch (detail._tag) {
    case 'DetailClosed':
      return h.empty;
    case 'DetailLoading':
      return h.section(
        [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
          h.h2([h.Class(stateCardH2Class)], [translate(locale, 'detail.loading')]),
          h.p([h.Class(stateCardPClass)], [translate(locale, 'detail.loadingHelp')]),
        ],
      );
    case 'DetailFailure':
      return h.section(
        [h.Class(stateCardFailure), h.Role('alert')],
        [
          h.p([h.Class(statusLabelErrorClass)], [translate(locale, 'detail.unavailable')]),
          h.h2([h.Class(stateCardH2Class)], [translate(locale, 'detail.loadFailed')]),
          h.p([h.Class(stateCardFailurePClass)], [detail.error]),
        ],
      );
    case 'DetailPartial':
      return courseInsightView(detail.response, true, locale);
    case 'DetailSuccess':
      return courseInsightView(detail.response, false, locale);
  }
};

const formatOfferingPeriod = (academicYear: number, season: string, locale: Locale): string => {
  const academicYearLabel = `${academicYear}/${String(academicYear + 1).slice(-2)}`;
  if (season === 'full-year') {
    return translate(locale, 'offering.academicYear', { year: academicYearLabel });
  }
  const calendarYear = season === 'autumn' ? academicYear : academicYear + 1;
  return `${translateToken(locale, season)} ${calendarYear} · ${academicYearLabel}`;
};
