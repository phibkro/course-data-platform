import type { CourseInsightResponseDtoType } from '@course-data/course-contracts';
import { Effect, Match as M, Option, Schema as S } from 'effect';
import { Command, Navigation, Runtime, Url } from 'foldkit';
import type { Document, Html } from 'foldkit/html';
import { createLazy, html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { ts } from 'foldkit/schema';
import { evo } from 'foldkit/struct';

import { Checkbox, Dialog } from '@foldkit/ui';

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
import { isLocale, localeTag, translate, type Locale } from './i18n';
import type { AppIcon } from './icons';
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
  compareMaximum,
  findLabel,
  labelColors,
  labelFilterModes,
  labelRejections,
  normalizeLabelFilter,
  setLabelFilterMode,
  setPredicateExcluded,
  setPredicateIncluded,
  validateLabelEdit,
  validateNewLabel,
  type LabelFilter,
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
  decodeThemePreference,
  defaultThemePreference,
  readThemePreference,
  type ThemePreference,
} from './theme';
import { mainColumnClass, mainContentClass } from './app-styles';
import {
  catalogueRefineDialogFromValues,
  catalogueView,
  selectedCourseView,
} from './features/explore';
import {
  Message as AppearanceMessage,
  ThemePreferenceSchema,
  init as initAppearance,
  update as updateAppearance,
  view as appearanceView,
} from './features/appearance';
import {
  bottomStackView,
  labelDialogView,
  listView,
  savedCoursesPersistenceAlert,
  selectedSavedCourses,
} from './features/saved';
import { Message as CompareMessage, update as updateCompare } from './features/compare';

const DISPLAY_CHUNK = 20;
export const DEFAULT_TERM = '2026-autumn';
export const DEFAULT_SORT: CourseSearchSort = 'relevance';
const EXPLORE_PATH = '/';
const LIST_PATH = '/list';
const APPEARANCE_PATH = '/appearance';
const LEGACY_LIST_APPEARANCE_PATH = '/list/appearance';
const listDensityStorageKey = 'course-lens:list-density';
const lazyDesktopNavigation = createLazy();
const lazyMobileNavigation = createLazy();
const lazyCatalogueRefineDialog = createLazy();
const lazyProductFooter = createLazy();

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
const feedbackUrl = parseExternalHttpsUrl(import.meta.env.VITE_FEEDBACK_URL as string | undefined);

export type Campus = 'all' | 'trondheim' | 'gjovik' | 'alesund';
export type Level = 'all' | 'bachelor' | 'master' | 'phd';
export type OutcomeView = 'letter' | 'pass-fail';
const CampusSchema = S.Literals(['all', 'trondheim', 'gjovik', 'alesund']);
const LevelSchema = S.Literals(['all', 'bachelor', 'master', 'phd']);
const OutcomeViewSchema = S.Literals(['letter', 'pass-fail']);
const SortSchema = S.Literals(['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc']);
const LocaleSchema = S.Literals(['en', 'nb']);
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

export type GradeSignalsResult =
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

export type DecisionSignalsResult =
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

export type DetailResult =
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
export type SavedCoursesResult = typeof SavedCoursesResultSchema.Type;

/**
 * Whether Save/Remove can act right now. `SavedCoursesLoading` is transient
 * and reads as "still loading"; a recovery state is not transient and reads
 * as "paused" with a path to List instead, so the two never share a message.
 */
export const savedToggleAvailability = (
  result: SavedCoursesResult,
): 'ready' | 'loading' | 'paused' =>
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
export type SavedListNotice = typeof SavedListNoticeSchema.Type;

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
export const savedListNoticeKey = (notice: SavedListNotice): string =>
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
export const GotAppearanceMessage = m('GotAppearanceMessage', {
  message: AppearanceMessage,
});
export const GotCompareMessage = m('GotCompareMessage', {
  message: CompareMessage,
});
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
  GotAppearanceMessage,
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
  GotCompareMessage,
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

export const catalogueResponse = (result: CatalogueResult): CourseSearchResponse | null =>
  result._tag === 'CatalogueSuccess' || result._tag === 'CataloguePartial' ? result.response : null;

export const gradeSignalsResponse = (
  result: GradeSignalsResult,
): CourseGradeSummariesResponse | null => {
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

export const decisionSignalsResponse = (
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

export const normalizedUrl = (
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

export const listUrl = (model: Model): string => normalizedUrl(model, null, LIST_PATH);

export const exploreUrl = (model: Model): string => normalizedUrl(model, null, EXPLORE_PATH);

export const savedListState = (result: SavedCoursesResult): SavedListState | null =>
  result._tag === 'SavedCoursesReady' ? result.state : null;

export const isCourseSaved = (result: SavedCoursesResult, courseCode: string): boolean => {
  const state = savedListState(result);
  const identity = courseIdentity(courseCode);
  return state !== null && identity !== null && isSaved(state, identity);
};

/** Identities the label dialog acts on: the explicit target, intersected with
 *  what is actually saved, so a stale target can never create a membership for
 *  a course that is gone. */
export const labelTargetIdentities = (
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

export const noteDraftFor = (model: Model, course: SavedCourse): string =>
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
const updateAppearancePreference = (
  model: Model,
  message: AppearanceMessage,
  toRootMessage: (message: AppearanceMessage) => Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const [appearance, commands] = updateAppearance(initAppearance(model.themePreference), message);
  return [
    { ...model, themePreference: appearance.preference },
    Command.mapMessages(commands, toRootMessage),
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
      GotAppearanceMessage: ({ message: appearanceMessage }) =>
        updateAppearancePreference(model, appearanceMessage, (message) =>
          GotAppearanceMessage({ message }),
        ),
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
      GotCompareMessage: ({ message: compareMessage }) =>
        updateComparison(model, compareMessage, (message) => GotCompareMessage({ message })),
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
const updateComparison = (
  model: Model,
  message: CompareMessage,
  toRootMessage: (message: CompareMessage) => Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const [comparison, commands, maybeOutMessage] = updateCompare(
    {
      codes: model.compareCodes,
      differencesOnly: model.compareDifferencesOnly,
    },
    message,
  );
  const next: Model = {
    ...model,
    compareCodes: comparison.codes,
    compareDifferencesOnly: comparison.differencesOnly,
  };
  const mappedCommands = Command.mapMessages(commands, toRootMessage);
  return Option.match(maybeOutMessage, {
    onNone: () => [next, mappedCommands],
    onSome: () => [
      next,
      [...mappedCommands, Navigate({ href: currentUrl(next, null), mode: 'push' })],
    ],
  });
};

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
                ? h.submodel({
                    slotId: 'appearance-settings',
                    model: initAppearance(model.themePreference),
                    view: appearanceView,
                    viewInputs: {
                      locale: model.locale,
                      renderMobileLanguageControl: () =>
                        selectControl(
                          model.selectFields,
                          'language-mobile',
                          translate(model.locale, 'locale.label'),
                          model.locale,
                          [
                            ['en', translate(model.locale, 'locale.en')],
                            ['nb', translate(model.locale, 'locale.nb')],
                          ],
                        ),
                      renderFooter: () => lazyProductFooter(productFooter, [model.locale]),
                    },
                    toParentMessage: (message) => GotAppearanceMessage({ message }),
                  })
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

export const selectControl = (
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

export const languageSelectControl = (
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

export const checkboxControl = (
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

/**
 * The one contextual feedback affordance for the decision screens. It follows
 * the VITE_TIP_URL pattern exactly: a static HTTPS link that exists only when
 * the operator configured a valid HTTPS URL, and opens in a new tab.
 */
export const feedbackRow = (locale: Locale): Html => {
  const h = html<Message>();
  if (feedbackUrl === null) return h.empty;
  return h.p(
    [h.Class('m-0 text-on-surface-variant text-sm leading-[1.45]')],
    [
      translate(locale, 'feedback.prompt'),
      h.a(
        [
          h.Href(feedbackUrl),
          h.Target('_blank'),
          h.Rel('noopener noreferrer'),
          h.Class('relative font-semibold'),
        ],
        [translate(locale, 'feedback.action')],
      ),
      translate(locale, 'feedback.optional'),
    ],
  );
};

export const productFooter = (locale: Locale): Html => {
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
