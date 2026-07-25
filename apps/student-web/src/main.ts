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

import { Button, Checkbox, Dialog, Input, RadioGroup } from '@foldkit/ui';

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
  LabelMembershipSchema,
  LabelPredicateSchema,
  SavedCourseSchema,
  SavedListLoadSchema,
  SavedListStateSchema,
  attachLabel,
  createLabel,
  defaultLabelColor,
  deleteLabel,
  detachLabel,
  editLabel,
  emptyLabelFilter,
  filterLabel,
  compareCourses,
  compareMaximum,
  compareMinimum,
  compareSelection,
  filterSavedCourses,
  filterUnlabeled,
  findLabel,
  hasLabel,
  isLabelFilterActive,
  labelColors,
  labelCourseCount,
  labelFilterModes,
  labelRejections,
  labelsByName,
  labelsForSavedCourse,
  labelsMaxCount,
  normalizeLabelFilter,
  setLabelFilterMode,
  setPredicateExcluded,
  setPredicateIncluded,
  unlabeledCourseCount,
  validateLabelEdit,
  validateNewLabel,
  type Label,
  type LabelColor,
  type LabelFilter,
  type LabelFilterMode,
  type LabelPredicate,
  type LabelRejection,
  type LabelResult,
  courseIdentity,
  emptySavedList,
  findSavedCourse,
  isSaved,
  membershipsForSavedCourse,
  parseSavedList,
  removeSavedCourse,
  restoreSavedCourse,
  saveCourse,
  savedCoursesNewestFirst,
  savedListStorageKey,
  serializeSavedList,
  setSavedCourseNote,
  type CourseIdentity,
  type SavedCourse,
  type SavedListState,
} from './saved-courses';
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
const EXPLORE_PATH = '/';
const LIST_PATH = '/list';
const APPEARANCE_PATH = '/appearance';
const LEGACY_LIST_APPEARANCE_PATH = '/list/appearance';
const listDensityStorageKey = 'course-lens:list-density';
const lazyCourseCard = createKeyedLazy();
const lazySavedCourseRow = createKeyedLazy();
const lazyDesktopNavigation = createLazy();
const lazyMobileNavigation = createLazy();
const lazyCatalogueHeader = createLazy();
const lazyCatalogueControls = createLazy();
const lazyCatalogueRefineDialog = createLazy();
const lazyAppearancePage = createLazy();
const lazyProductFooter = createLazy();
const lazyListHeader = createLazy();

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

/**
 * Student-owned saved state is explicit in the model. It is loaded through a
 * Command, never read or written while updating, and an unreadable stored
 * value becomes a visible recovery state instead of an empty list.
 */
export const SavedCoursesLoading = ts('SavedCoursesLoading');
export const SavedCoursesReady = ts('SavedCoursesReady', {
  state: SavedListStateSchema,
  repairedEntries: S.Number,
});
export const SavedCoursesRecovery = ts('SavedCoursesRecovery', {
  reason: S.Literals(['unavailable', 'unsupported-version', 'invalid-json', 'unreadable']),
  storedVersion: S.NullOr(S.Number),
  raw: S.String,
});
const SavedCoursesResultSchema = S.Union([
  SavedCoursesLoading,
  SavedCoursesReady,
  SavedCoursesRecovery,
]);
type SavedCoursesResult = typeof SavedCoursesResultSchema.Type;

/**
 * Whether Save/Remove can act right now. `SavedCoursesLoading` is transient
 * and reads as "still loading"; a recovery state is not transient and reads
 * as "paused" with a path to List instead, so the two never share a message.
 */
const savedToggleAvailability = (result: SavedCoursesResult): 'ready' | 'loading' | 'paused' =>
  M.value(result._tag).pipe(
    M.when('SavedCoursesReady', () => 'ready' as const),
    M.when('SavedCoursesLoading', () => 'loading' as const),
    M.when('SavedCoursesRecovery', () => 'paused' as const),
    M.exhaustive,
  );

/**
 * A single ephemeral snapshot of the most recent Save or Remove, kept only to
 * drive the ` · Undo` confirmation. It is never persisted: Dismiss and a
 * later action simply replace it.
 */
export const SavedActionSaved = ts('SavedActionSaved', { courseCode: S.String });
export const SavedActionRemoved = ts('SavedActionRemoved', {
  courses: S.Array(SavedCourseSchema),
  memberships: S.Array(LabelMembershipSchema),
});
const SavedListNoticeSchema = S.Union([SavedActionSaved, SavedActionRemoved]);
type SavedListNotice = typeof SavedListNoticeSchema.Type;

/**
 * How many undoable actions stay offered at once. Each carries the snapshot
 * needed to reverse it, so the queue is bounded rather than a history: past
 * the third, the oldest snapshot is dropped instead of being kept forever.
 */
const savedListNoticeLimit = 3;

/**
 * A notice is keyed by what happened, so repeating an action refreshes its
 * notice rather than stacking a second copy of the same sentence.
 */
const savedListNoticeKey = (notice: SavedListNotice): string =>
  notice._tag === 'SavedActionSaved'
    ? `saved:${notice.courseCode}`
    : `removed:${notice.courses.map((course) => course.courseCode).join(',')}`;

const withNotice = (
  notices: ReadonlyArray<SavedListNotice>,
  notice: SavedListNotice,
): ReadonlyArray<SavedListNotice> =>
  [
    notice,
    ...notices.filter((existing) => savedListNoticeKey(existing) !== savedListNoticeKey(notice)),
  ].slice(0, savedListNoticeLimit);

const withoutNotice = (
  notices: ReadonlyArray<SavedListNotice>,
  key: string,
): ReadonlyArray<SavedListNotice> => notices.filter((notice) => savedListNoticeKey(notice) !== key);

const NoteDraftSchema = S.Struct({ courseCode: S.String, value: S.String });

const LabelColorSchema = S.Literals(labelColors);

/**
 * The whole collection recipe: included labels combined by Any or All, minus
 * excluded labels. It is URL-backed interaction state, not student data, so a
 * shared link carries the recipe and never the saved set itself.
 */
const LabelFilterSchema = S.Struct({
  includeLabelIds: S.Array(S.String),
  includeUnlabeled: S.Boolean,
  includeMode: S.Literals(labelFilterModes),
  excludeLabelIds: S.Array(S.String),
  excludeUnlabeled: S.Boolean,
});

/**
 * What normalization had to change about a requested recipe. Kept explicitly
 * because the canonical rewrite removes the evidence from the filter itself,
 * and a silently shrunken filter would read as a provider failure.
 */
const LabelFilterNoticeSchema = S.Struct({
  unknownCount: S.Number,
  contradictoryLabelIds: S.Array(S.String),
  contradictoryUnlabeled: S.Boolean,
});

const LabelRejectionSchema = S.Literals(labelRejections);

const RouteSchema = S.Literals(['explore', 'list', 'appearance']);
type Route = typeof RouteSchema.Type;

/**
 * How much of each saved course a List row shows. It is a local display
 * preference: it changes nothing about the saved set, its labels, or the
 * collection recipe, so it stays out of the URL and out of student data.
 */
export const listDensities = ['card', 'compact'] as const;
const ListDensitySchema = S.Literals(listDensities);
export type ListDensity = typeof ListDensitySchema.Type;

export const Model = S.Struct({
  locale: LocaleSchema,
  route: RouteSchema,
  savedCourses: SavedCoursesResultSchema,
  savedListActions: S.Array(SavedListNoticeSchema),
  noteDrafts: S.Array(NoteDraftSchema),
  savedCoursesPersistFailed: S.Boolean,
  labelFilter: LabelFilterSchema,
  compareCodes: S.Array(S.String),
  labelFilterNotice: S.NullOr(LabelFilterNoticeSchema),
  selectedCourseCodes: S.Array(S.String),
  labelDialog: Dialog.Model,
  labelDialogTarget: S.Array(S.String),
  labelDraftName: S.String,
  labelDraftColor: LabelColorSchema,
  labelEditing: S.NullOr(S.String),
  labelPendingDelete: S.NullOr(S.String),
  /**
   * Removing several saved courses discards notes and labels that cannot be
   * retyped from the catalogue, so it asks first. One course does not: undo
   * already restores it, and a prompt for a reversible act just trains the
   * student to dismiss prompts.
   */
  selectionRemovePending: S.Boolean,
  /**
   * Difference-first is the default: a comparison exists to show what differs,
   * and a table repeating what is identical is the cards again.
   */
  compareDifferencesOnly: S.Boolean,
  labelError: S.NullOr(LabelRejectionSchema),
  listDensity: ListDensitySchema,
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
export const PersistedSidebarPreference = m('PersistedSidebarPreference');
export const FailedSidebarPreferencePersistence = m('FailedSidebarPreferencePersistence');
export const GotRefineDialogMessage = m('GotRefineDialogMessage', {
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
export const LoadedSavedCourses = m('LoadedSavedCourses', { load: SavedListLoadSchema });
export const FailedSavedCoursesLoad = m('FailedSavedCoursesLoad');
export const RequestedSaveCourse = m('RequestedSaveCourse', { courseCode: S.String });
export const StampedSavedCourse = m('StampedSavedCourse', {
  courseCode: S.String,
  savedAt: S.String,
});
export const RequestedRemoveSavedCourse = m('RequestedRemoveSavedCourse', {
  courseCode: S.String,
});
export const UpdatedSavedNoteDraft = m('UpdatedSavedNoteDraft', {
  courseCode: S.String,
  value: S.String,
});
export const SubmittedSavedNote = m('SubmittedSavedNote', { courseCode: S.String });
export const RequestedSavedCoursesReset = m('RequestedSavedCoursesReset');
export const PersistedSavedCourses = m('PersistedSavedCourses');
export const FailedSavedCoursesPersistence = m('FailedSavedCoursesPersistence');
export const RequestedUndoSavedListAction = m('RequestedUndoSavedListAction', {
  key: S.String,
});
export const DismissedSavedListAction = m('DismissedSavedListAction', { key: S.String });
export const DismissedAllSavedListActions = m('DismissedAllSavedListActions');
/**
 * Filter messages carry the state the student asked for, not a flip of
 * whatever the model holds when the message lands. A duplicate click, a
 * bubbled event, or a stale history echo therefore cannot undo a selection.
 */
export const ChangedLabelInclusion = m('ChangedLabelInclusion', {
  predicate: LabelPredicateSchema,
  isIncluded: S.Boolean,
});
export const ChangedLabelExclusion = m('ChangedLabelExclusion', {
  predicate: LabelPredicateSchema,
  isExcluded: S.Boolean,
});
export const ChangedLabelFilterMode = m('ChangedLabelFilterMode', {
  mode: S.Literals(labelFilterModes),
});
export const ClearedLabelFilter = m('ClearedLabelFilter');
export const ChangedListDensity = m('ChangedListDensity', { value: ListDensitySchema });
export const PersistedListDensity = m('PersistedListDensity');
export const FailedListDensityPersistence = m('FailedListDensityPersistence');
export const ToggledSavedCourseSelection = m('ToggledSavedCourseSelection', {
  courseCode: S.String,
  isSelected: S.Boolean,
});
export const ClearedSavedCourseSelection = m('ClearedSavedCourseSelection');
export const RequestedCompare = m('RequestedCompare');
export const ClosedCompare = m('ClosedCompare');
export const ToggledCompareDifferencesOnly = m('ToggledCompareDifferencesOnly', {
  differencesOnly: S.Boolean,
});
export const RequestedRemoveSelected = m('RequestedRemoveSelected');
export const CancelledRemoveSelected = m('CancelledRemoveSelected');
export const ConfirmedRemoveSelected = m('ConfirmedRemoveSelected');
export const RequestedLabelDialog = m('RequestedLabelDialog', {
  courseCodes: S.Array(S.String),
});
export const GotLabelDialogMessage = m('GotLabelDialogMessage', { message: Dialog.Message });
export const UpdatedLabelDraftName = m('UpdatedLabelDraftName', { value: S.String });
export const ChangedLabelDraftColor = m('ChangedLabelDraftColor', { value: LabelColorSchema });
export const SubmittedLabelForm = m('SubmittedLabelForm');
export const StampedLabel = m('StampedLabel', { labelId: S.String });
export const RequestedEditLabel = m('RequestedEditLabel', { labelId: S.String });
export const CancelledLabelEdit = m('CancelledLabelEdit');
export const RequestedDeleteLabel = m('RequestedDeleteLabel', { labelId: S.String });
export const ConfirmedDeleteLabel = m('ConfirmedDeleteLabel', { labelId: S.String });
export const CancelledLabelDelete = m('CancelledLabelDelete');
export const ToggledLabelOnTarget = m('ToggledLabelOnTarget', {
  labelId: S.String,
  isAttached: S.Boolean,
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
  PersistedSidebarPreference,
  FailedSidebarPreferencePersistence,
  GotRefineDialogMessage,
  ChangedThemePreset,
  ChangedColorMode,
  ResetThemePreference,
  PersistedThemePreference,
  FailedThemePreferencePersistence,
  GotSelectFieldMessage,
  LoadedSavedCourses,
  FailedSavedCoursesLoad,
  RequestedSaveCourse,
  StampedSavedCourse,
  RequestedRemoveSavedCourse,
  UpdatedSavedNoteDraft,
  SubmittedSavedNote,
  RequestedSavedCoursesReset,
  PersistedSavedCourses,
  FailedSavedCoursesPersistence,
  RequestedUndoSavedListAction,
  DismissedSavedListAction,
  DismissedAllSavedListActions,
  ChangedLabelInclusion,
  ChangedLabelExclusion,
  ChangedLabelFilterMode,
  ClearedLabelFilter,
  ChangedListDensity,
  PersistedListDensity,
  FailedListDensityPersistence,
  ToggledSavedCourseSelection,
  ClearedSavedCourseSelection,
  RequestedCompare,
  ClosedCompare,
  ToggledCompareDifferencesOnly,
  RequestedRemoveSelected,
  CancelledRemoveSelected,
  ConfirmedRemoveSelected,
  RequestedLabelDialog,
  GotLabelDialogMessage,
  UpdatedLabelDraftName,
  ChangedLabelDraftColor,
  SubmittedLabelForm,
  StampedLabel,
  RequestedEditLabel,
  CancelledLabelEdit,
  RequestedDeleteLabel,
  ConfirmedDeleteLabel,
  CancelledLabelDelete,
  ToggledLabelOnTarget,
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

export const PersistListDensity = Command.define(
  'PersistListDensity',
  { density: ListDensitySchema },
  PersistedListDensity,
  FailedListDensityPersistence,
)(({ density }) =>
  Effect.try({
    try: () => {
      localStorage.setItem(listDensityStorageKey, density);
    },
    catch: () => new Error('List density preference could not be persisted'),
  }).pipe(
    Effect.as(PersistedListDensity()),
    Effect.catch(() => Effect.succeed(FailedListDensityPersistence())),
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

/**
 * Local storage is untrusted input and an untrusted destination: reading and
 * writing the saved list happen here, at the application boundary, and every
 * failure path produces an explicit Message.
 */
export const LoadSavedCourses = Command.define(
  'LoadSavedCourses',
  LoadedSavedCourses,
  FailedSavedCoursesLoad,
)(
  Effect.try({
    try: () =>
      LoadedSavedCourses({ load: parseSavedList(localStorage.getItem(savedListStorageKey)) }),
    catch: () => new Error('Saved courses could not be read from this browser'),
  }).pipe(Effect.catch(() => Effect.succeed(FailedSavedCoursesLoad()))),
);

export const PersistSavedCourses = Command.define(
  'PersistSavedCourses',
  { state: SavedListStateSchema },
  PersistedSavedCourses,
  FailedSavedCoursesPersistence,
)(({ state }) =>
  Effect.try({
    try: () => {
      localStorage.setItem(savedListStorageKey, serializeSavedList(state));
    },
    catch: () => new Error('Saved courses could not be stored in this browser'),
  }).pipe(
    Effect.as(PersistedSavedCourses()),
    Effect.catch(() => Effect.succeed(FailedSavedCoursesPersistence())),
  ),
);

/**
 * Label identity comes from the boundary for the same reason the save
 * timestamp does: `update` stays a pure function of its inputs. The id is
 * opaque and stable, so renaming or recolouring a label never disturbs the
 * memberships or the shared filter recipe that point at it.
 */
const newLabelId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `label-${crypto.randomUUID()}`
    : `label-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;

export const StampLabel = Command.define(
  'StampLabel',
  StampedLabel,
)(Effect.sync(() => StampedLabel({ labelId: newLabelId() })));

/** The clock stays in the boundary; `update` receives an observed timestamp. */
export const StampSavedCourse = Command.define(
  'StampSavedCourse',
  { courseCode: S.String },
  StampedSavedCourse,
)(({ courseCode }) =>
  Effect.sync(() => StampedSavedCourse({ courseCode, savedAt: new Date().toISOString() })),
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

const normalizedUrl = (
  model: Model,
  selectedCode: string | null,
  pathname = EXPLORE_PATH,
): string => {
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
  // The collection recipe belongs to List. Explore URLs never carry it, so a
  // label change can never look like a catalogue change.
  if (pathname === LIST_PATH) {
    const filter = model.labelFilter;
    if (filter.includeLabelIds.length > 0) params.set('labels', filter.includeLabelIds.join(','));
    // `Unlabeled` is a derived predicate with no id, so it travels as its own
    // flag rather than as a reserved value inside the id list.
    if (filter.includeUnlabeled) params.set('unlabeled', '1');
    if (filter.includeMode !== 'any') params.set('labelMode', filter.includeMode);
    if (filter.excludeLabelIds.length > 0) {
      params.set('notLabels', filter.excludeLabelIds.join(','));
    }
    if (filter.excludeUnlabeled) params.set('notUnlabeled', '1');
    if (model.compareCodes.length > 0) params.set('compare', model.compareCodes.join(','));
  }
  const query = params.toString();
  return query.length === 0 ? pathname : `${pathname}?${query}`;
};

const parseLabelIds = (value: string | null): ReadonlyArray<string> =>
  value === null
    ? []
    : value
        .split(',')
        .map((labelId) => labelId.trim())
        .filter((labelId) => labelId.length > 0);

const sameLabelIds = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((labelId, index) => labelId === right[index]);

const sameLabelFilter = (left: LabelFilter, right: LabelFilter): boolean =>
  left.includeMode === right.includeMode &&
  left.includeUnlabeled === right.includeUnlabeled &&
  left.excludeUnlabeled === right.excludeUnlabeled &&
  sameLabelIds(left.includeLabelIds, right.includeLabelIds) &&
  sameLabelIds(left.excludeLabelIds, right.excludeLabelIds);

const routePath = (route: Route): string =>
  route === 'list' ? LIST_PATH : route === 'appearance' ? APPEARANCE_PATH : EXPLORE_PATH;

/** The shareable URL for the model as it currently stands. */
const currentUrl = (model: Model, selectedCode: string | null = model.selectedCode): string =>
  normalizedUrl(model, selectedCode, routePath(model.route));

const appearanceUrl = (model: Model): string => normalizedUrl(model, null, APPEARANCE_PATH);

const listUrl = (model: Model): string => normalizedUrl(model, null, LIST_PATH);

const exploreUrl = (model: Model): string => normalizedUrl(model, null, EXPLORE_PATH);

const savedListState = (result: SavedCoursesResult): SavedListState | null =>
  result._tag === 'SavedCoursesReady' ? result.state : null;

const isCourseSaved = (result: SavedCoursesResult, courseCode: string): boolean => {
  const state = savedListState(result);
  const identity = courseIdentity(courseCode);
  return state !== null && identity !== null && isSaved(state, identity);
};

/** Identities the label dialog acts on: the explicit target, intersected with
 *  what is actually saved, so a stale target can never create a membership for
 *  a course that is gone. */
const labelTargetIdentities = (
  state: SavedListState,
  courseCodes: ReadonlyArray<string>,
): ReadonlyArray<CourseIdentity> =>
  courseCodes
    .map((courseCode) => courseIdentity(courseCode))
    .filter(
      (identity): identity is CourseIdentity => identity !== null && isSaved(state, identity),
    );

const withoutSelected = (
  selected: ReadonlyArray<string>,
  courseCode: string,
): ReadonlyArray<string> => selected.filter((code) => code !== courseCode);

const noteDraftFor = (model: Model, course: SavedCourse): string =>
  model.noteDrafts.find((draft) => draft.courseCode === course.courseCode)?.value ??
  course.note ??
  '';

const withoutNoteDraft = (drafts: Model['noteDrafts'], courseCode: string): Model['noteDrafts'] =>
  drafts.filter((draft) => draft.courseCode !== courseCode);

/**
 * A saved-course transition is applied to the model first and persisted from
 * the resulting state, so storage never becomes a second source of truth.
 */
const applySavedListChange = (
  model: Model,
  change: (state: SavedListState, identity: CourseIdentity) => SavedListState,
  courseCode: string,
  drafts: Model['noteDrafts'] = model.noteDrafts,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const state = savedListState(model.savedCourses);
  const identity = courseIdentity(courseCode);
  if (state === null || identity === null) return [model, []];
  const next = change(state, identity);
  if (next === state && drafts === model.noteDrafts) return [model, []];
  return [
    {
      ...model,
      savedCourses: SavedCoursesReady({ state: next, repairedEntries: 0 }),
      noteDrafts: drafts,
    },
    next === state ? [] : [PersistSavedCourses({ state: next })],
  ];
};

/**
 * Rewrites a requested collection recipe to the canonical one the loaded label
 * set can actually express, and keeps what changed so the interface can restate
 * it. Ids that no longer name a label are dropped and disclosed; an id asked
 * for as both included and excluded resolves with exclude winning, because a
 * shared URL carries no action order to fall back on. The rewrite is a
 * `replace`, so it never adds a history entry the student did not create, and
 * it never touches the catalogue request.
 */
const canonicalizeLabelFilter = (
  model: Model,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const state = savedListState(model.savedCourses);
  if (state === null) return [model, []];
  const normalized = normalizeLabelFilter(state, model.labelFilter);
  if (sameLabelFilter(normalized.filter, model.labelFilter)) return [model, []];
  const next: Model = {
    ...model,
    labelFilter: normalized.filter,
    labelFilterNotice: {
      unknownCount: normalized.unknownLabelIds.length,
      contradictoryLabelIds: normalized.contradictoryLabelIds,
      contradictoryUnlabeled: normalized.contradictoryUnlabeled,
    },
  };
  return [
    next,
    model.route === 'list' ? [Navigate({ href: currentUrl(next, null), mode: 'replace' })] : [],
  ];
};

/**
 * A student-driven filter change is a history entry: Back and Forward restore
 * the previous recipe. It stays inside List, so no catalogue request is made.
 */
const applyLabelFilter = (
  model: Model,
  filter: LabelFilter,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  if (sameLabelFilter(filter, model.labelFilter)) return [model, []];
  const next: Model = { ...model, labelFilter: filter, labelFilterNotice: null };
  return [next, [Navigate({ href: currentUrl(next, null), mode: 'push' })]];
};

/**
 * Everything the label form owns, returned to its initial state. Opening the
 * dialog, closing it by any route, and cancelling an edit all discard the draft
 * through this one value, so no path can leave half of it behind.
 */
const discardedLabelDraft = {
  labelEditing: null,
  labelDraftName: '',
  labelDraftColor: defaultLabelColor,
  labelError: null,
  labelPendingDelete: null,
  selectionRemovePending: false,
  compareDifferencesOnly: true,
} as const satisfies Partial<Model>;

/**
 * The reason the current draft would be refused, or `null` if Apply would
 * succeed. The dialog uses it to keep already-visible feedback in step with the
 * draft being corrected; it decides nothing the transition would not.
 */
const labelDraftRejection = (model: Model): LabelRejection | null => {
  const state = savedListState(model.savedCourses);
  if (state === null) return null;
  return model.labelEditing === null
    ? validateNewLabel(state, model.labelDraftName)
    : validateLabelEdit(state, model.labelEditing, model.labelDraftName);
};

/**
 * Label edits share one shape: apply and persist, do nothing, or keep the
 * student's draft and name the reason. A rejection never applies the follow-up
 * patch, so the form the student needs to correct stays as they left it.
 */
const applyLabelResult = (
  model: Model,
  result: LabelResult,
  patch: Partial<Model> = {},
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  switch (result._tag) {
    case 'LabelApplied':
      return [
        {
          ...model,
          ...patch,
          savedCourses: SavedCoursesReady({ state: result.state, repairedEntries: 0 }),
          labelError: null,
        },
        [PersistSavedCourses({ state: result.state })],
      ];
    case 'LabelUnchanged':
      return [{ ...model, ...patch, labelError: null }, []];
    case 'LabelRejected':
      return [{ ...model, labelError: result.reason }, []];
  }
};

/** A label change that also has to leave the filter and the URL canonical, for
 *  instance after deleting a label the current recipe still refers to. */
const applyLabelStateChange = (
  model: Model,
  state: SavedListState,
  patch: Partial<Model> = {},
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const normalized = normalizeLabelFilter(state, model.labelFilter);
  const filterChanged = !sameLabelFilter(normalized.filter, model.labelFilter);
  const next: Model = {
    ...model,
    ...patch,
    savedCourses: SavedCoursesReady({ state, repairedEntries: 0 }),
    labelError: null,
    labelFilter: normalized.filter,
    labelFilterNotice: null,
  };
  return [
    next,
    [
      PersistSavedCourses({ state }),
      ...(filterChanged && model.route === 'list'
        ? [Navigate({ href: currentUrl(next, null), mode: 'replace' })]
        : []),
    ],
  ];
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
    decisionSignals: DecisionSignalsIdle(),
    nextPage: NextPageIdle(),
  };
  return [
    nextModel,
    [
      Navigate({ href: currentUrl(nextModel, null), mode: 'replace' }),
      fetchCommand(request, key, false),
    ],
  ];
};

const oneOf = <A extends string>(value: string, values: ReadonlyArray<A>, fallback: A): A =>
  values.includes(value as A) ? (value as A) : fallback;

interface ParsedLocation {
  readonly locale: Locale;
  readonly route: Route;
  readonly query: string;
  readonly term: string;
  readonly campus: Campus;
  readonly level: Level;
  readonly sort: CourseSearchSort;
  readonly openOnly: boolean;
  readonly englishOnly: boolean;
  readonly selectedCode: string | null;
  readonly labelFilter: LabelFilter;
  readonly compareCodes: ReadonlyArray<string>;
}

const parsePathname = (pathname: string): Route => {
  const normalized = pathname.replace(/\/+$/, '');
  switch (normalized === '' ? EXPLORE_PATH : normalized) {
    case LIST_PATH:
      return 'list';
    // Appearance was once an overlay over whichever page you were on, so it
    // had a path per host route. Both still resolve, because links to them
    // exist in the wild, but the destination is now one page of its own.
    case APPEARANCE_PATH:
    case LEGACY_LIST_APPEARANCE_PATH:
      return 'appearance';
    default:
      return 'explore';
  }
};

/**
 * Comparison lives in the URL so a refresh or a back step keeps it, but it is
 * still only a request: whether these codes name a comparison is decided by
 * the validated constructor against the saved list, not here.
 */
const parseCompareCodes = (raw: string | null): ReadonlyArray<string> =>
  raw === null
    ? []
    : raw
        .split(',')
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length > 0)
        .slice(0, compareMaximum);

const parseLocation = (href: string, fallbackLocale: Locale = 'en'): ParsedLocation => {
  const url = new URL(href, 'http://course-lens.local');
  const requestedLocale = url.searchParams.get('lang');
  const path = parsePathname(url.pathname);
  return {
    route: path,
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
    // List owns saved identities; course detail always belongs to Explore.
    selectedCode:
      path === 'list' ? null : url.searchParams.get('course')?.trim().toUpperCase() || null,
    compareCodes: path === 'list' ? parseCompareCodes(url.searchParams.get('compare')) : [],
    labelFilter:
      path === 'list'
        ? {
            includeLabelIds: parseLabelIds(url.searchParams.get('labels')),
            includeUnlabeled: url.searchParams.get('unlabeled') === '1',
            includeMode: oneOf(url.searchParams.get('labelMode') ?? 'any', labelFilterModes, 'any'),
            excludeLabelIds: parseLabelIds(url.searchParams.get('notLabels')),
            excludeUnlabeled: url.searchParams.get('notUnlabeled') === '1',
          }
        : emptyLabelFilter,
  };
};

/**
 * State that belongs to the page it was made on, dropped when the student
 * leaves it. Selection names rows of the saved list, so carrying it to a page
 * without those rows leaves bulk actions pointing at nothing on screen.
 *
 * Both URL branches route through here: `locationMatchesModel` deliberately
 * ignores the route, so a route-only change looks like "nothing moved" to one
 * of them, and this was missed in exactly that branch.
 */
const forRoute = (model: Model, route: Route): Model =>
  route === model.route
    ? model
    : {
        ...model,
        route,
        selectedCourseCodes: [],
        selectionRemovePending: false,
        labelDialogTarget: [],
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
        [PersistLocale({ locale }), Navigate({ href: currentUrl(next), mode: 'replace' })],
      ];
    }
  }
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
          [PersistLocale({ locale }), Navigate({ href: currentUrl(next), mode: 'replace' })],
        ];
      },
      ToggledSidebar: () => {
        const sidebarCollapsed = !model.sidebarCollapsed;
        return [
          { ...model, sidebarCollapsed },
          [PersistSidebarPreference({ collapsed: sidebarCollapsed })],
        ];
      },
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
        const withCanonicalFilter = (
          result: readonly [Model, ReadonlyArray<Command.Command<Message>>],
        ): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
          const [next, commands] = result;
          const [canonical, filterCommands] = canonicalizeLabelFilter(next);
          return [canonical, [...commands, ...filterCommands]];
        };
        if (!locationMatchesModel(location, model)) {
          const next: Model = {
            ...forRoute(model, location.route),
            locale: location.locale,
            route: location.route,
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
            labelFilter: location.labelFilter,
            compareCodes: location.compareCodes,
            labelFilterNotice: null,
          };
          const request = searchRequest(next, 1);
          const key = requestKey(request);
          return withCanonicalFilter([
            { ...next, activeRequestKey: key },
            [
              fetchCommand(request, key, false),
              ...(location.selectedCode === null
                ? []
                : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
            ],
          ]);
        }
        /**
         * A label-filter change is local interaction state: the catalogue
         * request is unchanged, so history navigation restores the recipe
         * without refetching anything.
         */
        const routedModel: Model =
          location.locale === model.locale &&
          location.route === model.route &&
          sameLabelFilter(location.labelFilter, model.labelFilter)
            ? model
            : {
                ...forRoute(model, location.route),
                locale: location.locale,
                route: location.route,
                labelFilter: location.labelFilter,
                compareCodes: location.compareCodes,
                labelFilterNotice: sameLabelFilter(location.labelFilter, model.labelFilter)
                  ? model.labelFilterNotice
                  : null,
              };
        const localizedModel = routedModel;
        const localeCommands =
          location.locale === model.locale ? [] : [PersistLocale({ locale: location.locale })];
        if (location.selectedCode === model.selectedCode) {
          return withCanonicalFilter([localizedModel, localeCommands]);
        }
        return withCanonicalFilter(
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
      ClosedCourse: () => [model, [Navigate({ href: currentUrl(model, null), mode: 'replace' })]],
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
      LoadedSavedCourses: ({ load }) => {
        switch (load._tag) {
          case 'SavedListEmpty':
            return [
              {
                ...model,
                savedCourses: SavedCoursesReady({ state: emptySavedList, repairedEntries: 0 }),
              },
              [],
            ];
          case 'SavedListLoaded': {
            // A filter recipe can only be judged against a loaded label set, so
            // canonicalization happens here rather than while parsing the URL.
            const [canonical, filterCommands] = canonicalizeLabelFilter({
              ...model,
              savedCourses: SavedCoursesReady({
                state: load.state,
                repairedEntries: load.repairedEntries,
              }),
            });
            return [
              canonical,
              [
                // Repairs are written back so the stored value matches what the
                // student is shown; an untouched list is never rewritten.
                ...(load.repairedEntries === 0 ? [] : [PersistSavedCourses({ state: load.state })]),
                ...filterCommands,
              ],
            ];
          }
          case 'SavedListUnsupported':
            return [
              {
                ...model,
                savedCourses: SavedCoursesRecovery({
                  reason: 'unsupported-version',
                  storedVersion: load.storedVersion,
                  raw: load.raw,
                }),
              },
              [],
            ];
          case 'SavedListCorrupt':
            return [
              {
                ...model,
                savedCourses: SavedCoursesRecovery({
                  reason: load.reason === 'invalid-json' ? 'invalid-json' : 'unreadable',
                  storedVersion: null,
                  raw: load.raw,
                }),
              },
              [],
            ];
        }
      },
      FailedSavedCoursesLoad: () => [
        {
          ...model,
          savedCourses: SavedCoursesRecovery({
            reason: 'unavailable',
            storedVersion: null,
            raw: '',
          }),
        },
        [],
      ],
      RequestedSaveCourse: ({ courseCode }) => {
        const state = savedListState(model.savedCourses);
        const identity = courseIdentity(courseCode);
        if (state === null || identity === null || isSaved(state, identity)) return [model, []];
        return [model, [StampSavedCourse({ courseCode: identity.courseCode })]];
      },
      StampedSavedCourse: ({ courseCode, savedAt }) => {
        const [next, commands] = applySavedListChange(
          model,
          (state, identity) => saveCourse(state, identity, savedAt),
          courseCode,
        );
        if (next === model) return [next, commands];
        return [
          {
            ...next,
            savedListActions: withNotice(model.savedListActions, SavedActionSaved({ courseCode })),
          },
          commands,
        ];
      },
      RequestedRemoveSavedCourse: ({ courseCode }) => {
        const state = savedListState(model.savedCourses);
        const identity = courseIdentity(courseCode);
        if (state === null || identity === null) return [model, []];
        const course = findSavedCourse(state, identity);
        if (course === null) return [model, []];
        const memberships = membershipsForSavedCourse(state, identity);
        const next = removeSavedCourse(state, identity);
        return [
          {
            ...model,
            savedCourses: SavedCoursesReady({ state: next, repairedEntries: 0 }),
            noteDrafts: withoutNoteDraft(model.noteDrafts, identity.courseCode),
            // Removing a course clears its memberships, its note draft, and its
            // selection in the same transition; nothing can act on it after.
            selectedCourseCodes: withoutSelected(model.selectedCourseCodes, identity.courseCode),
            labelDialogTarget: withoutSelected(model.labelDialogTarget, identity.courseCode),
            savedListActions: withNotice(
              model.savedListActions,
              SavedActionRemoved({ courses: [course], memberships }),
            ),
          },
          [PersistSavedCourses({ state: next })],
        ];
      },
      UpdatedSavedNoteDraft: ({ courseCode, value }) => [
        {
          ...model,
          noteDrafts: [...withoutNoteDraft(model.noteDrafts, courseCode), { courseCode, value }],
        },
        [],
      ],
      SubmittedSavedNote: ({ courseCode }) => {
        const draft = model.noteDrafts.find((entry) => entry.courseCode === courseCode);
        if (draft === undefined) return [model, []];
        return applySavedListChange(
          model,
          (state, identity) => setSavedCourseNote(state, identity, draft.value),
          courseCode,
          withoutNoteDraft(model.noteDrafts, courseCode),
        );
      },
      RequestedSavedCoursesReset: () => [
        {
          ...model,
          savedCourses: SavedCoursesReady({ state: emptySavedList, repairedEntries: 0 }),
          noteDrafts: [],
          savedListActions: [],
          selectedCourseCodes: [],
          labelDialogTarget: [],
          labelFilter: emptyLabelFilter,
          labelFilterNotice: null,
          labelEditing: null,
          labelDraftName: '',
          labelPendingDelete: null,
        },
        [PersistSavedCourses({ state: emptySavedList })],
      ],
      PersistedSavedCourses: () =>
        model.savedCoursesPersistFailed
          ? [{ ...model, savedCoursesPersistFailed: false }, []]
          : [model, []],
      FailedSavedCoursesPersistence: () => [{ ...model, savedCoursesPersistFailed: true }, []],
      /**
       * Undo reverses the ephemeral snapshot, never the live saved state
       * directly: a save is undone by removing that identity, and a removal
       * is undone by restoring the exact course and memberships it carried.
       * Both branches are idempotent, so a stale or repeated Undo is inert
       * once the snapshot has already been consumed.
       */
      RequestedUndoSavedListAction: ({ key }) => {
        const state = savedListState(model.savedCourses);
        const notice = model.savedListActions.find(
          (candidate) => savedListNoticeKey(candidate) === key,
        );
        if (state === null || notice === undefined) return [model, []];
        const remaining = withoutNotice(model.savedListActions, key);
        return M.value(notice).pipe(
          M.withReturnType<readonly [Model, ReadonlyArray<Command.Command<Message>>]>(),
          M.tagsExhaustive({
            SavedActionSaved: ({ courseCode }) => {
              const identity = courseIdentity(courseCode);
              const next = identity === null ? state : removeSavedCourse(state, identity);
              if (next === state) return [{ ...model, savedListActions: remaining }, []];
              return [
                {
                  ...model,
                  savedCourses: SavedCoursesReady({ state: next, repairedEntries: 0 }),
                  savedListActions: [],
                  selectedCourseCodes: withoutSelected(model.selectedCourseCodes, courseCode),
                  labelDialogTarget: withoutSelected(model.labelDialogTarget, courseCode),
                },
                [PersistSavedCourses({ state: next })],
              ];
            },
            SavedActionRemoved: ({ courses, memberships }) => {
              const next = courses.reduce(
                (restored, course) =>
                  restoreSavedCourse(
                    restored,
                    course,
                    memberships.filter((membership) => membership.savedCourseId === course.id),
                  ),
                state,
              );
              if (next === state) return [{ ...model, savedListActions: remaining }, []];
              return [
                {
                  ...model,
                  savedCourses: SavedCoursesReady({ state: next, repairedEntries: 0 }),
                  savedListActions: [],
                },
                [PersistSavedCourses({ state: next })],
              ];
            },
          }),
        );
      },
      DismissedSavedListAction: ({ key }) => [
        { ...model, savedListActions: withoutNotice(model.savedListActions, key) },
        [],
      ],
      DismissedAllSavedListActions: () => [{ ...model, savedListActions: [] }, []],
      ChangedLabelInclusion: ({ predicate, isIncluded }) =>
        applyLabelFilter(model, setPredicateIncluded(model.labelFilter, predicate, isIncluded)),
      ChangedLabelExclusion: ({ predicate, isExcluded }) =>
        applyLabelFilter(model, setPredicateExcluded(model.labelFilter, predicate, isExcluded)),
      ChangedLabelFilterMode: ({ mode }) =>
        applyLabelFilter(model, setLabelFilterMode(model.labelFilter, mode)),
      ClearedLabelFilter: () => applyLabelFilter(model, emptyLabelFilter),
      ToggledSavedCourseSelection: ({ courseCode, isSelected }) => [
        {
          ...model,
          selectedCourseCodes: isSelected
            ? [...withoutSelected(model.selectedCourseCodes, courseCode), courseCode]
            : withoutSelected(model.selectedCourseCodes, courseCode),
          // The prompt named a specific set; changing the set retracts it.
          selectionRemovePending: false,
        },
        [],
      ],
      ClearedSavedCourseSelection: () => [
        { ...model, selectedCourseCodes: [], selectionRemovePending: false },
        [],
      ],
      /**
       * Entering a comparison hands the ephemeral selection to the URL, where
       * a refresh or a back step can find it again. The selection itself stays
       * out of the URL and is cleared, so the tray does not shadow the
       * comparison it just opened.
       */
      RequestedCompare: () => {
        const next: Model = {
          ...model,
          compareCodes: model.selectedCourseCodes,
          selectedCourseCodes: [],
          selectionRemovePending: false,
        };
        return [next, [Navigate({ href: currentUrl(next, null), mode: 'push' })]];
      },
      ClosedCompare: () => {
        const next: Model = { ...model, compareCodes: [] };
        return [next, [Navigate({ href: currentUrl(next, null), mode: 'push' })]];
      },
      ToggledCompareDifferencesOnly: ({ differencesOnly }) => [
        { ...model, compareDifferencesOnly: differencesOnly },
        [],
      ],
      RequestedRemoveSelected: () => [{ ...model, selectionRemovePending: true }, []],
      CancelledRemoveSelected: () => [{ ...model, selectionRemovePending: false }, []],
      ConfirmedRemoveSelected: () => {
        const state = savedListState(model.savedCourses);
        if (state === null) return [{ ...model, selectionRemovePending: false }, []];
        const identities = model.selectedCourseCodes
          .map((courseCode) => courseIdentity(courseCode))
          .filter((identity) => identity !== null);
        const courses = identities
          .map((identity) => findSavedCourse(state, identity))
          .filter((course) => course !== null);
        if (courses.length === 0) {
          return [{ ...model, selectionRemovePending: false, selectedCourseCodes: [] }, []];
        }
        // Every membership travels with the removal so undo restores what the
        // student had, not just the courses.
        const memberships = identities.flatMap((identity) =>
          membershipsForSavedCourse(state, identity),
        );
        const next = identities.reduce(
          (remaining, identity) => removeSavedCourse(remaining, identity),
          state,
        );
        return [
          {
            ...model,
            savedCourses: SavedCoursesReady({ state: next, repairedEntries: 0 }),
            noteDrafts: identities.reduce(
              (drafts, identity) => withoutNoteDraft(drafts, identity.courseCode),
              model.noteDrafts,
            ),
            selectedCourseCodes: [],
            labelDialogTarget: [],
            selectionRemovePending: false,
            savedListActions: withNotice(
              model.savedListActions,
              SavedActionRemoved({ courses, memberships }),
            ),
          },
          [PersistSavedCourses({ state: next })],
        ];
      },
      /** A density change is a preference, never a change to the saved set: it
       *  persists locally and produces no navigation and no fetch. */
      ChangedListDensity: ({ value }) =>
        model.listDensity === value
          ? [model, []]
          : [{ ...model, listDensity: value }, [PersistListDensity({ density: value })]],
      PersistedListDensity: () => [model, []],
      FailedListDensityPersistence: () => [model, []],
      /**
       * One dialog owns label creation, editing, and attachment. Opening it
       * carries the explicit target: a single row, the current selection, or
       * nothing at all when the student only manages the label set.
       */
      RequestedLabelDialog: ({ courseCodes }) => {
        const [labelDialog, commands] = Dialog.open(model.labelDialog);
        return [
          { ...model, ...discardedLabelDraft, labelDialog, labelDialogTarget: courseCodes },
          Command.mapMessages(commands, (message) => GotLabelDialogMessage({ message })),
        ];
      },
      /**
       * Cancel, the backdrop, and Escape all arrive here as one close, so the
       * draft is discarded on exactly one path rather than three.
       */
      GotLabelDialogMessage: ({ message: dialogMessage }) => {
        const [labelDialog, commands] = Dialog.update(model.labelDialog, dialogMessage);
        const closing = dialogMessage._tag === 'RequestedClose';
        return [
          {
            ...model,
            labelDialog,
            ...(closing ? { ...discardedLabelDraft, labelDialogTarget: [] } : {}),
          },
          Command.mapMessages(commands, (message) => GotLabelDialogMessage({ message })),
        ];
      },
      /**
       * The draft is the only thing that changes while the student types. Once
       * an Apply attempt has produced feedback, the feedback is recomputed from
       * the draft being corrected, so it never describes a name that is no
       * longer on screen — and it stays absent until that first attempt.
       */
      UpdatedLabelDraftName: ({ value }) => {
        const next: Model = { ...model, labelDraftName: value };
        return [
          { ...next, labelError: model.labelError === null ? null : labelDraftRejection(next) },
          [],
        ];
      },
      /**
       * Colour is draft state like the name. Choosing one never creates,
       * updates, or attaches a label; only Apply does.
       */
      ChangedLabelDraftColor: ({ value }) => [{ ...model, labelDraftColor: value }, []],
      /**
       * Apply is the single transition. Creating needs an id from the boundary,
       * so the rules are checked here first: an empty or duplicate name never
       * reaches the command, and the student keeps the draft they have to fix.
       */
      SubmittedLabelForm: () => {
        const state = savedListState(model.savedCourses);
        if (state === null) return [model, []];
        const editing = model.labelEditing;
        if (editing !== null) {
          return applyLabelResult(
            model,
            editLabel(state, editing, {
              name: model.labelDraftName,
              color: model.labelDraftColor,
            }),
            { labelEditing: null, labelDraftName: '', labelDraftColor: defaultLabelColor },
          );
        }
        const rejection = validateNewLabel(state, model.labelDraftName);
        if (rejection !== null) return [{ ...model, labelError: rejection }, []];
        return [model, [StampLabel()]];
      },
      /**
       * A label created from a course or a selection is attached in the same
       * transition, so "Add labels" is one action rather than create-then-find.
       */
      StampedLabel: ({ labelId }) => {
        const state = savedListState(model.savedCourses);
        if (state === null) return [model, []];
        const created = createLabel(state, {
          id: labelId,
          name: model.labelDraftName,
          color: model.labelDraftColor,
        });
        // A refused create attaches nothing: the draft stays exactly as the
        // student left it so they can correct the reason and try again.
        if (created._tag !== 'LabelApplied') return applyLabelResult(model, created);
        const targets = labelTargetIdentities(created.state, model.labelDialogTarget);
        const attached = attachLabel(created.state, labelId, targets);
        return applyLabelResult(
          model,
          { _tag: 'LabelApplied', state: attached },
          {
            labelDraftName: '',
            labelDraftColor: defaultLabelColor,
          },
        );
      },
      RequestedEditLabel: ({ labelId }) => {
        const state = savedListState(model.savedCourses);
        const label = state === null ? null : findLabel(state, labelId);
        if (label === null) return [{ ...model, labelError: 'unknown-label' }, []];
        return [
          {
            ...model,
            labelEditing: label.id,
            labelDraftName: label.name,
            labelDraftColor: label.color,
            labelError: null,
          },
          [],
        ];
      },
      CancelledLabelEdit: () => [{ ...model, ...discardedLabelDraft }, []],
      /** Deletion is permanent and drops every membership on the label, so a
       *  single click only arms an in-dialog confirmation. Nothing is removed
       *  until the student explicitly confirms that specific label. */
      RequestedDeleteLabel: ({ labelId }) => {
        const state = savedListState(model.savedCourses);
        if (state === null) return [model, []];
        return [{ ...model, labelPendingDelete: labelId }, []];
      },
      CancelledLabelDelete: () => [{ ...model, labelPendingDelete: null }, []],
      /** Deleting a label removes its memberships and leaves no filter that can
       *  still refer to it, so the URL is rewritten to the canonical recipe. */
      ConfirmedDeleteLabel: ({ labelId }) => {
        const state = savedListState(model.savedCourses);
        if (state === null) return [model, []];
        const result = deleteLabel(state, labelId);
        if (result._tag !== 'LabelApplied') return applyLabelResult(model, result);
        // Deleting the label currently being edited discards that draft rather
        // than leaving the form pointed at something that no longer exists.
        return applyLabelStateChange(model, result.state, {
          ...(model.labelEditing === labelId
            ? { labelEditing: null, labelDraftName: '', labelDraftColor: defaultLabelColor }
            : {}),
          labelPendingDelete: null,
        });
      },
      ToggledLabelOnTarget: ({ labelId, isAttached }) => {
        const state = savedListState(model.savedCourses);
        if (state === null) return [model, []];
        const targets = labelTargetIdentities(state, model.labelDialogTarget);
        if (targets.length === 0) return [model, []];
        const next = isAttached
          ? attachLabel(state, labelId, targets)
          : detachLabel(state, labelId, targets);
        if (next === state) return [model, []];
        return applyLabelResult(model, { _tag: 'LabelApplied', state: next });
      },
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
  listDensity: ListDensity = 'card',
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const location = parseLocation(href, fallbackLocale);
  const base: Model = {
    locale: location.locale,
    route: location.route,
    savedCourses: SavedCoursesLoading(),
    savedListActions: [],
    noteDrafts: [],
    savedCoursesPersistFailed: false,
    compareCodes: location.compareCodes,
    compareDifferencesOnly: true,
    labelFilter: location.labelFilter,
    labelFilterNotice: null,
    selectedCourseCodes: [],
    labelDialog: Dialog.init({
      id: 'saved-course-labels',
      isAnimated: true,
      focusSelector: '#saved-course-labels-close',
    }),
    labelDialogTarget: [],
    labelDraftName: '',
    labelDraftColor: defaultLabelColor,
    labelEditing: null,
    labelPendingDelete: null,
    selectionRemovePending: false,
    labelError: null,
    listDensity,
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
      LoadSavedCourses(),
      fetchCommand(request, key, false),
      ...(location.selectedCode === null
        ? []
        : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
    ],
  ];
};

export const init: Runtime.ApplicationInit<Model, Message> = () =>
  initForHref(
    typeof window === 'undefined' ? 'http://course-lens.local/' : window.location.href,
    browserPreferredLocale(),
    browserSidebarCollapsed(),
    readThemePreference(),
    browserListDensity(),
  );

export const routingInit: Runtime.RoutingApplicationInit<Model, Message> = (url) =>
  initForHref(
    Url.toString(url),
    browserPreferredLocale(),
    browserSidebarCollapsed(),
    readThemePreference(),
    browserListDensity(),
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

/** Stored preferences are untrusted input too: anything that is not one of the
 *  two densities reads as the default rather than reaching the model. */
const browserListDensity = (): ListDensity => {
  if (typeof window === 'undefined') return 'card';
  const stored = localStorage.getItem(listDensityStorageKey);
  return listDensities.find((density) => density === stored) ?? 'card';
};

const documentTitle = (model: Model): string => {
  if (model.route === 'list') return translate(model.locale, 'app.listTitle');
  return model.detail._tag === 'DetailSuccess' || model.detail._tag === 'DetailPartial'
    ? `${model.detail.response.item.code} · ${translate(model.locale, 'app.name')}`
    : translate(model.locale, 'app.catalogueTitle');
};

export const view = (model: Model): Document => ({
  title: documentTitle(model),
  body: appView(model),
});

const eyebrowClass = 'mb-2 text-primary text-xs font-extrabold tracking-[0.1em] uppercase';

const fieldLabelClass =
  'block mt-0 mr-0 mb-[0.4rem] ml-1 text-on-surface-variant text-sm font-semibold';

/**
 * The column reserves room below its content for the bottom bar *and* for the
 * notice stack that hovers above it. Reserving it unconditionally is what lets
 * the stack appear without reflowing anything: nothing moves when a notice
 * arrives, and the last row can still be scrolled clear of one that stays.
 *
 * The sidebar is fixed, so the main column is offset to clear it. That offset
 * has to be a margin, and an explicit `margin-left` beats `margin-left: auto`
 * — so capping the width here left every spare pixel on the right instead of
 * splitting it. The offset stays, and the cap moves inside.
 */
const mainContentClass = (sidebarCollapsed: boolean): string =>
  `w-full pt-4 px-4 pb-[calc(12rem+env(safe-area-inset-bottom))] [@media(min-width:48rem)_and_(min-height:34rem)]:pt-4 [@media(min-width:48rem)_and_(min-height:34rem)]:px-6 [@media(min-width:48rem)_and_(min-height:34rem)]:pb-40 [@media(min-width:64rem)]:px-10 ${
    sidebarCollapsed
      ? '[@media(min-width:48rem)_and_(min-height:34rem)]:w-[calc(100%-5rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:ml-20'
      : '[@media(min-width:48rem)_and_(min-height:34rem)]:w-[calc(100%-16.5rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:ml-66'
  }`;

/**
 * One reading column, centred in whatever space the sidebar leaves. 76rem is
 * about 100 characters at the body size — wide enough for the three-column
 * course card, short enough that a heading does not run away from the text
 * under it.
 */
const mainColumnClass = 'mx-auto w-full max-w-[76rem]';

const buttonBase =
  'cursor-pointer transition-[box-shadow,transform] duration-150 ease-in-out focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-[3px] data-[disabled]:cursor-wait data-[disabled]:opacity-[0.65] [@media(max-width:37rem)]:w-full';

const compactButtonBase =
  'cursor-pointer transition-[box-shadow,background-color] duration-150 ease-in-out focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-[3px] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-[0.65]';

const buttonPrimary = `${buttonBase} min-h-14 px-5 border-0 rounded-[1.75rem] font-bold bg-primary text-on-primary shadow-m3-1 not-data-[disabled]:hover:shadow-m3-2 not-data-[disabled]:hover:-translate-y-px`;

const buttonSecondary = `${buttonBase} min-h-12 px-[1.15rem] border border-outline rounded-[1.5rem] bg-surface-container text-primary font-bold`;

/**
 * Actions that sit together in a row are peers and share one treatment.
 *
 * The page-level button stretches to fill a narrow screen, which is right for
 * a form's single commit and wrong inside a group: two buttons filling the row
 * while two hug their text reads as two different kinds of control, and the
 * eye groups by similarity before it reads any label. Tone carries meaning
 * here; width does not.
 */
type GroupedActionTone = 'primary' | 'neutral' | 'destructive';

const groupedAction = (tone: GroupedActionTone): string =>
  `${compactButtonBase} inline-flex min-h-11 flex-none items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${
    tone === 'primary'
      ? 'border-primary bg-primary text-on-primary'
      : tone === 'destructive'
        ? 'border-error bg-error-container text-on-error-container'
        : 'border-outline bg-surface-container text-primary'
  }`;

const backButtonClass =
  'min-h-12 px-[1.15rem] border border-outline rounded-[1.5rem] bg-surface-container text-primary font-bold cursor-pointer justify-self-start';

const stateCardBase =
  'grid min-h-68 place-items-center content-center p-[clamp(2rem,6vw,4rem)] border border-outline-variant rounded-m3-extra-large bg-surface-container-low text-center';

const stateCardFailure = `${stateCardBase} border-error bg-error-container text-on-error-container`;

const stateCardH2Class = 'mt-3 mb-2 text-[clamp(1.4rem,3vw,2rem)]';

const stateCardPClass = 'max-w-144 mx-auto my-1 text-on-surface-variant leading-[1.6]';

const stateCardFailurePClass = 'max-w-144 mx-auto my-1 leading-[1.6] text-inherit';

const statusLabelErrorClass = 'mb-2 text-xs font-extrabold tracking-[0.1em] uppercase text-error';

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
        model.route,
        exploreUrl(model),
        listUrl(model),
        appearanceUrl(model),
        ToggledSidebar(),
        languageSelectControl(
          model.selectFields,
          'language-desktop',
          model.locale,
          model.sidebarCollapsed,
        ),
      ]),
      h.main(
        [h.Class(mainContentClass(model.sidebarCollapsed))],
        [
          h.div(
            [h.Class(mainColumnClass)],
            [
              savedCoursesPersistenceAlert(model),
              model.route === 'appearance'
                ? lazyAppearancePage(appearancePageFromValues, [
                    model.locale,
                    model.themePreference,
                    model.selectFields,
                  ])
                : model.route === 'list'
                  ? listView(model)
                  : model.selectedCode === null
                    ? catalogueView(model)
                    : selectedCourseView(model),
            ],
          ),
        ],
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
      bottomStackView(model, selectedSavedCourses(model)),
      model.route === 'list' ? labelDialogView(model) : h.empty,
      lazyMobileNavigation(mobileNavigation<Message>, [
        model.locale,
        model.route,
        exploreUrl(model),
        listUrl(model),
        appearanceUrl(model),
      ]),
    ],
  );
};

/** A failed write is never silent: the student is told the change was not kept. */
const savedCoursesPersistenceAlert = (model: Model): Html => {
  const h = html<Message>();
  if (!model.savedCoursesPersistFailed) return h.empty;
  return h.div(
    [
      h.Class(
        'mb-4 py-[0.9rem] px-4 border border-error rounded-m3-medium bg-error-container text-on-error-container',
      ),
      h.Role('alert'),
    ],
    [translate(model.locale, 'list.persistFailed')],
  );
};

/**
 * Save and Remove are each one action with an explicit confirmation rather
 * than a silent state flip. The banner names what just happened, offers
 * Undo while the ephemeral snapshot is still available, and Dismiss so the
 * student is never forced to wait it out.
 */
const savedListActionStatus = (model: Model): Html => {
  const h = html<Message>();
  const notices = model.savedListActions;
  if (notices.length === 0) return h.empty;
  const buttonClass = `${compactButtonBase} ${buttonSecondary}`;

  const noticeCard = (notice: SavedListNotice): Html => {
    const key = savedListNoticeKey(notice);
    const single = notice._tag === 'SavedActionRemoved' && notice.courses.length === 1;
    const removed = notice._tag === 'SavedActionRemoved' ? notice.courses : [];
    const message =
      notice._tag === 'SavedActionSaved'
        ? translate(model.locale, 'list.savedStatus', { code: notice.courseCode })
        : single && removed[0] !== undefined
          ? translate(model.locale, 'list.removedStatus', { code: removed[0].courseCode })
          : translate(model.locale, 'list.removedManyStatus', { count: removed.length });
    const undoLabel =
      notice._tag === 'SavedActionSaved'
        ? translate(model.locale, 'list.undoSave', { code: notice.courseCode })
        : single && removed[0] !== undefined
          ? translate(model.locale, 'list.undoRemove', { code: removed[0].courseCode })
          : translate(model.locale, 'list.undoRemoveMany', { count: removed.length });

    return h.div(
      [
        h.Class(
          'pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-m3-medium border border-outline bg-surface-container py-[0.9rem] px-4 text-on-surface shadow-m3-2',
        ),
        h.Role('status'),
        h.AriaLive('polite'),
      ],
      [
        h.p([h.Class('m-0')], [message]),
        h.div(
          [h.Class('flex items-center gap-2')],
          [
            Button.view<Message>({
              type: 'button',
              onClick: RequestedUndoSavedListAction({ key }),
              toView: (attributes) =>
                h.button(
                  [...attributes.button, h.Class(buttonClass), h.AriaLabel(undoLabel)],
                  [translate(model.locale, 'list.undo')],
                ),
            }),
            Button.view<Message>({
              type: 'button',
              onClick: DismissedSavedListAction({ key }),
              // Its own name: sharing Undo's would give two buttons one
              // accessible name for opposite outcomes.
              toView: (attributes) =>
                h.button(
                  [...attributes.button, h.Class(buttonClass)],
                  [translate(model.locale, 'list.dismissStatus')],
                ),
            }),
          ],
        ),
      ],
    );
  };

  /**
   * Each notice keeps its own Undo, so a second action does not cost the
   * student the first one. Clearing them one at a time is the tax that
   * stacking introduces, so the group offers a single way out once there is
   * more than one to clear.
   */
  return h.div(
    [h.Class('pointer-events-none grid gap-2')],
    [
      ...notices.map(noticeCard),
      notices.length < 2
        ? h.empty
        : h.div(
            [h.Class('pointer-events-auto flex justify-end')],
            [
              Button.view<Message>({
                type: 'button',
                onClick: DismissedAllSavedListActions(),
                toView: (attributes) =>
                  h.button(
                    [...attributes.button, h.Class(`${buttonClass} min-h-11`)],
                    [translate(model.locale, 'list.dismissAllStatus', { count: notices.length })],
                  ),
              }),
            ],
          ),
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
      catalogueResultView(model),
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
            'max-w-[22ch] text-[clamp(2.1rem,6vw,4rem)] font-bold tracking-[-0.05em] leading-none',
          ),
        ],
        [translate(locale, 'catalogue.heading')],
      ),
      h.p(
        [h.Class('max-w-192 mt-4 text-on-surface-variant text-base leading-[1.6]')],
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
                      'w-full min-h-14 px-4 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-base normal-case transition-[border-color,box-shadow] duration-150 ease-in-out focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)] disabled:opacity-70',
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
  'pointer-events-auto flex justify-end [@media(min-width:48rem)_and_(min-height:34rem)]:sticky [@media(min-width:48rem)_and_(min-height:34rem)]:z-5 [@media(min-width:48rem)_and_(min-height:34rem)]:top-4 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:flex [@media(min-width:48rem)_and_(min-height:34rem)]:min-h-17 [@media(min-width:48rem)_and_(min-height:34rem)]:items-center [@media(min-width:48rem)_and_(min-height:34rem)]:justify-between [@media(min-width:48rem)_and_(min-height:34rem)]:gap-4 [@media(min-width:48rem)_and_(min-height:34rem)]:py-[0.65rem] [@media(min-width:48rem)_and_(min-height:34rem)]:pr-3 [@media(min-width:48rem)_and_(min-height:34rem)]:pl-4 [@media(min-width:48rem)_and_(min-height:34rem)]:border [@media(min-width:48rem)_and_(min-height:34rem)]:border-outline-variant [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-[1.5rem] [@media(min-width:48rem)_and_(min-height:34rem)]:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container)_92%,transparent)] [@media(min-width:48rem)_and_(min-height:34rem)]:shadow-m3-1 [@media(min-width:48rem)_and_(min-height:34rem)]:backdrop-blur-[1rem]';

const catalogueRefineActionSummaryClass =
  'hidden [@media(min-width:48rem)_and_(min-height:34rem)]:grid [@media(min-width:48rem)_and_(min-height:34rem)]:min-w-0 [@media(min-width:48rem)_and_(min-height:34rem)]:gap-[0.15rem]';

const catalogueRefineActionButtonClass = `${compactButtonBase} inline-flex min-h-12 items-center gap-[0.55rem] py-3 px-4 border border-outline-variant rounded-[1.5rem] bg-primary-container shadow-m3-2 text-on-primary-container font-bold [@media(min-width:48rem)_and_(min-height:34rem)]:flex-none [@media(min-width:48rem)_and_(min-height:34rem)]:shadow-none`;

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
            [h.Class('[@media(min-width:48rem)_and_(min-height:34rem)]:font-bold')],
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
                '[@media(min-width:48rem)_and_(min-height:34rem)]:overflow-hidden [@media(min-width:48rem)_and_(min-height:34rem)]:text-on-surface-variant [@media(min-width:48rem)_and_(min-height:34rem)]:text-sm [@media(min-width:48rem)_and_(min-height:34rem)]:text-ellipsis [@media(min-width:48rem)_and_(min-height:34rem)]:whitespace-nowrap',
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
  'fixed right-0 bottom-0 left-0 grid max-h-[min(92svh,52rem)] gap-5 pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] overflow-y-auto border border-outline-variant rounded-t-m3-extra-large bg-surface shadow-m3-2 [transform:translateY(0)] transition-transform duration-200 ease-in-out data-closed:[transform:translateY(100%)] [@media(min-width:48rem)_and_(min-height:34rem)]:top-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:left-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-3rem),44rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:p-6 [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-m3-extra-large [@media(min-width:48rem)_and_(min-height:34rem)]:[transform:translate(-50%,-50%)] [@media(min-width:48rem)_and_(min-height:34rem)]:transition-[opacity,transform] duration-200 ease-in-out [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:opacity-0 [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:[transform:translate(-50%,-47%)_scale(0.98)]';

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
                      'fixed inset-0 bg-[color-mix(in_srgb,var(--md-sys-color-on-surface)_42%,transparent)] opacity-100 transition-opacity duration-200 ease-in-out data-closed:opacity-0',
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

const appearancePageFromValues = (
  locale: Locale,
  themePreference: ThemePreference,
  selectFields: Model['selectFields'],
): Html => appearancePageView(locale, themePreference, selectFields);

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
                [h.Class('text-xs font-extrabold tracking-[0.08em] uppercase')],
                [translate(locale, 'appearance.previewTerm')],
              ),
              h.span(
                [h.Class('rounded-full border border-current/40 py-1 px-2.5 text-xs font-bold')],
                [translate(locale, 'appearance.previewCredits')],
              ),
            ],
          ),
          h.h3(
            [h.Class('text-xl tracking-[-0.025em]')],
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
            [h.Class('flex flex-wrap gap-2 text-xs font-bold')],
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

const appearancePageView = (
  locale: Locale,
  preference: ThemePreference,
  selectFields: Model['selectFields'],
): Html => {
  const h = html<Message>();
  const selectedPreset = selectedPresetId(preference);
  return h.section(
    [h.Class('grid gap-5 pt-[clamp(1.5rem,4vw,3rem)]')],
    [
      h.header(
        [],
        [
          h.p([h.Class(eyebrowClass)], [translate(locale, 'appearance.label')]),
          h.h1(
            [h.Class('text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]')],
            [translate(locale, 'appearance.heading')],
          ),
          h.p(
            [h.Class('mt-[0.4rem] max-w-168 text-on-surface-variant leading-[1.5]')],
            [translate(locale, 'appearance.description')],
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
              h.h3([h.Class('text-sm font-extrabold')], [translate(locale, 'appearance.palettes')]),
              h.div(
                [
                  h.Class('grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3'),
                  h.Role('group'),
                  h.AriaLabel(translate(locale, 'appearance.palettes')),
                ],
                themePresets.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return h.button(
                    [
                      h.Type('button'),
                      h.Class(
                        `theme-preset-card theme-preset-card--${preset.id} relative grid min-h-28 gap-2 overflow-hidden rounded-m3-large border p-3 text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-2 ${
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
                          h.span([h.Class('font-extrabold')], [themePresetName(locale, preset.id)]),
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
                  h.h3([h.Class('text-sm font-extrabold')], [translate(locale, 'appearance.mode')]),
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
                            `min-h-11 border-0 border-r border-outline last:border-r-0 font-bold cursor-pointer ${
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
                [h.Type('button'), h.Class(buttonSecondary), h.OnClick(ResetThemePreference())],
                [translate(locale, 'appearance.reset')],
              ),
            ],
          ),
        ],
      ),
      /**
       * The narrow layout has no sidebar, so this page is where its app-level
       * preferences live. Language sat at the end of every page before, which
       * made finding it depend on how far the student had scrolled; it is one
       * tap from the bottom bar here instead, and never competes with the
       * heading of the page being read.
       */
      h.section(
        [h.Class('grid gap-3 [@media(min-width:48rem)_and_(min-height:34rem)]:hidden')],
        [
          h.h2([h.Class(eyebrowClass)], [translate(locale, 'locale.label')]),
          h.div(
            [h.Class('w-[min(100%,20rem)]')],
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
      ),
      lazyProductFooter(productFooter, [locale]),
    ],
  );
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
                'grid w-[1.2rem] h-[1.2rem] place-items-center border-2 border-current rounded-[0.3rem] text-xs leading-none',
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
                [h.AriaLive('polite'), h.Class('text-on-surface-variant text-sm')],
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
            [h.Class('text-on-surface-variant text-sm')],
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
            isCourseSaved(model.savedCourses, course.code),
            savedToggleAvailability(model.savedCourses),
            listUrl(model),
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

/**
 * A course card's title anchor carries a whole-card `after:absolute
 * after:inset-0` overlay so the entire card opens Inspect. Any explicit
 * control or link placed inside such a card must share this stacking
 * treatment, or the overlay intercepts its clicks instead of the control.
 */
const aboveCardOverlayClass = 'relative z-[2]';

type SavedToggleTone = 'state' | 'destructive';

const savedToggleClass = (saved: boolean, tone: SavedToggleTone): string =>
  `${compactButtonBase} ${aboveCardOverlayClass} inline-flex min-h-11 flex-none items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${
    saved
      ? tone === 'destructive'
        ? 'border-error bg-error-container text-on-error-container'
        : 'border-secondary bg-secondary-container text-on-secondary-container'
      : 'border-outline bg-surface-container text-primary'
  }`;

/**
 * Saving is one action with a stable visible verb and a course-specific
 * accessible name. It sits above the whole-card Inspect target rather than
 * inside it, and it never waits for enrichment.
 *
 * Disabled has two distinct causes and never shares a message between them:
 * still loading is transient and self-resolving, while a recovery state is
 * not, so it is named separately and links to where the student can act.
 */
const savedCourseToggle = (
  courseCode: string,
  saved: boolean,
  availability: 'ready' | 'loading' | 'paused',
  locale: Locale,
  recoveryHref: string,
  tone: SavedToggleTone = 'state',
): Html => {
  const h = html<Message>();
  const ready = availability === 'ready';
  const accessibleLabel = translate(locale, saved ? 'list.removeCourse' : 'list.saveCourse', {
    code: courseCode,
  });
  const title =
    availability === 'ready'
      ? accessibleLabel
      : translate(locale, availability === 'loading' ? 'list.savePending' : 'list.savePaused');
  const button = Button.view<Message>({
    type: 'button',
    isDisabled: !ready,
    onClick: saved
      ? RequestedRemoveSavedCourse({ courseCode })
      : RequestedSaveCourse({ courseCode }),
    toView: (attributes) =>
      h.button(
        [
          ...attributes.button,
          h.Class(savedToggleClass(saved, tone)),
          h.AriaLabel(accessibleLabel),
          h.Title(title),
        ],
        [
          icon<Message>(saved ? 'check' : 'list', 'block size-4 [&_svg]:block [&_svg]:size-full'),
          h.span([], [translate(locale, saved ? 'list.remove' : 'list.save')]),
        ],
      ),
  });
  if (availability !== 'paused') return button;
  return h.span(
    [h.Class(`${aboveCardOverlayClass} inline-flex flex-col items-end gap-1`)],
    [
      button,
      h.a(
        [h.Href(recoveryHref), h.Class('text-xs leading-[1.3] underline text-on-surface-variant')],
        [translate(locale, 'list.savePausedLink')],
      ),
    ],
  );
};

const courseCardClass =
  '@container relative grid gap-4 p-[1.1rem] border border-outline-variant rounded-m3-large bg-surface-container-low transition-[border-color,box-shadow] duration-150 ease-in-out has-[a:hover]:border-primary has-[a:hover]:shadow-m3-1 has-[a:focus-visible]:border-primary has-[a:focus-visible]:shadow-m3-1 [@media(min-width:64rem)]:items-stretch [@media(min-width:64rem)]:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.65fr)]';

const factDtClass = 'text-current text-xs font-bold tracking-[0.05em] uppercase';

const factDdClass = 'mt-[0.2rem] text-sm leading-[1.35] [overflow-wrap:anywhere]';

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

/**
 * The factual cache stays separate from student-owned state: a saved course
 * borrows facts already loaded in this session and otherwise shows that they
 * were never requested.
 */
const catalogueItemForCode = (model: Model, courseCode: string): CourseSearchItemDtoType | null =>
  catalogueResponse(model.catalogue)?.items.find((item) => item.code === courseCode) ?? null;

const savedDecisionSignal = (
  model: Model,
  courseCode: string,
): CourseDecisionSignalsDtoType | null => {
  const signal = decisionSignalForCourse(model.decisionSignals, courseCode);
  return typeof signal === 'string' ? null : signal;
};

const savedGradeSignal = (model: Model, courseCode: string): CourseGradeSummaryDtoType | null => {
  const signal = gradeSignalForCourse(model.gradeSignals, courseCode);
  return typeof signal === 'string' ? null : signal;
};

const courseTitle = (course: CourseSearchItemDtoType, locale: Locale): string =>
  course.title.state === 'known'
    ? course.title.value
    : translate(locale, 'course.titleUnavailable');

/**
 * Identity and offering facts keep the same slots and order wherever a course
 * is summarized, so a missing value stays visible instead of disappearing.
 */
type CourseOffering = Extract<
  CourseSearchItemDtoType['offerings'],
  { readonly state: 'known' }
>['value'][number];

interface CourseOfferingFacts {
  readonly offering: CourseOffering | null;
  readonly place: string;
  readonly term: string;
  readonly credits: string;
}

/**
 * The identity and current offering, resolved once. Card and compact rows read
 * the same values, so a density choice can never change what a course is said
 * to be — and a non-known state stays the state it was, never a blank.
 */
const courseOfferingFacts = (
  course: CourseSearchItemDtoType,
  decisionSignal: DecisionSignal,
  locale: Locale,
): CourseOfferingFacts => {
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
  return { offering, place, term, credits };
};

const courseIdentityFacts = (
  course: CourseSearchItemDtoType,
  decisionSignal: DecisionSignal,
  locale: Locale,
): Html => {
  const h = html<Message>();
  const { offering, place, term, credits } = courseOfferingFacts(course, decisionSignal, locale);
  return h.dl(
    [h.Class('grid gap-x-4 gap-y-3 @min-[24rem]:grid-cols-2')],
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
  );
};

const courseCard = (
  href: string,
  course: CourseSearchItemDtoType,
  decisionSignal: DecisionSignal,
  gradeSignal: GradeSignal,
  locale: Locale,
  outcomeView: OutcomeView,
  saved: boolean,
  savedAvailability: 'ready' | 'loading' | 'paused',
  recoveryHref: string,
): Html => {
  const h = html<Message>();
  const title = courseTitle(course, locale);
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
                [h.Class('grid items-start gap-3 @min-[28rem]:grid-cols-[minmax(0,1fr)_auto]')],
                [
                  h.div(
                    [h.Class('min-w-0')],
                    [
                      h.p(
                        [
                          h.Class(
                            'mb-[0.3rem] text-primary text-xs font-extrabold tracking-[0.1em] uppercase',
                          ),
                        ],
                        [course.code],
                      ),
                      h.h3(
                        [h.Class('text-lg leading-[1.35] [overflow-wrap:anywhere]')],
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
                  savedCourseToggle(course.code, saved, savedAvailability, locale, recoveryHref),
                ],
              ),
              courseIdentityFacts(course, decisionSignal, locale),
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
        h.p([h.Class('m-0 text-sm leading-[1.4]')], [message]),
      ],
    );
  }

  if (signal.sourceStatus.status === 'failed') {
    return h.div(
      [h.Class(`${stateClass} bg-surface-container text-on-surface-variant`)],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'signals.heading')]),
        h.p([h.Class('m-0 text-sm leading-[1.4]')], [translate(locale, 'signals.failed')]),
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
            ? `flex w-full items-center justify-between gap-2 bg-secondary px-3 py-2 text-left text-on-secondary text-xs font-bold leading-[1.25] @min-[28rem]:w-auto @min-[28rem]:justify-center @min-[28rem]:px-2.5 @min-[28rem]:py-1.5 @min-[28rem]:text-center ${
                index === 0
                  ? ''
                  : 'border-t border-on-secondary/30 @min-[28rem]:border-t-0 @min-[28rem]:border-l'
              }`
            : 'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-on-secondary text-xs font-bold',
        ),
        ...(grouped
          ? [
              // tailwind-exempt: the growth factor is the assessment part's own
              // weight, so it exists only at render time.
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
        weight === null
          ? h.empty
          : h.span([h.Class('shrink-0 font-extrabold tabular-nums')], [weight]),
      ],
    );
  };
  const assessment =
    signal.assessment.state === 'known'
      ? parts.length === 0
        ? h.p([h.Class('m-0 text-sm')], [translate(locale, 'signals.noneReported')])
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
      : h.p([h.Class('m-0 text-sm')], [factStateLabel(signal.assessment.state, locale)]);
  const obligatory =
    signal.obligatoryActivities.state === 'known'
      ? signal.obligatoryActivities.value.length > 0
        ? h.div(
            [h.Class('flex flex-wrap items-center gap-1.5')],
            [
              h.span(
                [
                  h.Class(
                    'inline-flex min-h-7 items-center rounded-full bg-constraint px-2.5 text-xs font-extrabold text-on-constraint',
                  ),
                ],
                [translate(locale, 'signals.required')],
              ),
              h.span(
                [
                  h.Class(
                    'inline-flex min-h-7 items-center rounded-full bg-surface-container-highest px-2.5 text-xs font-extrabold text-on-surface-variant',
                  ),
                ],
                [translate(locale, 'signals.ungraded')],
              ),
              h.span(
                [h.Class('text-xs font-bold')],
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
        : h.p([h.Class('m-0 text-sm font-bold')], [translate(locale, 'signals.noneReported')])
      : h.p(
          [h.Class('m-0 text-sm font-bold')],
          [factStateLabel(signal.obligatoryActivities.state, locale)],
        );
  const collaboration =
    signal.collaboration.state === 'known'
      ? h.span(
          [
            h.Class(
              'inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-container-highest px-2.5 text-xs font-extrabold text-on-surface',
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
                  h.Class('m-0 shrink-0 text-xs font-bold'),
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
              h.dd([h.Class('m-0 text-sm font-bold')], [collaboration]),
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
      h.p([h.Class('m-0 text-sm leading-[1.4]')], [message]),
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
            h.p([h.Class('m-0 text-xs font-bold')], [translate(locale, 'outcomes.source')]),
          ],
        ),
        h.p(
          [h.Class('m-0 text-sm leading-[1.4]')],
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
              h.span([h.Class('text-xs font-bold')], [label]),
              h.span(
                [h.Class('text-xs font-extrabold tabular-nums')],
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
                // tailwind-exempt: the sweep angle is the observed pass share.
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
          // tailwind-exempt: one column per observed grade bucket.
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
                    // tailwind-exempt: bar height is this bucket's share of the
                    // tallest observed bucket.
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
              [h.Class('text-center text-xs font-extrabold leading-none')],
              [gradeDisplayLabel(bucket.grade, locale)],
            ),
          ),
        ],
      );

  const toggle = hasBothScales
    ? h.div(
        [
          h.Class(
            `${aboveCardOverlayClass} grid grid-cols-2 overflow-hidden rounded-full border border-outline bg-surface-container-low`,
          ),
          h.Role('group'),
          h.AriaLabel(translate(locale, 'outcomes.view')),
        ],
        (['letter', 'pass-fail'] as const).map((view) =>
          h.button(
            [
              h.Type('button'),
              h.Class(
                `min-h-11 cursor-pointer border-0 px-3 text-xs font-extrabold ${
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
              h.p([h.Class('m-0 text-xs font-bold')], [scale]),
            ],
          ),
          h.span(
            [h.Class('text-xs font-extrabold tracking-[0.04em] uppercase')],
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
            : h.p([h.Class('m-0 text-xs font-semibold leading-[1.35]')], [metadata.join(' · ')]),
        ],
      ),
    ],
  );
};

const selectedCourseView = (model: Model): Html => {
  const h = html<Message>();
  const selectedCode = model.selectedCode;
  return h.div(
    [h.Class('grid gap-4 pt-4')],
    [
      h.div(
        [
          /**
           * Saving is the decision this page exists to support, so it stays
           * reachable while the evidence below is read rather than only at the
           * top of a long scroll. The row sits above the whole-card overlay
           * (z-2) and below the fixed dialogs, and carries the surface colour
           * so content passes beneath it instead of through it.
           */
          h.Class(
            'sticky top-0 z-[3] flex flex-wrap items-center justify-between gap-3 bg-surface py-2',
          ),
        ],
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
          selectedCode === null
            ? h.empty
            : savedCourseToggle(
                selectedCode,
                isCourseSaved(model.savedCourses, selectedCode),
                savedToggleAvailability(model.savedCourses),
                model.locale,
                listUrl(model),
              ),
        ],
      ),
      detailResultView(model.detail, model.locale),
    ],
  );
};

const listHeader = (locale: Locale): Html => {
  const h = html<Message>();
  return h.header(
    [h.Class('pt-[clamp(1.5rem,4vw,3rem)] pb-2 grid gap-4')],
    [
      h.div(
        [],
        [
          h.p([h.Class(eyebrowClass)], [translate(locale, 'list.eyebrow')]),
          h.h1(
            [
              h.Class(
                'max-w-[22ch] text-[clamp(2rem,5vw,3.25rem)] font-bold tracking-[-0.05em] leading-none',
              ),
            ],
            [translate(locale, 'list.heading')],
          ),
          h.p(
            [h.Class('max-w-192 mt-4 text-on-surface-variant text-base leading-[1.6]')],
            [translate(locale, 'list.intro')],
          ),
        ],
      ),
    ],
  );
};

/**
 * Label colours come from repository-owned semantic label tokens that are
 * independent of the active theme accent, with checked light and dark pairs.
 * Colour is decoration: every chip also carries the label name as text.
 */
const labelChipTone = (color: LabelColor): string =>
  M.value(color).pipe(
    M.when('violet', () => 'bg-label-violet text-on-label-violet'),
    M.when('amber', () => 'bg-label-amber text-on-label-amber'),
    M.when('rose', () => 'bg-label-rose text-on-label-rose'),
    M.when('emerald', () => 'bg-label-emerald text-on-label-emerald'),
    M.when('sky', () => 'bg-label-sky text-on-label-sky'),
    M.exhaustive,
  );

const labelDotTone = (color: LabelColor): string =>
  M.value(color).pipe(
    M.when('violet', () => 'bg-label-violet'),
    M.when('amber', () => 'bg-label-amber'),
    M.when('rose', () => 'bg-label-rose'),
    M.when('emerald', () => 'bg-label-emerald'),
    M.when('sky', () => 'bg-label-sky'),
    M.exhaustive,
  );

const labelColorName = (color: LabelColor, locale: Locale): string =>
  M.value(color).pipe(
    M.when('violet', () => translate(locale, 'label.colorViolet')),
    M.when('amber', () => translate(locale, 'label.colorAmber')),
    M.when('rose', () => translate(locale, 'label.colorRose')),
    M.when('emerald', () => translate(locale, 'label.colorEmerald')),
    M.when('sky', () => translate(locale, 'label.colorSky')),
    M.exhaustive,
  );

const labelChipClass = (color: LabelColor): string =>
  `inline-flex min-h-7 items-center gap-1.5 rounded-full border border-outline-variant px-2.5 text-xs font-bold ${labelChipTone(color)}`;

const labelChip = (label: Label, id: string | null = null): Html => {
  const h = html<Message>();
  return h.span(
    [h.Class(labelChipClass(label.color)), ...(id === null ? [] : [h.Id(id)])],
    [label.name],
  );
};

const labelDot = (color: LabelColor): Html => {
  const h = html<Message>();
  return h.span(
    [
      h.Class(
        `size-2.5 flex-none rounded-full border border-outline-variant ${labelDotTone(color)}`,
      ),
      h.AriaHidden(true),
    ],
    [],
  );
};

/** The count is visible as a number and named for assistive technology, so the
 *  chip never depends on the digit alone to explain itself. */
const labelCountBadge = (count: number, locale: Locale): Html => {
  const h = html<Message>();
  return h.span(
    [h.Class('inline-flex items-center gap-1')],
    [
      h.span([h.Class('tabular-nums')], [String(count)]),
      h.span(
        [h.Class('sr-only')],
        [translate(locale, count === 1 ? 'list.labelCountUnitOne' : 'list.labelCountUnit')],
      ),
    ],
  );
};

/**
 * A saved row is selectable, and looks it. Selection used to be reported only
 * by a small box at the row's edge, which left the row reading as a static
 * item that happened to have a control on it. The whole row carries the state
 * now — border and surface — so what is selected is legible from a glance down
 * the column rather than from the checkboxes alone.
 */
const savedRowClass = (isSelected: boolean): string =>
  `@container grid gap-4 p-[1.1rem] rounded-m3-large border transition-[background-color,border-color] duration-150 ease-in-out ${
    isSelected
      ? 'border-primary bg-primary-container/40'
      : 'border-outline-variant bg-surface-container-low'
  }`;

/**
 * A saved row is a single column first, and becomes a row only once it has the
 * width for one.
 *
 * The arrangement answers to the row's own width rather than the viewport's,
 * so it holds inside the sidebar-offset column and inside a comparison just as
 * it does on a phone. Selection and identity stay adjacent because they name
 * the same thing; the controls that act on the course take the far side when
 * there is a far side, and the line below it when there is not — which is what
 * keeps a long title from having to share a line it cannot fit on.
 */
const savedRowHeaderClass =
  'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 @min-[32rem]:grid-cols-[auto_minmax(0,1fr)_auto]';

const savedRowActionsClass =
  'col-span-2 flex flex-wrap items-center gap-2 @min-[32rem]:col-span-1 @min-[32rem]:col-start-3 @min-[32rem]:row-start-1 @min-[32rem]:justify-end';

const rowCheckboxClass =
  'grid size-6 flex-none place-items-center rounded-[0.4rem] border-2 border-outline text-sm leading-none cursor-pointer has-[[data-checked]]:border-primary';

const noteFieldClass =
  'w-full min-h-20 p-3 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-base leading-[1.45] focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)]';

/**
 * A saved row shows the student's own material (identity, note, actions) plus
 * whatever official facts this session already loaded. It never invents a fact
 * state for a course whose evidence was not requested.
 */
const savedCourseRow = (
  href: string,
  course: SavedCourse,
  state: SavedListState,
  item: CourseSearchItemDtoType | null,
  decisionSignal: CourseDecisionSignalsDtoType | null,
  gradeSignal: CourseGradeSummaryDtoType | null,
  noteDraft: string,
  isSelected: boolean,
  locale: Locale,
  outcomeView: OutcomeView,
  density: ListDensity,
): Html => {
  const h = html<Message>();
  const noteFieldId = `saved-note-${course.courseCode}`;
  const noteHelpId = `${noteFieldId}-help`;
  const title = item === null ? null : courseTitle(item, locale);
  const openLabel = translate(locale, 'list.openCourse', { code: course.courseCode });
  const identity = courseIdentity(course.courseCode);
  const labels = identity === null ? [] : labelsForSavedCourse(state, identity);
  const selectionCheckbox = Checkbox.view<Message>({
    id: `select-${course.courseCode}`,
    isChecked: isSelected,
    onToggle: (checked) =>
      ToggledSavedCourseSelection({ courseCode: course.courseCode, isSelected: checked }),
    toView: (attributes) =>
      h.label(
        [
          ...attributes.label,
          // The visual box stays compact; the label keeps a 44px touch target.
          h.Class('flex min-h-11 min-w-11 flex-none items-center justify-center cursor-pointer'),
        ],
        [
          h.span([...attributes.checkbox, h.Class(rowCheckboxClass)], [isSelected ? '✓' : '']),
          h.span(
            [h.Class('sr-only')],
            [translate(locale, 'list.selectCourse', { code: course.courseCode })],
          ),
        ],
      ),
  });
  const labelsAction = Button.view<Message>({
    type: 'button',
    onClick: RequestedLabelDialog({ courseCodes: [course.courseCode] }),
    toView: (attributes) =>
      h.button(
        [
          ...attributes.button,
          h.Class(
            `${compactButtonBase} inline-flex min-h-11 items-center gap-1.5 rounded-[1.5rem] border border-outline bg-surface-container px-3 text-sm font-bold text-primary`,
          ),
          h.AriaLabel(translate(locale, 'list.editLabelsFor', { code: course.courseCode })),
          h.AriaHasPopup('dialog'),
          h.AriaControls('saved-course-labels'),
        ],
        [translate(locale, 'list.openLabels')],
      ),
  });
  const identityBlock = h.div(
    [h.Class('min-w-0 flex-1')],
    [
      h.p(
        [h.Class('mb-[0.3rem] text-primary text-xs font-extrabold tracking-[0.1em] uppercase')],
        [course.courseCode],
      ),
      h.h3(
        [
          // Density changes how much surrounds a saved course, never how
          // legible it is: compact buys its scan line from padding and gaps,
          // so the title keeps one size in both views.
          //
          // Real catalogue titles are long and arrive with enrichment, so the
          // text has to be allowed to break: a word that refuses to wrap sets
          // a floor under the row that a narrow screen cannot honour.
          h.Class('text-lg [overflow-wrap:anywhere]'),
        ],
        [
          h.a(
            [
              h.Href(href),
              h.AriaLabel(
                title === null
                  ? openLabel
                  : translate(locale, 'course.open', {
                      code: course.courseCode,
                      title,
                    }),
              ),
              h.Class('text-on-surface'),
            ],
            [title ?? openLabel],
          ),
        ],
      ),
    ],
  );
  const labelsBlock = h.div(
    [
      h.Class('flex flex-wrap items-center gap-2'),
      h.Role('group'),
      h.AriaLabel(translate(locale, 'list.rowLabels', { code: course.courseCode })),
    ],
    [
      ...labels.map((label) => labelChip(label)),
      labels.length === 0
        ? h.span(
            [h.Class('text-on-surface-variant text-sm')],
            [translate(locale, 'list.rowNoLabels')],
          )
        : h.empty,
    ],
  );

  /** Both controls that act on this row, kept together at its end. */
  const rowActions = h.div(
    [h.Class(savedRowActionsClass)],
    [labelsAction, savedCourseToggle(course.courseCode, true, 'ready', locale, '', 'destructive')],
  );
  /**
   * Compact keeps the same saved-course identity, its current offering, its
   * labels, and its primary actions in one scan line. The evidence, findings,
   * and private note are not rewritten or summarized here — they stay whole in
   * card view and in Inspect, so density never changes what is known.
   */
  if (density === 'compact') {
    const facts =
      item === null ? null : courseOfferingFacts(item, decisionSignal ?? 'idle', locale);
    return h.li(
      [],
      [
        h.article(
          [h.Class(`${savedRowClass(isSelected)} gap-2 p-[0.8rem]`)],
          [
            h.div([h.Class(savedRowHeaderClass)], [selectionCheckbox, identityBlock, rowActions]),
            h.p(
              [h.Class('m-0 text-on-surface-variant text-sm leading-[1.4]')],
              [
                facts === null
                  ? translate(locale, 'list.factsNotLoaded')
                  : `${facts.credits} · ${facts.term} · ${facts.place}`,
              ],
            ),
            labelsBlock,
          ],
        ),
      ],
    );
  }
  return h.li(
    [],
    [
      h.article(
        [h.Class(savedRowClass(isSelected))],
        [
          h.div([h.Class(savedRowHeaderClass)], [selectionCheckbox, identityBlock, rowActions]),
          labelsBlock,
          item === null
            ? h.div(
                [
                  h.Class(
                    'grid gap-1 p-3 rounded-m3-medium bg-surface-container text-on-surface-variant',
                  ),
                ],
                [
                  h.p([h.Class(factDtClass)], [translate(locale, 'list.factsNotLoaded')]),
                  h.p(
                    [h.Class('m-0 text-sm leading-[1.4]')],
                    [translate(locale, 'list.factsNotLoadedHelp')],
                  ),
                ],
              )
            : courseIdentityFacts(item, decisionSignal ?? 'idle', locale),
          decisionSignal === null && gradeSignal === null
            ? h.empty
            : h.div(
                [
                  h.Class(
                    'grid min-w-0 gap-3 [@media(min-width:64rem)]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]',
                  ),
                ],
                [
                  decisionSignal === null ? h.empty : decisionSignalView(decisionSignal, locale),
                  gradeSignal === null
                    ? h.empty
                    : gradeSignalView(gradeSignal, locale, outcomeView),
                ],
              ),
          h.form(
            [
              h.Class('grid gap-2'),
              h.OnSubmit(SubmittedSavedNote({ courseCode: course.courseCode })),
            ],
            [
              h.label(
                [h.For(noteFieldId), h.Class(fieldLabelClass)],
                [translate(locale, 'list.note')],
              ),
              h.textarea(
                [
                  h.Id(noteFieldId),
                  h.Rows(2),
                  h.Value(noteDraft),
                  h.Placeholder(translate(locale, 'list.notePlaceholder')),
                  h.AriaDescribedBy(noteHelpId),
                  h.Class(noteFieldClass),
                  h.OnInput((value) =>
                    UpdatedSavedNoteDraft({ courseCode: course.courseCode, value }),
                  ),
                ],
                [],
              ),
              h.p(
                [h.Id(noteHelpId), h.Class('m-0 text-on-surface-variant text-xs leading-[1.4]')],
                [translate(locale, 'list.noteHelp')],
              ),
              h.div(
                [h.Class('flex flex-wrap gap-3')],
                [
                  Button.view<Message>({
                    type: 'submit',
                    toView: (attributes) =>
                      h.button(
                        [
                          ...attributes.button,
                          h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                        ],
                        [translate(locale, 'list.saveNote')],
                      ),
                  }),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

const savedCountLabel = (count: number, locale: Locale): string =>
  count === 1 ? translate(locale, 'list.countOne') : translate(locale, 'list.countMany', { count });

const nameList = (
  names: ReadonlyArray<string>,
  locale: Locale,
  type: 'conjunction' | 'disjunction',
): string => new Intl.ListFormat(localeTag(locale), { style: 'long', type }).format(names);

const labelsFromIds = (
  state: SavedListState,
  labelIds: ReadonlyArray<string>,
): ReadonlyArray<Label> =>
  labelIds
    .map((labelId) => findLabel(state, labelId))
    .filter((label): label is Label => label !== null);

/**
 * The names a filter group selects, with the derived `Unlabeled` set reading as
 * one more name so the restated sentence never has to special-case it.
 */
const predicateNames = (
  state: SavedListState,
  labelIds: ReadonlyArray<string>,
  unlabeled: boolean,
  locale: Locale,
): ReadonlyArray<string> => [
  ...labelsFromIds(state, labelIds).map((label) => label.name),
  ...(unlabeled ? [translate(locale, 'list.filterUnlabeled')] : []),
];

/**
 * The active recipe restated in the student's language. `All` reads as a
 * conjunction and `Any` as a disjunction, so the sentence and the switch can
 * never disagree about what is being shown.
 */
const labelFilterSummary = (state: SavedListState, filter: LabelFilter, locale: Locale): string => {
  const included = predicateNames(state, filter.includeLabelIds, filter.includeUnlabeled, locale);
  const excluded = predicateNames(state, filter.excludeLabelIds, filter.excludeUnlabeled, locale);
  const includedText = nameList(
    included,
    locale,
    filter.includeMode === 'all' ? 'conjunction' : 'disjunction',
  );
  const excludedText = nameList(excluded, locale, 'conjunction');
  if (included.length > 0 && excluded.length > 0) {
    return translate(locale, 'list.filterSummaryBoth', {
      labels: includedText,
      excluded: excludedText,
    });
  }
  if (included.length > 0) {
    return translate(locale, 'list.filterSummaryInclude', { labels: includedText });
  }
  if (excluded.length > 0) {
    return translate(locale, 'list.filterSummaryExclude', { excluded: excludedText });
  }
  return translate(locale, 'list.filterSummaryNone');
};

const labelFilterChipClass = (included: boolean): string =>
  `${compactButtonBase} inline-flex min-h-11 items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${
    included
      ? 'border-primary bg-primary-container text-on-primary-container'
      : 'border-outline bg-surface-container text-on-surface'
  }`;

/**
 * One exclusion control for every predicate: a real label carries its colour
 * dot, the derived `Unlabeled` set carries none, and both read the same way.
 */
const excludeCheckbox = (
  id: string,
  isExcluded: boolean,
  predicate: LabelPredicate,
  name: string,
  dot: Html,
  locale: Locale,
): Html => {
  const h = html<Message>();
  return Checkbox.view<Message>({
    id,
    isChecked: isExcluded,
    onToggle: (checked) => ChangedLabelExclusion({ predicate, isExcluded: checked }),
    toView: (attributes) =>
      h.label(
        [
          ...attributes.label,
          h.Class(
            'inline-flex min-h-11 items-center gap-[0.55rem] rounded-[1.5rem] border border-outline px-3 text-sm text-on-surface-variant cursor-pointer has-[[data-checked]]:border-error has-[[data-checked]]:bg-error-container has-[[data-checked]]:text-on-error-container',
          ),
        ],
        [
          h.span(
            [
              ...attributes.checkbox,
              h.Class(
                'grid size-[1.15rem] place-items-center rounded-[0.3rem] border-2 border-current text-xs leading-none',
              ),
            ],
            [isExcluded ? '✓' : ''],
          ),
          dot,
          h.span([], [translate(locale, 'list.filterExclude', { name })]),
        ],
      ),
  });
};

/**
 * Label chips are the ordinary path: tap a label to include it. `All` and
 * `Exclude` live behind one progressive disclosure, so the common case stays a
 * single tap and the bounded composition is still reachable by keyboard.
 */
const labelFilterView = (model: Model, state: SavedListState): Html => {
  const h = html<Message>();
  const locale = model.locale;
  const labels = labelsByName(state);
  if (labels.length === 0) {
    return h.section(
      [
        h.Class(
          'grid gap-2 p-4 border border-outline-variant rounded-m3-large bg-surface-container-low',
        ),
        h.AriaLabel(translate(locale, 'list.labels')),
      ],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'list.labelsHeading')]),
        h.p(
          [h.Class('m-0 text-on-surface-variant text-sm leading-[1.45]')],
          [translate(locale, 'list.noLabels')],
        ),
        h.div([h.Class('flex')], [labelDialogAction([], locale)]),
      ],
    );
  }
  const filter = model.labelFilter;
  const included = new Set(filter.includeLabelIds);
  const excluded = new Set(filter.excludeLabelIds);
  const contradictory = predicateNames(
    state,
    model.labelFilterNotice?.contradictoryLabelIds ?? [],
    model.labelFilterNotice?.contradictoryUnlabeled ?? false,
    locale,
  );
  const unknownCount = model.labelFilterNotice?.unknownCount ?? 0;
  const unsatisfiable = normalizeLabelFilter(state, filter).isUnsatisfiable;
  const unlabeledName = translate(locale, 'list.filterUnlabeled');
  /**
   * `Unlabeled` sits with the label chips because it is one more way to name a
   * collection, but it is derived from membership rather than stored: it has no
   * colour swatch, cannot be renamed, and cannot go stale.
   */
  const unlabeledChip = Button.view<Message>({
    type: 'button',
    onClick: ChangedLabelInclusion({
      predicate: filterUnlabeled,
      isIncluded: !filter.includeUnlabeled,
    }),
    toView: (attributes) =>
      h.button(
        [
          ...attributes.button,
          h.Class(`${labelFilterChipClass(filter.includeUnlabeled)} border-dashed`),
          h.AriaPressed(String(filter.includeUnlabeled)),
        ],
        [
          h.span([], [unlabeledName]),
          labelCountBadge(unlabeledCourseCount(state), locale),
          filter.excludeUnlabeled
            ? h.span(
                [h.Class('text-xs font-extrabold uppercase')],
                [translate(locale, 'list.filterExcludedBadge')],
              )
            : h.empty,
        ],
      ),
  });
  const includeChips = labels.map((label) =>
    Button.view<Message>({
      type: 'button',
      onClick: ChangedLabelInclusion({
        predicate: filterLabel(label.id),
        isIncluded: !included.has(label.id),
      }),
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(labelFilterChipClass(included.has(label.id))),
            h.AriaPressed(String(included.has(label.id))),
          ],
          [
            labelDot(label.color),
            h.span([], [label.name]),
            labelCountBadge(labelCourseCount(state, label.id), locale),
            excluded.has(label.id)
              ? h.span(
                  [h.Class('text-xs font-extrabold uppercase')],
                  [translate(locale, 'list.filterExcludedBadge')],
                )
              : h.empty,
          ],
        ),
    }),
  );

  /**
   * `Any` and `All` only differ once two predicates are included: with one,
   * both readings select the same courses, so offering the choice would be
   * offering nothing. The switch appears when it starts to mean something, and
   * carries the size of each outcome so the decision reads as a result rather
   * than as a connective.
   */
  const includedPredicateCount = filter.includeLabelIds.length + (filter.includeUnlabeled ? 1 : 0);
  const countFor = (mode: LabelFilterMode): number =>
    filterSavedCourses(state, { ...filter, includeMode: mode }).length;
  const includeModeControl =
    includedPredicateCount < 2
      ? h.empty
      : RadioGroup.view<LabelFilterMode, Message>({
          id: 'label-filter-mode',
          selectedValue: Option.some(filter.includeMode),
          options: labelFilterModes,
          ariaLabel: translate(locale, 'list.filterMode'),
          onSelect: (mode) => ChangedLabelFilterMode({ mode }),
          toView: ({ group, options }) =>
            h.div(
              [
                ...group,
                h.Class('inline-flex w-fit overflow-hidden rounded-full border border-outline'),
              ],
              options.map((option) =>
                h.button(
                  [
                    ...option.option,
                    h.Class(
                      `min-h-11 cursor-pointer border-0 px-4 text-sm font-extrabold ${
                        option.isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface'
                      }`,
                    ),
                  ],
                  [
                    translate(
                      locale,
                      option.value === 'all' ? 'list.filterModeAll' : 'list.filterModeAny',
                    ),
                    h.span(
                      [h.Class('ml-2 font-bold tabular-nums opacity-[0.75]')],
                      [countFor(option.value).toLocaleString(localeTag(locale))],
                    ),
                  ],
                ),
              ),
            ),
        });

  return h.section(
    [
      h.Class(
        'grid gap-3 p-4 border border-outline-variant rounded-m3-large bg-surface-container-low',
      ),
      h.AriaLabel(translate(locale, 'list.filterHeading')),
    ],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.p([h.Class(factDtClass)], [translate(locale, 'list.filterHeading')]),
          labelDialogAction([], locale),
        ],
      ),
      /**
       * Include and Exclude are peers, so they are shown as peers. Exclusion
       * used to live behind a disclosure, which made the harder half of the
       * language the hidden half.
       */
      h.div(
        [h.Class('grid gap-2')],
        [
          h.div(
            [h.Class('flex flex-wrap items-center justify-between gap-2')],
            [
              h.p([h.Class(factDtClass)], [translate(locale, 'list.filterIncludeHeading')]),
              includeModeControl,
            ],
          ),
          h.div(
            [
              h.Class('flex flex-wrap gap-2'),
              h.Role('group'),
              h.AriaLabel(translate(locale, 'list.filterIncludeHeading')),
            ],
            [...includeChips, unlabeledChip],
          ),
        ],
      ),
      h.div(
        [h.Class('grid gap-2')],
        [
          h.p([h.Class(factDtClass)], [translate(locale, 'list.filterExcludeHeading')]),
          h.div(
            [
              h.Class('flex flex-wrap gap-2'),
              h.Role('group'),
              h.AriaLabel(translate(locale, 'list.filterExcludeHeading')),
            ],
            [
              ...labels.map((label) =>
                excludeCheckbox(
                  `exclude-${label.id}`,
                  excluded.has(label.id),
                  filterLabel(label.id),
                  label.name,
                  labelDot(label.color),
                  locale,
                ),
              ),
              excludeCheckbox(
                'exclude-unlabeled',
                filter.excludeUnlabeled,
                filterUnlabeled,
                unlabeledName,
                h.empty,
                locale,
              ),
            ],
          ),
          h.p(
            [h.Class('m-0 text-on-surface-variant text-xs leading-[1.45]')],
            [translate(locale, 'list.filterExcludeHelp')],
          ),
        ],
      ),
      h.p(
        [h.Class('m-0 text-on-surface-variant text-sm leading-[1.45]'), h.AriaLive('polite')],
        [labelFilterSummary(state, filter, locale)],
      ),
      contradictory.length === 0
        ? h.empty
        : h.p(
            [
              h.Class(
                'm-0 py-2 px-3 rounded-m3-medium bg-warning-container text-on-warning-container text-sm leading-[1.4]',
              ),
              h.Role('status'),
            ],
            [
              translate(locale, 'list.filterContradiction', {
                labels: nameList(contradictory, locale, 'conjunction'),
              }),
            ],
          ),
      // An `All` of Unlabeled and a real label cannot match anything: a course
      // either carries a label or carries none. The recipe is kept as asked and
      // explained here, rather than silently rewritten or shown as an empty List
      // with no reason.
      unsatisfiable
        ? h.p(
            [
              h.Class(
                'm-0 py-2 px-3 rounded-m3-medium bg-warning-container text-on-warning-container text-sm leading-[1.4]',
              ),
              h.Role('status'),
            ],
            [translate(locale, 'list.filterUnsatisfiable', { unlabeled: unlabeledName })],
          )
        : h.empty,
      unknownCount === 0
        ? h.empty
        : h.p(
            [
              h.Class(
                'm-0 py-2 px-3 rounded-m3-medium bg-warning-container text-on-warning-container text-sm leading-[1.4]',
              ),
              h.Role('status'),
            ],
            [translate(locale, 'list.filterUnknownDropped', { count: unknownCount })],
          ),
      isLabelFilterActive(filter)
        ? Button.view<Message>({
            type: 'button',
            onClick: ClearedLabelFilter(),
            toView: (attributes) =>
              h.button(
                [
                  ...attributes.button,
                  h.Class(`${compactButtonBase} ${buttonSecondary} justify-self-start min-h-11`),
                ],
                [translate(locale, 'list.filterClear')],
              ),
          })
        : h.empty,
    ],
  );
};

const labelDialogAction = (courseCodes: ReadonlyArray<string>, locale: Locale): Html => {
  const h = html<Message>();
  const forSelection = courseCodes.length > 0;
  return Button.view<Message>({
    type: 'button',
    onClick: RequestedLabelDialog({ courseCodes }),
    toView: (attributes) =>
      h.button(
        [
          ...attributes.button,
          h.Class(groupedAction('neutral')),
          h.AriaHasPopup('dialog'),
          h.AriaControls('saved-course-labels'),
          ...(forSelection ? [] : [h.AriaLabel(translate(locale, 'list.labelsManageOnly'))]),
        ],
        [translate(locale, forSelection ? 'list.selectionAddLabels' : 'list.labels')],
      ),
  });
};

const selectionTrayClass =
  '@container pointer-events-auto grid gap-3 p-3 border border-outline rounded-[1.5rem] bg-surface-container-high shadow-m3-2 @min-[28rem]:flex @min-[28rem]:flex-wrap @min-[28rem]:items-center @min-[28rem]:justify-between';

/**
 * Layout answers to a container's own width at three named widths, and only
 * those three. They are a scale, not measurements: six hand-picked thresholds
 * had accumulated, which is the same drift as hand-picked font sizes — numbers
 * near enough to look deliberate and far enough apart to disagree.
 *
 *   24rem  two short facts can sit side by side
 *   28rem  a group of controls becomes a row
 *   32rem  a header gives its controls the far side
 *
 * Tailwind reads class names out of source text, so these cannot be composed
 * from a variable — `${threshold}:grid-cols-2` is never generated. The scale
 * therefore lives as literal strings held in named constants, and
 * `tests/architecture.test.ts` keeps a fourth from appearing.
 */

/**
 * A group of controls: one full-width column first, a row once the container
 * has the width for one.
 *
 * Stacked, buttons share a width and centre their labels, so the column reads
 * as one block of choices rather than a ragged edge of differently sized
 * pills. Side by side they take only the width their labels need. Either way
 * the group answers to its own container, so the same rule holds in a tray
 * pinned above the bottom bar and in a panel inside the reading column.
 */
const controlGroupClass =
  'grid gap-2 [&>*]:w-full [&>*]:justify-center @min-[28rem]:flex @min-[28rem]:flex-wrap @min-[28rem]:items-center @min-[28rem]:[&>*]:w-auto';

/**
 * Everything that hovers over the page bottom shares one stack, so the pieces
 * space themselves instead of each guessing the other's height — a guess that
 * breaks the moment a message wraps to a second line. The container ignores
 * pointer events; the cards inside take them back, so the page underneath
 * stays clickable through the gaps.
 *
 * It clears the bottom bar on the narrow layout and settles into the corner on
 * a wide one, where a full-width bar would be a banner across the reading
 * column rather than a notice beside it.
 */
const bottomStackClass =
  'pointer-events-none fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-11 grid justify-items-stretch gap-2 [@media(min-width:48rem)_and_(min-height:34rem)]:inset-x-auto [@media(min-width:48rem)_and_(min-height:34rem)]:right-4 [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-4 [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-2rem),28rem)]';

/** The selected saved courses, resolved once for whatever needs to act on them. */
const selectedSavedCourses = (model: Model): ReadonlyArray<SavedCourse> => {
  const state = savedListState(model.savedCourses);
  // The tray acts on rows of the saved list, so it belongs to that page only.
  if (state === null || model.route !== 'list') return [];
  const selectedCodes = new Set(model.selectedCourseCodes);
  return savedCoursesNewestFirst(state).filter((course) => selectedCodes.has(course.courseCode));
};

const bottomStackView = (model: Model, selected: ReadonlyArray<SavedCourse>): Html => {
  const h = html<Message>();
  const status = savedListActionStatus(model);
  const tray = selectionTrayView(model, selected);
  /**
   * Refine floats over the same region, so it belongs to the same stack.
   * Centred in its own fixed box it landed on top of a notice; here the stack
   * spaces them, and the rule stays "one owner of the page bottom".
   */
  const refine =
    model.route === 'explore' && model.selectedCode === null
      ? catalogueRefineAction(model)
      : h.empty;
  if (status === h.empty && tray === h.empty && refine === h.empty) return h.empty;
  return h.div([h.Class(bottomStackClass)], [status, tray, refine]);
};

/**
 * Selection is distinct from saving and stays ephemeral: it lives only in the
 * session, and the tray disappears with it.
 *
 * Labelling leads because it is the additive act. Removal is secondary and
 * asks first, because it discards notes and label attachments across several
 * courses at once — the confirmation swaps the tray's actions in place rather
 * than opening a dialog, matching how deleting a label already asks. A single
 * course still removes without a prompt: undo restores it, and prompting for
 * a reversible act only teaches the student to dismiss prompts.
 */
const selectionTrayView = (model: Model, selected: ReadonlyArray<SavedCourse>): Html => {
  const h = html<Message>();
  if (selected.length === 0) return h.empty;
  const locale = model.locale;
  return h.div(
    [
      h.Class(selectionTrayClass),
      h.Role('region'),
      h.AriaLabel(translate(locale, 'list.selectionTray')),
    ],
    [
      h.p(
        [h.Class('m-0 font-bold'), h.AriaLive('polite')],
        [
          selected.length === 1
            ? translate(locale, 'list.selectionCountOne')
            : translate(locale, 'list.selectionCount', { count: selected.length }),
        ],
      ),
      model.selectionRemovePending
        ? h.div(
            [h.Class(`${controlGroupClass} @container`), h.Role('group')],
            [
              h.p(
                [h.Class('m-0 basis-full text-sm leading-[1.45]'), h.Role('status')],
                [translate(locale, 'list.selectionRemoveConfirm', { count: selected.length })],
              ),
              Button.view<Message>({
                type: 'button',
                onClick: ConfirmedRemoveSelected(),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(
                        `${compactButtonBase} min-h-11 rounded-[1.5rem] border border-error bg-error-container px-3 text-sm font-bold text-on-error-container`,
                      ),
                    ],
                    [translate(locale, 'list.selectionRemoveConfirmAction')],
                  ),
              }),
              Button.view<Message>({
                type: 'button',
                onClick: CancelledRemoveSelected(),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                    ],
                    [translate(locale, 'list.selectionRemoveCancel')],
                  ),
              }),
            ],
          )
        : h.div(
            [h.Class(controlGroupClass)],
            [
              selected.length < compareMinimum || selected.length > compareMaximum
                ? h.empty
                : Button.view<Message>({
                    type: 'button',
                    onClick: RequestedCompare(),
                    toView: (attributes) =>
                      h.button(
                        [
                          ...attributes.button,
                          h.Class(`${compactButtonBase} ${buttonPrimary} min-h-11`),
                        ],
                        [translate(locale, 'compare.open')],
                      ),
                  }),
              labelDialogAction(
                selected.map((course) => course.courseCode),
                locale,
              ),
              Button.view<Message>({
                type: 'button',
                onClick: ClearedSavedCourseSelection(),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                    ],
                    [translate(locale, 'list.selectionClear')],
                  ),
              }),
              Button.view<Message>({
                type: 'button',
                onClick: RequestedRemoveSelected(),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(
                        `${compactButtonBase} min-h-11 rounded-[1.5rem] border border-error bg-error-container px-3 text-sm font-bold text-on-error-container`,
                      ),
                    ],
                    [translate(locale, 'list.selectionRemove')],
                  ),
              }),
            ],
          ),
    ],
  );
};

const recoveryMessage = (
  recovery: Extract<SavedCoursesResult, { readonly _tag: 'SavedCoursesRecovery' }>,
  locale: Locale,
): string =>
  M.value(recovery.reason).pipe(
    M.when('unavailable', () => translate(locale, 'list.recoveryUnavailable')),
    M.when('unsupported-version', () =>
      translate(locale, 'list.recoveryUnsupported', {
        version: recovery.storedVersion ?? '?',
      }),
    ),
    M.when('invalid-json', () => translate(locale, 'list.recoveryCorrupt')),
    M.when('unreadable', () => translate(locale, 'list.recoveryCorrupt')),
    M.exhaustive,
  );

/**
 * Recovery never resets anything by itself: the stored value stays readable
 * and the destructive reset is an explicit student action.
 */
const savedCoursesRecoveryView = (
  recovery: Extract<SavedCoursesResult, { readonly _tag: 'SavedCoursesRecovery' }>,
  locale: Locale,
): Html => {
  const h = html<Message>();
  return h.section(
    [
      h.Class(
        'grid gap-3 p-[clamp(1.25rem,4vw,2rem)] border border-error rounded-m3-extra-large bg-error-container text-on-error-container',
      ),
      h.Role('alert'),
    ],
    [
      h.h2(
        [h.Class('text-[clamp(1.3rem,3vw,1.75rem)]')],
        [translate(locale, 'list.recoveryHeading')],
      ),
      h.p([h.Class('m-0 leading-[1.5]')], [recoveryMessage(recovery, locale)]),
      h.p([h.Class('m-0 leading-[1.5]')], [translate(locale, 'list.savePaused')]),
      recovery.raw.length === 0
        ? h.empty
        : h.details(
            [h.Class('rounded-m3-medium bg-surface-container-low text-on-surface p-3')],
            [
              h.summary(
                [h.Class('cursor-pointer font-bold')],
                [translate(locale, 'list.recoveryShowStored')],
              ),
              h.p(
                [h.Class('mt-2 mb-1 text-on-surface-variant text-sm leading-[1.4]')],
                [translate(locale, 'list.recoveryKept')],
              ),
              h.pre(
                [
                  h.Class(
                    'max-h-60 overflow-auto m-0 p-2 rounded-m3-medium bg-surface-container text-xs whitespace-pre-wrap [overflow-wrap:anywhere]',
                  ),
                ],
                [recovery.raw],
              ),
            ],
          ),
      h.p([h.Class('m-0 text-sm leading-[1.4]')], [translate(locale, 'list.resetHelp')]),
      Button.view<Message>({
        type: 'button',
        onClick: RequestedSavedCoursesReset(),
        toView: (attributes) =>
          h.button(
            [
              ...attributes.button,
              h.Class(`${compactButtonBase} ${buttonSecondary} justify-self-start`),
            ],
            [translate(locale, 'list.reset')],
          ),
      }),
    ],
  );
};

/**
 * The density switch. It is a display preference, so it sits with the count
 * rather than with the collection recipe, stays out of the URL, and never
 * changes which courses are shown.
 */
const listDensityChoice = (density: ListDensity, locale: Locale): Html => {
  const h = html<Message>();
  return RadioGroup.view<ListDensity, Message>({
    id: 'list-density',
    selectedValue: Option.some(density),
    options: listDensities,
    ariaLabel: translate(locale, 'list.density'),
    orientation: 'Horizontal',
    onSelect: (value) => ChangedListDensity({ value }),
    toView: ({ group, options }) =>
      h.div(
        [
          ...group,
          h.Class('inline-flex w-fit flex-none overflow-hidden rounded-full border border-outline'),
        ],
        options.map((option) =>
          h.button(
            [
              ...option.option,
              h.Type('button'),
              h.Class(
                `min-h-11 cursor-pointer border-0 px-3 text-sm font-bold ${
                  option.isSelected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface'
                }`,
              ),
            ],
            [
              translate(
                locale,
                option.value === 'card' ? 'list.densityCard' : 'list.densityCompact',
              ),
            ],
          ),
        ),
      ),
  });
};

const savedCourseListView = (model: Model, state: SavedListState, repaired: number): Html => {
  const h = html<Message>();
  const total = savedCoursesNewestFirst(state);
  const courses = filterSavedCourses(state, model.labelFilter);
  const selectedCodes = new Set(model.selectedCourseCodes);
  const filterActive = isLabelFilterActive(model.labelFilter);
  if (total.length === 0) {
    return h.section(
      [h.Class(stateCardBase), h.Role('status')],
      [
        h.h2([h.Class(stateCardH2Class)], [translate(model.locale, 'list.empty')]),
        h.p([h.Class(stateCardPClass)], [translate(model.locale, 'list.emptyHelp')]),
        h.a(
          [
            h.Href(exploreUrl(model)),
            h.Class(`${backButtonClass} mt-4 inline-flex items-center no-underline`),
          ],
          [translate(model.locale, 'list.backToExplore')],
        ),
      ],
    );
  }
  return h.section(
    [h.Class('grid gap-4'), h.AriaLabel(translate(model.locale, 'list.heading'))],
    [
      repaired === 0
        ? h.empty
        : h.div(
            [
              h.Class('py-4 px-5 rounded-m3-medium bg-warning-container text-on-warning-container'),
              h.Role('status'),
            ],
            [translate(model.locale, 'list.repaired', { count: repaired })],
          ),
      (() => {
        const selection = compareSelection(state, model.compareCodes);
        return selection === null ? h.empty : compareView(model, compareCourses(state, selection));
      })(),
      labelFilterView(model, state),
      h.header(
        [h.Class('flex items-end justify-between gap-4 py-2 px-1 border-b border-outline-variant')],
        [
          h.p(
            [h.AriaLive('polite'), h.Class('m-0 text-on-surface-variant text-sm')],
            [
              filterActive
                ? translate(model.locale, 'list.filteredCount', {
                    shown: courses.length,
                    total: total.length,
                  })
                : savedCountLabel(total.length, model.locale),
            ],
          ),
          listDensityChoice(model.listDensity, model.locale),
        ],
      ),
      // A collection that matches nothing is a filter outcome, never a failure
      // and never an empty saved List.
      courses.length === 0
        ? h.section(
            [h.Class(stateCardBase), h.Role('status')],
            [
              h.h2([h.Class(stateCardH2Class)], [translate(model.locale, 'list.filterEmpty')]),
              h.p([h.Class(stateCardPClass)], [translate(model.locale, 'list.filterEmptyHelp')]),
              Button.view<Message>({
                type: 'button',
                onClick: ClearedLabelFilter(),
                toView: (attributes) =>
                  h.button(
                    [...attributes.button, h.Class(`${compactButtonBase} ${buttonSecondary} mt-4`)],
                    [translate(model.locale, 'list.filterClear')],
                  ),
              }),
            ],
          )
        : h.ol(
            [h.Class('grid gap-3 p-0 list-none')],
            courses.map((course) =>
              lazySavedCourseRow(course.id, savedCourseRow, [
                normalizedUrl(model, course.courseCode),
                course,
                state,
                catalogueItemForCode(model, course.courseCode),
                savedDecisionSignal(model, course.courseCode),
                savedGradeSignal(model, course.courseCode),
                noteDraftFor(model, course),
                selectedCodes.has(course.courseCode),
                model.locale,
                model.outcomeView,
                model.listDensity,
              ]),
            ),
          ),
    ],
  );
};

const labelErrorMessage = (model: Model): string | null => {
  if (model.labelError === null) return null;
  return M.value(model.labelError).pipe(
    M.when('empty-name', () => translate(model.locale, 'list.labelEmptyName')),
    M.when('duplicate-name', () => translate(model.locale, 'list.labelDuplicate')),
    M.when('limit-reached', () =>
      translate(model.locale, 'list.labelLimit', { count: labelsMaxCount }),
    ),
    M.when('unknown-label', () => translate(model.locale, 'list.labelUnknownError')),
    M.exhaustive,
  );
};

/**
 * One dialog owns the whole label vocabulary: create, rename, recolour, delete,
 * and attach or detach across the explicit target. Focus, Escape, and the
 * backdrop belong to the Dialog primitive rather than to hand-written handlers.
 *
 * Attachment across several courses is a three-state answer, so the checkbox is
 * indeterminate when a label is on only some of them and the visible text says
 * how many.
 */
const labelDialogView = (model: Model): Html => {
  const h = html<Message>();
  const locale = model.locale;
  const state = savedListState(model.savedCourses);
  const labels = state === null ? [] : labelsByName(state);
  const targets = state === null ? [] : labelTargetIdentities(state, model.labelDialogTarget);
  const heading =
    targets.length === 0
      ? translate(locale, 'list.labelsManageOnly')
      : targets.length === 1
        ? translate(locale, 'list.labelsForCourse', { code: targets[0]!.courseCode })
        : translate(locale, 'list.labelsForSelection', { count: targets.length });
  const error = labelErrorMessage(model);
  const labelErrorId = 'label-draft-name-error';
  // `limit-reached` and `unknown-label` are not about the text in the field, so
  // they are announced without marking the input itself invalid.
  const nameError =
    model.labelError === 'empty-name' || model.labelError === 'duplicate-name' ? error : null;
  const attachmentOf = (
    label: Label,
  ): Readonly<{ matched: number; all: boolean; some: boolean }> => {
    if (state === null || targets.length === 0) return { matched: 0, all: false, some: false };
    const matched = targets.filter((identity) => hasLabel(state, label.id, identity)).length;
    return { matched, all: matched === targets.length, some: matched > 0 };
  };
  const deleteLabelButtonClass = `${compactButtonBase} min-h-11 rounded-[1.5rem] border border-error bg-error-container px-3 text-sm font-bold text-on-error-container`;
  const labelRow = (label: Label): Html => {
    const attachment = attachmentOf(label);
    const count = state === null ? 0 : labelCourseCount(state, label.id);
    const confirmingDelete = model.labelPendingDelete === label.id;
    const labelNameId = `label-row-name-${label.id}`;
    const confirmPromptId = `label-row-confirm-${label.id}`;
    /**
     * Repeated row actions keep one stable visible wording. Interpolating the
     * label name into every button would make each row a different width and
     * read as a ragged column; the association is carried instead by the row's
     * action group, which is named for the label, and by each button's
     * accessible description, which points back at the row's own name.
     *
     * Deletion is permanent and drops every membership on the label, so a
     * misclick cannot delete it: the group's contents swap for an explicit
     * confirm/cancel pair rather than deleting on the first click. No new
     * dialog or focus trap is introduced; both controls stay inside the
     * existing labels Dialog and inside the same, still-named group.
     */
    const actions = h.div(
      [
        h.Class('flex flex-none flex-wrap items-center justify-end gap-2'),
        h.Role('group'),
        h.AriaLabel(translate(locale, 'list.labelRowActions', { name: label.name })),
      ],
      confirmingDelete
        ? [
            h.span(
              [
                h.Id(confirmPromptId),
                h.Role('status'),
                h.AriaLive('polite'),
                h.Class('text-error text-sm'),
              ],
              [translate(locale, 'list.deleteLabelConfirm', { name: label.name })],
            ),
            Button.view<Message>({
              type: 'button',
              onClick: ConfirmedDeleteLabel({ labelId: label.id }),
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(deleteLabelButtonClass),
                    h.AriaDescribedBy(confirmPromptId),
                  ],
                  [translate(locale, 'list.deleteLabel')],
                ),
            }),
            Button.view<Message>({
              type: 'button',
              onClick: CancelledLabelDelete(),
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                  ],
                  [translate(locale, 'list.cancelDeleteLabel')],
                ),
            }),
          ]
        : [
            Button.view<Message>({
              type: 'button',
              onClick: RequestedEditLabel({ labelId: label.id }),
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                    h.AriaDescribedBy(labelNameId),
                  ],
                  [translate(locale, 'list.editLabel')],
                ),
            }),
            Button.view<Message>({
              type: 'button',
              onClick: RequestedDeleteLabel({ labelId: label.id }),
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(deleteLabelButtonClass),
                    h.AriaDescribedBy(labelNameId),
                  ],
                  [translate(locale, 'list.deleteLabel')],
                ),
            }),
          ],
    );
    const identity =
      targets.length === 0
        ? h.div(
            [h.Class('flex min-w-0 flex-1 items-center gap-2')],
            [labelChip(label, labelNameId), labelCountBadge(count, locale)],
          )
        : Checkbox.view<Message>({
            id: `label-target-${label.id}`,
            isChecked: attachment.all,
            isIndeterminate: attachment.some && !attachment.all,
            onToggle: (isAttached) => ToggledLabelOnTarget({ labelId: label.id, isAttached }),
            toView: (attributes) =>
              h.label(
                [
                  ...attributes.label,
                  h.Class('flex min-w-0 flex-1 items-center gap-[0.6rem] cursor-pointer'),
                ],
                [
                  h.span(
                    [...attributes.checkbox, h.Class(rowCheckboxClass)],
                    [attachment.all ? '✓' : attachment.some ? '–' : ''],
                  ),
                  labelChip(label, labelNameId),
                  h.span(
                    [h.Class('text-on-surface-variant text-xs')],
                    [
                      attachment.all && targets.length === 1
                        ? translate(locale, 'list.labelOnCourse', {
                            code: targets[0]!.courseCode,
                          })
                        : attachment.some && !attachment.all
                          ? translate(locale, 'list.labelPartlyOnSelection', {
                              matched: attachment.matched,
                              count: targets.length,
                            })
                          : '',
                    ],
                  ),
                  labelCountBadge(count, locale),
                ],
              ),
          });
    return h.li(
      [h.Class('flex flex-wrap items-center justify-between gap-3 py-2')],
      [identity, actions],
    );
  };
  const colorChoice = RadioGroup.view<LabelColor, Message>({
    id: 'label-draft-color',
    selectedValue: Option.some(model.labelDraftColor),
    options: labelColors,
    ariaLabel: translate(locale, 'list.labelColor'),
    orientation: 'Horizontal',
    onSelect: (value) => ChangedLabelDraftColor({ value }),
    toView: ({ group, options }) =>
      h.div(
        [h.Class('grid gap-2')],
        [
          h.p([h.Class(fieldLabelClass)], [translate(locale, 'list.labelColor')]),
          h.div(
            [...group, h.Class('flex flex-wrap gap-2')],
            options.map((option) =>
              h.button(
                [
                  ...option.option,
                  // A bare <button> inside a <form> defaults to type="submit",
                  // so without this a colour choice would also Apply the form:
                  // browsing colours would create, rename, and attach labels.
                  h.Type('button'),
                  h.Class(
                    `${compactButtonBase} inline-flex min-h-11 items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${labelChipTone(option.value)} ${
                      option.isSelected ? 'border-primary' : 'border-outline-variant'
                    }`,
                  ),
                ],
                [
                  option.isSelected
                    ? icon<Message>('check', 'block size-4 [&_svg]:block [&_svg]:size-full')
                    : h.empty,
                  h.span([], [labelColorName(option.value, locale)]),
                ],
              ),
            ),
          ),
        ],
      ),
  });
  const form = h.form(
    [h.Class('grid gap-3'), h.OnSubmit(SubmittedLabelForm())],
    [
      Input.view<Message>({
        id: 'label-draft-name',
        value: model.labelDraftName,
        onInput: (value) => UpdatedLabelDraftName({ value }),
        toView: (attributes) =>
          h.div(
            [h.Class('grid')],
            [
              h.label(
                [...attributes.label, h.Class(fieldLabelClass)],
                [translate(locale, 'list.labelName')],
              ),
              h.input([
                ...attributes.input,
                h.Placeholder(translate(locale, 'list.labelNamePlaceholder')),
                h.Class(
                  'w-full min-h-14 px-4 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-base focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)]',
                ),
                h.Autocomplete('off'),
                // Feedback is absent until an Apply attempt; once present it is
                // tied to the field it describes, so a screen reader reaches it
                // from the input rather than only through the live region.
                ...(nameError === null
                  ? []
                  : [h.AriaInvalid(true), h.AriaDescribedBy(labelErrorId)]),
              ]),
            ],
          ),
      }),
      colorChoice,
      h.div(
        [h.Class('flex flex-wrap justify-end gap-3')],
        [
          Button.view<Message>({
            type: 'submit',
            toView: (attributes) =>
              h.button(
                [...attributes.button, h.Class(`${compactButtonBase} ${buttonPrimary} min-h-12`)],
                [
                  translate(
                    locale,
                    model.labelEditing === null ? 'list.addLabel' : 'list.saveLabel',
                  ),
                ],
              ),
          }),
          model.labelEditing === null
            ? h.empty
            : Button.view<Message>({
                type: 'button',
                onClick: CancelledLabelEdit(),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(`${compactButtonBase} ${buttonSecondary} min-h-12`),
                    ],
                    [translate(locale, 'list.cancelLabelEdit')],
                  ),
              }),
        ],
      ),
    ],
  );
  return h.submodel({
    slotId: 'saved-course-labels-dialog',
    model: model.labelDialog,
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
                      'fixed inset-0 bg-[color-mix(in_srgb,var(--md-sys-color-on-surface)_42%,transparent)] opacity-100 transition-opacity duration-200 ease-in-out data-closed:opacity-0',
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
                            h.p([h.Class(eyebrowClass)], [translate(locale, 'list.labels')]),
                            h.h2(
                              [
                                ...title,
                                h.Class('text-[clamp(1.5rem,5vw,2rem)] tracking-[-0.035em]'),
                              ],
                              [heading],
                            ),
                            h.p(
                              [
                                ...description,
                                h.Class('mt-[0.4rem] text-on-surface-variant leading-[1.5]'),
                              ],
                              [translate(locale, 'list.labelsHelp')],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            ...closeButton,
                            ...initialFocus,
                            h.Id('saved-course-labels-close'),
                            h.Class(
                              'grid size-11 flex-none place-items-center rounded-full border-0 bg-surface-container text-on-surface cursor-pointer',
                            ),
                            h.Type('button'),
                            h.AriaLabel(translate(locale, 'list.closeLabels')),
                          ],
                          [icon<Message>('close')],
                        ),
                      ],
                    ),
                    error === null
                      ? h.empty
                      : h.p(
                          [
                            h.Id(labelErrorId),
                            h.Class(
                              'm-0 py-3 px-4 border border-error rounded-m3-medium bg-error-container text-on-error-container',
                            ),
                            h.Role('alert'),
                          ],
                          [error],
                        ),
                    labels.length === 0
                      ? h.p(
                          [h.Class('m-0 text-on-surface-variant leading-[1.5]')],
                          [translate(locale, 'list.noLabels')],
                        )
                      : h.ul(
                          [
                            h.Class('grid gap-1 m-0 p-0 list-none divide-y divide-outline-variant'),
                            h.AriaLabel(translate(locale, 'list.labelsHeading')),
                          ],
                          labels.map((label) => labelRow(label)),
                        ),
                    form,
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => GotLabelDialogMessage({ message }),
  });
};

const savedCoursesResultView = (model: Model): Html => {
  const h = html<Message>();
  switch (model.savedCourses._tag) {
    case 'SavedCoursesLoading':
      return h.section(
        [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
          h.h2([h.Class(stateCardH2Class)], [translate(model.locale, 'list.loading')]),
          h.p([h.Class(stateCardPClass)], [translate(model.locale, 'list.loadingHelp')]),
        ],
      );
    case 'SavedCoursesRecovery':
      return savedCoursesRecoveryView(model.savedCourses, model.locale);
    case 'SavedCoursesReady':
      return savedCourseListView(
        model,
        model.savedCourses.state,
        model.savedCourses.repairedEntries,
      );
  }
};

const listView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('grid gap-6')],
    [lazyListHeader(listHeader, [model.locale]), savedCoursesResultView(model)],
  );
};

const productFooter = (locale: Locale): Html => {
  const h = html<Message>();
  const externalLink = (url: string, label: string): Html =>
    h.a(
      [h.Href(url), h.Target('_blank'), h.Rel('noreferrer'), h.Class('relative font-semibold')],
      [label],
    );
  return h.footer(
    [
      h.Class(
        'flex flex-wrap gap-y-[0.35rem] gap-x-4 pt-6 pb-2 border-t border-outline-variant text-on-surface-variant text-sm leading-[1.5]',
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
  if (season === 'full-year') {
    // A full-year offering spans both calendar years, so the academic year is
    // the only label that names it.
    const academicYearLabel = `${academicYear}/${String(academicYear + 1).slice(-2)}`;
    return translate(locale, 'offering.academicYear', { year: academicYearLabel });
  }
  /**
   * A season with its calendar year already names one specific offering:
   * autumn 2026 and spring 2027 both belong to 2026/27, and neither is
   * ambiguous alone. Appending the academic year restated a fact derivable
   * from the season, and it was the part that truncated in narrow Refine
   * chips.
   */
  const calendarYear = season === 'autumn' ? academicYear : academicYear + 1;
  return `${translateToken(locale, season)} ${calendarYear}`;
};

/**
 * A comparison cell. `known` is what lets difference-first work: only cells
 * the source actually reported can be called equal, so a row where every
 * course is `unavailable` is never mistaken for agreement and hidden.
 */
interface CompareCell {
  readonly text: string;
  readonly known: boolean;
}

const compareCell = (text: string, known = true): CompareCell => ({ text, known });

const factCell = <Value>(
  fact: { readonly state: string; readonly value?: Value } | null | undefined,
  locale: Locale,
  render: (value: Value) => string,
): CompareCell =>
  fact === null || fact === undefined
    ? compareCell(translate(locale, 'compare.notLoaded'), false)
    : fact.state === 'known' && fact.value !== undefined
      ? compareCell(render(fact.value))
      : compareCell(factStateLabel(fact.state, locale), false);

interface CompareRow {
  readonly label: string;
  readonly cells: ReadonlyArray<CompareCell>;
}

/**
 * Every dimension the spec names, in its order, for whichever courses the
 * comparison holds. Dimensions whose data gates are still closed — attendance,
 * remote evidence, programme relations — are absent rather than shown empty.
 */
const compareRows = (
  model: Model,
  courses: ReadonlyArray<SavedCourse>,
): ReadonlyArray<CompareRow> => {
  const locale = model.locale;
  const items = courses.map((course) => catalogueItemForCode(model, course.courseCode));
  const signals = courses.map((course) => savedDecisionSignal(model, course.courseCode));
  const grades = courses.map((course) => savedGradeSignal(model, course.courseCode));
  const facts = courses.map((course, index) => {
    const item = items[index];
    return item === null || item === undefined
      ? null
      : courseOfferingFacts(
          item,
          model.decisionSignals._tag === 'DecisionSignalsSuccess' ? 'idle' : 'idle',
          locale,
        );
  });

  const row = (label: string, cells: ReadonlyArray<CompareCell>): CompareRow => ({ label, cells });

  return [
    row(
      translate(locale, 'compare.credits'),
      items.map((item, index) =>
        item === null
          ? compareCell(translate(locale, 'compare.notLoaded'), false)
          : compareCell(facts[index]?.credits ?? translate(locale, 'compare.notLoaded'), true),
      ),
    ),
    row(
      translate(locale, 'compare.term'),
      facts.map((fact) =>
        fact === null
          ? compareCell(translate(locale, 'compare.notLoaded'), false)
          : compareCell(fact.term),
      ),
    ),
    row(
      translate(locale, 'compare.campus'),
      facts.map((fact) =>
        fact === null
          ? compareCell(translate(locale, 'compare.notLoaded'), false)
          : compareCell(fact.place),
      ),
    ),
    row(
      translate(locale, 'compare.assessment'),
      signals.map((signal) =>
        factCell(signal?.assessment, locale, (parts) =>
          parts
            .map((part) =>
              part.weightPercent.state === 'known'
                ? `${assessmentLabel(part.form, locale)} ${formatPercentage(part.weightPercent.value, locale)}%`
                : assessmentLabel(part.form, locale),
            )
            .join(' · '),
        ),
      ),
    ),
    row(
      translate(locale, 'compare.obligatory'),
      signals.map((signal) =>
        factCell(signal?.obligatoryActivities, locale, (activities) =>
          activities.length === 0
            ? translate(locale, 'compare.none')
            : translate(locale, 'compare.activityCount', { count: activities.length }),
        ),
      ),
    ),
    row(
      translate(locale, 'compare.collaboration'),
      signals.map((signal) =>
        factCell(signal?.collaboration, locale, (value) => collaborationLabel(value, locale)),
      ),
    ),
    row(
      translate(locale, 'compare.outcomeScale'),
      grades.map((grade) =>
        factCell(grade?.gradingScale, locale, (scale) => gradeScaleLabel(scale, locale)),
      ),
    ),
    row(
      translate(locale, 'compare.failureRate'),
      grades.map((grade) =>
        factCell(
          grade?.failureRatePercent,
          locale,
          (value) => `${formatPercentage(value, locale)}%`,
        ),
      ),
    ),
    row(
      translate(locale, 'compare.sample'),
      grades.map((grade) =>
        factCell(grade?.sampleSize, locale, (value) => value.toLocaleString(localeTag(locale))),
      ),
    ),
    row(
      translate(locale, 'compare.period'),
      grades.map((grade) =>
        factCell(grade?.period, locale, (value) => `${value.fromYear}–${value.toYear}`),
      ),
    ),
  ];
};

/** A row differs unless every course reported the same known value. */
const compareRowDiffers = (row: CompareRow): boolean => {
  const known = row.cells.filter((cell) => cell.known);
  if (known.length !== row.cells.length) return true;
  return known.some((cell) => cell.text !== known[0]?.text);
};

/**
 * The comparison matrix. Desktop keeps the dimension column sticky so a row
 * stays named while the courses scroll; the narrow layout scrolls the whole
 * table rather than compressing four columns into a phone.
 */
const compareView = (model: Model, courses: ReadonlyArray<SavedCourse>): Html => {
  const h = html<Message>();
  const locale = model.locale;
  const rows = compareRows(model, courses);
  const visible = model.compareDifferencesOnly ? rows.filter(compareRowDiffers) : rows;
  const headerCellClass = 'px-3 py-2 text-left align-bottom text-sm font-extrabold text-on-surface';

  return h.section(
    [
      h.Class(
        'grid gap-3 rounded-m3-large border border-outline-variant bg-surface-container-low p-4',
      ),
      h.AriaLabel(translate(locale, 'compare.heading')),
    ],
    [
      h.div(
        [
          h.Class(
            'grid gap-3 @min-[32rem]:flex @min-[32rem]:items-start @min-[32rem]:justify-between',
          ),
        ],
        [
          h.div(
            [],
            [
              h.h2([h.Class('m-0 text-lg font-bold')], [translate(locale, 'compare.heading')]),
              h.p(
                [h.Class('m-0 mt-1 text-on-surface-variant text-sm leading-[1.45]')],
                [translate(locale, 'compare.intro')],
              ),
            ],
          ),
          h.div(
            [h.Class(controlGroupClass)],
            [
              Checkbox.view<Message>({
                id: 'compare-differences-only',
                isChecked: model.compareDifferencesOnly,
                onToggle: (differencesOnly) => ToggledCompareDifferencesOnly({ differencesOnly }),
                toView: (attributes) =>
                  h.label(
                    [
                      ...attributes.label,
                      h.Class(
                        'inline-flex min-h-11 cursor-pointer items-center gap-[0.55rem] rounded-[1.5rem] border border-outline px-3 text-sm font-bold text-on-surface-variant has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-container has-[[data-checked]]:text-on-primary-container',
                      ),
                    ],
                    [
                      h.span(
                        [
                          ...attributes.checkbox,
                          h.Class(
                            'grid size-[1.15rem] place-items-center rounded-[0.3rem] border-2 border-current text-xs leading-none',
                          ),
                        ],
                        [model.compareDifferencesOnly ? '✓' : ''],
                      ),
                      h.span([], [translate(locale, 'compare.differencesOnly')]),
                    ],
                  ),
              }),
              Button.view<Message>({
                type: 'button',
                onClick: ClosedCompare(),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                    ],
                    [translate(locale, 'compare.close')],
                  ),
              }),
            ],
          ),
        ],
      ),
      visible.length === 0
        ? h.p(
            [h.Class('m-0 text-on-surface-variant text-sm leading-[1.45]'), h.Role('status')],
            [translate(locale, 'compare.identical')],
          )
        : h.div(
            [h.Class('overflow-x-auto')],
            [
              h.table(
                [h.Class('w-full border-collapse text-sm')],
                [
                  h.thead(
                    [],
                    [
                      h.tr(
                        [],
                        [
                          h.th(
                            [
                              h.Scope('col'),
                              h.Class(`${headerCellClass} sticky left-0 bg-surface-container-low`),
                            ],
                            [translate(locale, 'compare.dimension')],
                          ),
                          ...courses.map((course) =>
                            h.th([h.Scope('col'), h.Class(headerCellClass)], [course.courseCode]),
                          ),
                        ],
                      ),
                    ],
                  ),
                  h.tbody(
                    [],
                    visible.map((row) =>
                      h.tr(
                        [h.Class('border-t border-outline-variant')],
                        [
                          h.th(
                            [
                              h.Scope('row'),
                              h.Class(
                                'sticky left-0 bg-surface-container-low px-3 py-2 text-left align-top font-bold text-on-surface-variant',
                              ),
                            ],
                            [row.label],
                          ),
                          ...row.cells.map((cell) =>
                            h.td(
                              [
                                h.Class(
                                  `px-3 py-2 align-top ${cell.known ? 'text-on-surface' : 'text-on-surface-variant italic'}`,
                                ),
                              ],
                              [cell.text],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
    ],
  );
};
