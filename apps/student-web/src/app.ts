import { Effect, Option, Schema as S } from 'effect';
import { Command, Navigation, Runtime, Update, Url } from 'foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';
import { createLazy } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineTaggedUnion } from 'foldkit/schema';
import { modifyFields } from 'foldkit/struct';

import { Dialog, Listbox, RadioGroup } from '@foldkit/ui';
import {
  CourseDecisionSignalsResponseSchema,
  CourseGradeSummariesResponseSchema,
  CourseInsightResponseSchema,
  CourseSearchResponseSchema,
  type CourseDecisionSignalsResponse,
  type CourseGradeSummariesResponse,
  type CourseSearchRequest,
  type CourseSearchResponse,
  type CourseSearchSort,
} from './course-client';
import { selectionChip } from './components';
import { courseClient } from './course-client-runtime';
import { courseIdentity, type CourseIdentity } from './course-identity';
import {
  IndexedMessageCatalogueSchema,
  isLocale,
  LocaleSchema,
  localeTag,
  Localization,
  TokenCatalogueSchema,
  translate,
  type Locale,
} from './i18n';
import type { AppIcon } from './icons';
import { desktopNavigation, mobileNavigation } from './navigation';
import {
  LabelPredicateSchema,
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
  emptySavedList,
  findSavedCourse,
  isSaved,
  parseSavedList,
  removeSavedCourse,
  saveCourse,
  savedListStorageKey,
  serializeSavedList,
  setSavedCourseNote,
  type SavedCourse,
  type SavedListState,
} from './saved-courses';
import { courseOrigins, studentCourses, type StudentCourse } from './student-courses';
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
  LabelDraftColorRadioGroup,
  LabelFilterModeRadioGroup,
  ListDensityRadioGroup,
  bottomStackView,
  labelDialogView,
  listView,
  savedCoursesPersistenceAlert,
  selectedSavedCourses,
} from './features/saved';
import { Message as CompareMessage, update as updateCompare } from './features/compare';
import {
  Message as ProgressMessage,
  Model as ProgressModel,
  init as initProgress,
  progressResultCourses,
  update as updateProgress,
  view as progressView,
} from './features/progress';
import {
  Message as ScheduleMessage,
  Model as ScheduleModel,
  currentOsloIsoWeek,
  init as initSchedule,
  normalizedWeek,
  parseHiddenActivityKeys,
  parseScheduleCodes,
  syncFromUrl as syncScheduleFromUrl,
  update as updateSchedule,
  view as scheduleView,
} from './features/schedule';

const DISPLAY_CHUNK = 20;
export const DEFAULT_TERM = '2026-autumn';
export const DEFAULT_SORT: CourseSearchSort = 'relevance';
const EXPLORE_PATH = '/';
const LIST_PATH = '/list';
const SCHEDULE_PATH = '/schedule';
const PROGRESS_PATH = '/progress';
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

const CatalogueResult = defineTaggedUnion({
  CatalogueInitialLoading: {},
  CatalogueSuccess: { response: CourseSearchResponseSchema },
  CataloguePartial: { response: CourseSearchResponseSchema },
  CatalogueEmpty: {},
  CatalogueFailure: { error: S.String },
});
export const CatalogueInitialLoading = CatalogueResult.CatalogueInitialLoading;
export const CatalogueSuccess = CatalogueResult.CatalogueSuccess;
export const CataloguePartial = CatalogueResult.CataloguePartial;
export const CatalogueEmpty = CatalogueResult.CatalogueEmpty;
export const CatalogueFailure = CatalogueResult.CatalogueFailure;

type CatalogueResult = typeof CatalogueResult.Type;

const GradeSignalsResult = defineTaggedUnion({
  GradeSignalsIdle: {},
  GradeSignalsLoading: {
    previous: S.NullOr(CourseGradeSummariesResponseSchema),
    pendingCodes: S.Array(S.String),
  },
  GradeSignalsSuccess: { response: CourseGradeSummariesResponseSchema },
  GradeSignalsPartial: { response: CourseGradeSummariesResponseSchema },
  GradeSignalsFailure: {
    previous: S.NullOr(CourseGradeSummariesResponseSchema),
    error: S.String,
  },
});
export const GradeSignalsIdle = GradeSignalsResult.GradeSignalsIdle;
export const GradeSignalsLoading = GradeSignalsResult.GradeSignalsLoading;
export const GradeSignalsSuccess = GradeSignalsResult.GradeSignalsSuccess;
export const GradeSignalsPartial = GradeSignalsResult.GradeSignalsPartial;
export const GradeSignalsFailure = GradeSignalsResult.GradeSignalsFailure;

export type GradeSignalsResult = typeof GradeSignalsResult.Type;

const DecisionSignalsResult = defineTaggedUnion({
  DecisionSignalsIdle: {},
  DecisionSignalsLoading: {
    previous: S.NullOr(CourseDecisionSignalsResponseSchema),
    pendingCodes: S.Array(S.String),
  },
  DecisionSignalsSuccess: { response: CourseDecisionSignalsResponseSchema },
  DecisionSignalsFailure: {
    previous: S.NullOr(CourseDecisionSignalsResponseSchema),
    error: S.String,
  },
});
export const DecisionSignalsIdle = DecisionSignalsResult.DecisionSignalsIdle;
export const DecisionSignalsLoading = DecisionSignalsResult.DecisionSignalsLoading;
export const DecisionSignalsSuccess = DecisionSignalsResult.DecisionSignalsSuccess;
export const DecisionSignalsFailure = DecisionSignalsResult.DecisionSignalsFailure;

export type DecisionSignalsResult = typeof DecisionSignalsResult.Type;

const NextPageState = defineTaggedUnion({
  NextPageIdle: {},
  NextPageLoading: {},
  NextPageFailure: { error: S.String },
});
export const NextPageIdle = NextPageState.NextPageIdle;
export const NextPageLoading = NextPageState.NextPageLoading;
export const NextPageFailure = NextPageState.NextPageFailure;

/**
 * The successful catalogue belongs to `localization`; this state records the
 * asynchronous boundary so a selected Norwegian locale can fall back safely.
 */
const NorwegianMessagesState = defineTaggedUnion({
  NorwegianMessagesIdle: {},
  NorwegianMessagesLoading: {},
  NorwegianMessagesLoaded: {},
  NorwegianMessagesFailed: { error: S.String },
});
export const NorwegianMessagesIdle = NorwegianMessagesState.NorwegianMessagesIdle;
export const NorwegianMessagesLoading = NorwegianMessagesState.NorwegianMessagesLoading;
export const NorwegianMessagesLoaded = NorwegianMessagesState.NorwegianMessagesLoaded;
export const NorwegianMessagesFailed = NorwegianMessagesState.NorwegianMessagesFailed;
export type NorwegianMessagesState = typeof NorwegianMessagesState.Type;

const DetailResult = defineTaggedUnion({
  DetailClosed: {},
  DetailLoading: {},
  DetailSuccess: { response: CourseInsightResponseSchema },
  DetailPartial: { response: CourseInsightResponseSchema },
  DetailFailure: { error: S.String },
});
export const DetailClosed = DetailResult.DetailClosed;
export const DetailLoading = DetailResult.DetailLoading;
export const DetailSuccess = DetailResult.DetailSuccess;
export const DetailPartial = DetailResult.DetailPartial;
export const DetailFailure = DetailResult.DetailFailure;

export type DetailResult = typeof DetailResult.Type;

/**
 * Student-owned saved state is explicit in the model. It is loaded through a
 * Command, never read or written while updating, and an unreadable stored
 * value becomes a visible recovery state instead of an empty list.
 */
const SavedCoursesResultSchema = defineTaggedUnion({
  SavedCoursesLoading: {},
  SavedCoursesReady: {
    state: SavedListStateSchema,
    repairedEntries: S.Number,
  },
  SavedCoursesRecovery: {
    reason: S.Literals(['unavailable', 'unsupported-version', 'invalid-json', 'unreadable']),
    storedVersion: S.NullOr(S.Number),
    raw: S.String,
  },
});
export const SavedCoursesLoading = SavedCoursesResultSchema.SavedCoursesLoading;
export const SavedCoursesReady = SavedCoursesResultSchema.SavedCoursesReady;
export const SavedCoursesRecovery = SavedCoursesResultSchema.SavedCoursesRecovery;
export type SavedCoursesResult = typeof SavedCoursesResultSchema.Type;

/**
 * Whether Save/Remove can act right now. `SavedCoursesLoading` is transient
 * and reads as "still loading"; a recovery state is not transient and reads
 * as "paused" with a path to List instead, so the two never share a message.
 */
export const savedToggleAvailability = (
  result: SavedCoursesResult,
): 'ready' | 'loading' | 'paused' =>
  SavedCoursesResultSchema.match(result, {
    SavedCoursesReady: () => 'ready' as const,
    SavedCoursesLoading: () => 'loading' as const,
    SavedCoursesRecovery: () => 'paused' as const,
  });

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

const RouteSchema = S.Literals(['explore', 'list', 'schedule', 'progress', 'appearance']);
type Route = typeof RouteSchema.Type;

/**
 * How much of each saved course a List row shows. It is a local display
 * preference: it changes nothing about the saved set, its labels, or the
 * collection recipe, so it stays out of the URL and out of student data.
 */
export const listDensities = ['card', 'compact'] as const;
const ListDensitySchema = S.Literals(listDensities);
export type ListDensity = typeof ListDensitySchema.Type;
const CourseOriginSchema = S.Literals(courseOrigins);
export const Model = S.Struct({
  localization: Localization,
  norwegianMessages: NorwegianMessagesState,
  route: RouteSchema,
  progress: ProgressModel,
  schedule: ScheduleModel,
  savedCourses: SavedCoursesResultSchema,
  noteDrafts: S.Array(NoteDraftSchema),
  savedCoursesPersistFailed: S.Boolean,
  labelFilter: LabelFilterSchema,
  selectedCourseOrigins: S.Array(CourseOriginSchema),
  labelFilterModeRadioGroup: RadioGroup.Model,
  compareCodes: S.Array(S.String),
  labelFilterNotice: S.NullOr(LabelFilterNoticeSchema),
  selectedCourseCodes: S.Array(S.String),
  labelDialog: Dialog.Model,
  labelDialogTarget: S.Array(S.String),
  labelDraftName: S.String,
  labelDraftColor: LabelColorSchema,
  labelDraftColorRadioGroup: RadioGroup.Model,
  labelEditing: S.NullOr(S.String),
  labelPendingDelete: S.NullOr(S.String),
  /**
   * Removing several saved courses discards notes and labels that cannot be
   * retyped from the catalogue, so it asks first. A row-level removal is
   * already an explicit action against one course.
   */
  selectionRemovePending: S.Boolean,
  /**
   * Difference-first is the default: a comparison exists to show what differs,
   * and a table repeating what is identical is the cards again.
   */
  compareDifferencesOnly: S.Boolean,
  labelError: S.NullOr(LabelRejectionSchema),
  listDensity: ListDensitySchema,
  listDensityRadioGroup: RadioGroup.Model,
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
  'catalogue' | 'gradeSignals' | 'decisionSignals' | 'detail' | 'norwegianMessages'
> & {
  readonly catalogue: CatalogueResult;
  readonly gradeSignals: GradeSignalsResult;
  readonly decisionSignals: DecisionSignalsResult;
  readonly detail: DetailResult;
  readonly norwegianMessages: NorwegianMessagesState;
};

export const Message = defineMessageUnion({
  UpdatedQuery: { value: S.String },
  ChangedLocale: { value: S.String },
  LoadedNorwegianMessages: {
    messages: IndexedMessageCatalogueSchema,
    tokens: TokenCatalogueSchema,
  },
  FailedNorwegianMessages: { error: S.String },
  SubmittedSearch: {},
  ChangedTerm: { value: S.String },
  ChangedCampus: { value: S.String },
  ChangedLevel: { value: S.String },
  ChangedSort: { value: S.String },
  ToggledOpen: { isChecked: S.Boolean },
  ToggledEnglish: { isChecked: S.Boolean },
  ChangedOutcomeView: { value: S.String },
  RequestedMoreCourses: {},
  RequestedUrl: { href: S.String, external: S.Boolean },
  ChangedUrl: { href: S.String },
  ClosedCourse: {},
  SucceededCourseSearch: {
    requestKey: S.String,
    append: S.Boolean,
    response: CourseSearchResponseSchema,
  },
  FailedCourseSearch: {
    requestKey: S.String,
    append: S.Boolean,
    error: S.String,
  },
  SucceededGradeSignals: {
    requestKey: S.String,
    courseCodes: S.Array(S.String),
    response: CourseGradeSummariesResponseSchema,
  },
  FailedGradeSignals: {
    requestKey: S.String,
    courseCodes: S.Array(S.String),
    error: S.String,
  },
  SucceededDecisionSignals: {
    requestKey: S.String,
    courseCodes: S.Array(S.String),
    response: CourseDecisionSignalsResponseSchema,
  },
  FailedDecisionSignals: {
    requestKey: S.String,
    courseCodes: S.Array(S.String),
    error: S.String,
  },
  SucceededCourseInsight: {
    courseCode: S.String,
    response: CourseInsightResponseSchema,
  },
  FailedCourseInsight: { courseCode: S.String, error: S.String },
  CompletedNavigation: {},
  FailedNavigation: { error: S.String },
  PersistedLocale: {},
  FailedLocalePersistence: {},
  ToggledSidebar: {},
  PersistedSidebarPreference: {},
  FailedSidebarPreferencePersistence: {},
  RequestedOpenRefineDialog: {},
  GotRefineDialogMessage: { message: Dialog.Message },
  GotAppearanceMessage: { message: AppearanceMessage },
  GotCompareMessage: { message: CompareMessage },
  GotProgressMessage: { message: ProgressMessage },
  GotScheduleMessage: { message: ScheduleMessage },
  GotSelectFieldMessage: {
    id: SelectControlIdSchema,
    message: Listbox.Message,
  },
  GotLabelFilterModeRadioGroupMessage: { message: RadioGroup.Message },
  GotListDensityRadioGroupMessage: { message: RadioGroup.Message },
  GotLabelDraftColorRadioGroupMessage: { message: RadioGroup.Message },
  LoadedSavedCourses: { load: SavedListLoadSchema },
  FailedSavedCoursesLoad: {},
  RequestedSaveCourse: { courseCode: S.String },
  StampedSavedCourse: { courseCode: S.String, savedAt: S.String },
  RequestedRemoveSavedCourse: { courseCode: S.String },
  UpdatedSavedNoteDraft: { courseCode: S.String, value: S.String },
  SubmittedSavedNote: { courseCode: S.String },
  RequestedSavedCoursesReset: {},
  PersistedSavedCourses: {},
  FailedSavedCoursesPersistence: {},
  ChangedLabelInclusion: {
    predicate: LabelPredicateSchema,
    isIncluded: S.Boolean,
  },
  ChangedLabelExclusion: {
    predicate: LabelPredicateSchema,
    isExcluded: S.Boolean,
  },
  ChangedLabelFilterMode: { mode: S.Literals(labelFilterModes) },
  ClearedLabelFilter: {},
  ClearedCourseFilters: {},
  ChangedListDensity: { value: ListDensitySchema },
  ToggledCourseOrigin: { origin: CourseOriginSchema, isIncluded: S.Boolean },
  PersistedListDensity: {},
  FailedListDensityPersistence: {},
  ToggledSavedCourseSelection: {
    courseCode: S.String,
    isSelected: S.Boolean,
  },
  ClearedSavedCourseSelection: {},
  RequestedCompare: {},
  RequestedRemoveSelected: {},
  CancelledRemoveSelected: {},
  ConfirmedRemoveSelected: {},
  RequestedLabelDialog: { courseCodes: S.Array(S.String) },
  GotLabelDialogMessage: { message: Dialog.Message },
  UpdatedLabelDraftName: { value: S.String },
  ChangedLabelDraftColor: { value: LabelColorSchema },
  SubmittedLabelForm: {},
  StampedLabel: { labelId: S.String },
  RequestedEditLabel: { labelId: S.String },
  CancelledLabelEdit: {},
  RequestedDeleteLabel: { labelId: S.String },
  ConfirmedDeleteLabel: { labelId: S.String },
  CancelledLabelDelete: {},
  ToggledLabelOnTarget: { labelId: S.String, isAttached: S.Boolean },
});
export type Message = typeof Message.Type;

export const UpdatedQuery = Message.UpdatedQuery;
export const ChangedLocale = Message.ChangedLocale;
export const LoadedNorwegianMessages = Message.LoadedNorwegianMessages;
export const FailedNorwegianMessages = Message.FailedNorwegianMessages;
export const SubmittedSearch = Message.SubmittedSearch;
export const ChangedTerm = Message.ChangedTerm;
export const ChangedCampus = Message.ChangedCampus;
export const ChangedLevel = Message.ChangedLevel;
export const ChangedSort = Message.ChangedSort;
export const ToggledOpen = Message.ToggledOpen;
export const ToggledEnglish = Message.ToggledEnglish;
export const ChangedOutcomeView = Message.ChangedOutcomeView;
export const RequestedMoreCourses = Message.RequestedMoreCourses;
export const RequestedUrl = Message.RequestedUrl;
export const ChangedUrl = Message.ChangedUrl;
export const ClosedCourse = Message.ClosedCourse;
export const SucceededCourseSearch = Message.SucceededCourseSearch;
export const FailedCourseSearch = Message.FailedCourseSearch;
export const SucceededGradeSignals = Message.SucceededGradeSignals;
export const FailedGradeSignals = Message.FailedGradeSignals;
export const SucceededDecisionSignals = Message.SucceededDecisionSignals;
export const FailedDecisionSignals = Message.FailedDecisionSignals;
export const SucceededCourseInsight = Message.SucceededCourseInsight;
export const FailedCourseInsight = Message.FailedCourseInsight;
export const CompletedNavigation = Message.CompletedNavigation;
export const FailedNavigation = Message.FailedNavigation;
export const PersistedLocale = Message.PersistedLocale;
export const FailedLocalePersistence = Message.FailedLocalePersistence;
export const ToggledSidebar = Message.ToggledSidebar;
export const PersistedSidebarPreference = Message.PersistedSidebarPreference;
export const FailedSidebarPreferencePersistence = Message.FailedSidebarPreferencePersistence;
export const RequestedOpenRefineDialog = Message.RequestedOpenRefineDialog;
export const GotRefineDialogMessage = Message.GotRefineDialogMessage;
export const GotAppearanceMessage = Message.GotAppearanceMessage;
export const GotCompareMessage = Message.GotCompareMessage;
export const GotProgressMessage = Message.GotProgressMessage;
export const GotScheduleMessage = Message.GotScheduleMessage;
export const GotLabelFilterModeRadioGroupMessage = Message.GotLabelFilterModeRadioGroupMessage;
export const GotListDensityRadioGroupMessage = Message.GotListDensityRadioGroupMessage;
export const GotLabelDraftColorRadioGroupMessage = Message.GotLabelDraftColorRadioGroupMessage;
export const LoadedSavedCourses = Message.LoadedSavedCourses;
export const FailedSavedCoursesLoad = Message.FailedSavedCoursesLoad;
export const RequestedSaveCourse = Message.RequestedSaveCourse;
export const StampedSavedCourse = Message.StampedSavedCourse;
export const RequestedRemoveSavedCourse = Message.RequestedRemoveSavedCourse;
export const UpdatedSavedNoteDraft = Message.UpdatedSavedNoteDraft;
export const SubmittedSavedNote = Message.SubmittedSavedNote;
export const RequestedSavedCoursesReset = Message.RequestedSavedCoursesReset;
export const PersistedSavedCourses = Message.PersistedSavedCourses;
export const FailedSavedCoursesPersistence = Message.FailedSavedCoursesPersistence;
export const ChangedLabelInclusion = Message.ChangedLabelInclusion;
export const ChangedLabelExclusion = Message.ChangedLabelExclusion;
export const ChangedLabelFilterMode = Message.ChangedLabelFilterMode;
export const ClearedLabelFilter = Message.ClearedLabelFilter;
export const ChangedListDensity = Message.ChangedListDensity;
export const ClearedCourseFilters = Message.ClearedCourseFilters;
export const ToggledCourseOrigin = Message.ToggledCourseOrigin;
export const PersistedListDensity = Message.PersistedListDensity;
export const FailedListDensityPersistence = Message.FailedListDensityPersistence;
export const ToggledSavedCourseSelection = Message.ToggledSavedCourseSelection;
export const ClearedSavedCourseSelection = Message.ClearedSavedCourseSelection;
export const RequestedCompare = Message.RequestedCompare;
export const RequestedRemoveSelected = Message.RequestedRemoveSelected;
export const CancelledRemoveSelected = Message.CancelledRemoveSelected;
export const ConfirmedRemoveSelected = Message.ConfirmedRemoveSelected;
export const RequestedLabelDialog = Message.RequestedLabelDialog;
export const GotLabelDialogMessage = Message.GotLabelDialogMessage;
export const UpdatedLabelDraftName = Message.UpdatedLabelDraftName;
export const ChangedLabelDraftColor = Message.ChangedLabelDraftColor;
export const SubmittedLabelForm = Message.SubmittedLabelForm;
export const StampedLabel = Message.StampedLabel;
export const RequestedEditLabel = Message.RequestedEditLabel;
export const CancelledLabelEdit = Message.CancelledLabelEdit;
export const RequestedDeleteLabel = Message.RequestedDeleteLabel;
export const ConfirmedDeleteLabel = Message.ConfirmedDeleteLabel;
export const CancelledLabelDelete = Message.CancelledLabelDelete;
export const ToggledLabelOnTarget = Message.ToggledLabelOnTarget;

type UpdateReturn = Update.Return<Model, Message>;
type Commands = Update.Commands<Message>;

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

export const FetchCourseSearch = Command.define('FetchCourseSearch', {
  args: {
    query: S.String,
    term: S.String,
    page: S.Number,
    sort: SortSchema,
    campus: S.NullOr(S.String),
    level: S.NullOr(S.String),
    continuingEducation: S.Boolean,
    open: S.Boolean,
    english: S.Boolean,
    requestKey: S.String,
    append: S.Boolean,
  },
  messages: [Message.SucceededCourseSearch, Message.FailedCourseSearch],
  execute: (input) =>
    courseClient
      .search({
        query: input.query,
        term: input.term,
        page: input.page,
        sort: input.sort,
        ...(input.campus === null ? {} : { campus: input.campus }),
        ...(input.level === null ? {} : { level: input.level }),
        continuingEducation: input.continuingEducation,
        open: input.open,
        english: input.english,
      })
      .pipe(
        Effect.map((response) =>
          Message.SucceededCourseSearch({
            requestKey: input.requestKey,
            append: input.append,
            response,
          }),
        ),
        Effect.catch((error) =>
          Effect.succeed(
            Message.FailedCourseSearch({
              requestKey: input.requestKey,
              append: input.append,
              error: error.message,
            }),
          ),
        ),
      ),
});

export const FetchCourseInsight = Command.define('FetchCourseInsight', {
  args: { courseCode: S.String, term: S.String },
  messages: [Message.SucceededCourseInsight, Message.FailedCourseInsight],
  execute: ({ courseCode, term }) =>
    courseClient.getInsight(courseCode, term).pipe(
      Effect.map((response) => Message.SucceededCourseInsight({ courseCode, response })),
      Effect.catch((error) =>
        Effect.succeed(Message.FailedCourseInsight({ courseCode, error: error.message })),
      ),
    ),
});

export const FetchGradeSignals = Command.define('FetchGradeSignals', {
  args: { courseCodes: S.Array(S.String), requestKey: S.String },
  messages: [Message.SucceededGradeSignals, Message.FailedGradeSignals],
  execute: ({ courseCodes, requestKey: key }) =>
    courseClient.getGradeSummaries(courseCodes).pipe(
      Effect.map((response) =>
        Message.SucceededGradeSignals({ requestKey: key, courseCodes, response }),
      ),
      Effect.catch((error) =>
        Effect.succeed(
          Message.FailedGradeSignals({ requestKey: key, courseCodes, error: error.message }),
        ),
      ),
    ),
});

export const FetchDecisionSignals = Command.define('FetchDecisionSignals', {
  args: { courseCodes: S.Array(S.String), term: S.String, requestKey: S.String },
  messages: [Message.SucceededDecisionSignals, Message.FailedDecisionSignals],
  execute: ({ courseCodes, term, requestKey: key }) =>
    courseClient.getDecisionSignals(courseCodes, term).pipe(
      Effect.map((response) =>
        Message.SucceededDecisionSignals({ requestKey: key, courseCodes, response }),
      ),
      Effect.catch((error) =>
        Effect.succeed(
          Message.FailedDecisionSignals({ requestKey: key, courseCodes, error: error.message }),
        ),
      ),
    ),
});

export const Navigate = Command.define('Navigate', {
  args: { href: S.String, mode: S.String },
  messages: [Message.CompletedNavigation, Message.FailedNavigation],
  execute: ({ href, mode }) =>
    (mode === 'external'
      ? Navigation.load(href)
      : mode === 'replace'
        ? Navigation.replaceUrl(href)
        : Navigation.pushUrl(href)
    ).pipe(Effect.as(Message.CompletedNavigation())),
});

export const PersistLocale = Command.define('PersistLocale', {
  args: { locale: LocaleSchema },
  messages: [Message.PersistedLocale, Message.FailedLocalePersistence],
  execute: ({ locale }) =>
    Effect.try({
      try: () => {
        localStorage.setItem('course-lens:locale', locale);
        document.documentElement.lang = localeTag(locale);
      },
      catch: () => new Error('Locale preference could not be persisted'),
    }).pipe(
      Effect.as(Message.PersistedLocale()),
      Effect.catch(() => Effect.succeed(Message.FailedLocalePersistence())),
    ),
});

/**
 * A static import would retain Norwegian strings in the initial production
 * chunk, so this is the only runtime edge to the Norwegian chunk.
 */
export const LoadNorwegianMessages = Command.define('LoadNorwegianMessages', {
  messages: [Message.LoadedNorwegianMessages, Message.FailedNorwegianMessages],
  execute: Effect.tryPromise({
    try: async () => {
      const { norwegianIndexedMessages, norwegianTokenCatalogue } = await import('./i18n.nb');
      return Message.LoadedNorwegianMessages({
        messages: norwegianIndexedMessages,
        tokens: norwegianTokenCatalogue,
      });
    },
    catch: () => new Error('Norwegian translations could not be loaded'),
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed(Message.FailedNorwegianMessages({ error: error.message })),
    ),
  ),
});

export const PersistSidebarPreference = Command.define('PersistSidebarPreference', {
  args: { collapsed: S.Boolean },
  messages: [Message.PersistedSidebarPreference, Message.FailedSidebarPreferencePersistence],
  execute: ({ collapsed }) =>
    Effect.try({
      try: () => {
        localStorage.setItem('course-lens:sidebar-collapsed', collapsed ? '1' : '0');
      },
      catch: () => new Error('Sidebar preference could not be persisted'),
    }).pipe(
      Effect.as(Message.PersistedSidebarPreference()),
      Effect.catch(() => Effect.succeed(Message.FailedSidebarPreferencePersistence())),
    ),
});

export const PersistListDensity = Command.define('PersistListDensity', {
  args: { density: ListDensitySchema },
  messages: [Message.PersistedListDensity, Message.FailedListDensityPersistence],
  execute: ({ density }) =>
    Effect.try({
      try: () => {
        localStorage.setItem(listDensityStorageKey, density);
      },
      catch: () => new Error('List density preference could not be persisted'),
    }).pipe(
      Effect.as(Message.PersistedListDensity()),
      Effect.catch(() => Effect.succeed(Message.FailedListDensityPersistence())),
    ),
});

/**
 * Local storage is untrusted input and an untrusted destination: reading and
 * writing the saved list happen here, at the application boundary, and every
 * failure path produces an explicit Message.
 */
export const LoadSavedCourses = Command.define('LoadSavedCourses', {
  messages: [Message.LoadedSavedCourses, Message.FailedSavedCoursesLoad],
  execute: Effect.try({
    try: () =>
      Message.LoadedSavedCourses({
        load: parseSavedList(localStorage.getItem(savedListStorageKey)),
      }),
    catch: () => new Error('Saved courses could not be read from this browser'),
  }).pipe(Effect.catch(() => Effect.succeed(Message.FailedSavedCoursesLoad()))),
});

export const PersistSavedCourses = Command.define('PersistSavedCourses', {
  args: { state: SavedListStateSchema },
  messages: [Message.PersistedSavedCourses, Message.FailedSavedCoursesPersistence],
  execute: ({ state }) =>
    Effect.try({
      try: () => {
        localStorage.setItem(savedListStorageKey, serializeSavedList(state));
      },
      catch: () => new Error('Saved courses could not be stored in this browser'),
    }).pipe(
      Effect.as(Message.PersistedSavedCourses()),
      Effect.catch(() => Effect.succeed(Message.FailedSavedCoursesPersistence())),
    ),
});

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

export const StampLabel = Command.define('StampLabel', {
  messages: [Message.StampedLabel],
  execute: Effect.sync(() => Message.StampedLabel({ labelId: newLabelId() })),
});

/** The clock stays in the boundary; `update` receives an observed timestamp. */
export const StampSavedCourse = Command.define('StampSavedCourse', {
  args: { courseCode: S.String },
  messages: [Message.StampedSavedCourse],
  execute: ({ courseCode }) =>
    Effect.sync(() =>
      Message.StampedSavedCourse({ courseCode, savedAt: new Date().toISOString() }),
    ),
});

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

const loadNorwegianMessages = (model: Model): UpdateReturn => {
  if (
    model.localization.locale !== 'nb' ||
    model.norwegianMessages._tag === 'NorwegianMessagesLoading' ||
    model.norwegianMessages._tag === 'NorwegianMessagesLoaded'
  ) {
    return { model };
  }
  return {
    model: modifyFields(model, {
      norwegianMessages: () => NorwegianMessagesLoading(),
    }),
    commands: [LoadNorwegianMessages()],
  };
};

const selectLocale = (model: Model, locale: Locale): UpdateReturn =>
  loadNorwegianMessages(
    modifyFields(model, {
      localization: () => ({
        locale,
        messages: model.localization.messages,
        tokens: model.localization.tokens,
      }),
    }),
  );

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

const requestGradeSignals = (
  requestedCodes: ReadonlyArray<string>,
  current: GradeSignalsResult,
  key: string,
  reset: boolean,
): Readonly<{ result: GradeSignalsResult; commands: Commands }> => {
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
  const courseCodes = requestedCodes.filter((courseCode) => !loadedCodes.has(courseCode));
  return courseCodes.length === 0
    ? { result: reset ? GradeSignalsResult.GradeSignalsIdle() : current, commands: [] }
    : {
        result: GradeSignalsResult.GradeSignalsLoading({
          previous,
          pendingCodes: [...pendingCodes, ...courseCodes],
        }),
        commands: [FetchGradeSignals({ courseCodes, requestKey: key })],
      };
};

const requestVisibleGradeSignals = (
  response: CourseSearchResponse,
  visibleCount: number,
  current: GradeSignalsResult,
  key: string,
  reset: boolean,
): Readonly<{ result: GradeSignalsResult; commands: Commands }> =>
  requestGradeSignals(
    response.items.slice(0, visibleCount).map((item) => item.code),
    current,
    key,
    reset,
  );

const requestDecisionSignals = (
  requestedCodes: ReadonlyArray<string>,
  current: DecisionSignalsResult,
  term: string,
  key: string,
  reset: boolean,
): Readonly<{ result: DecisionSignalsResult; commands: Commands }> => {
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
  const courseCodes = requestedCodes.filter((courseCode) => !loadedCodes.has(courseCode));
  return courseCodes.length === 0
    ? { result: reset ? DecisionSignalsResult.DecisionSignalsIdle() : current, commands: [] }
    : {
        result: DecisionSignalsResult.DecisionSignalsLoading({
          previous,
          pendingCodes: [...pendingCodes, ...courseCodes],
        }),
        commands: [FetchDecisionSignals({ courseCodes, term, requestKey: key })],
      };
};

const requestVisibleDecisionSignals = (
  response: CourseSearchResponse,
  visibleCount: number,
  current: DecisionSignalsResult,
  term: string,
  key: string,
  reset: boolean,
): Readonly<{ result: DecisionSignalsResult; commands: Commands }> =>
  requestDecisionSignals(
    response.items.slice(0, visibleCount).map((item) => item.code),
    current,
    term,
    key,
    reset,
  );

const requestListCourseSignals = (model: Model): UpdateReturn => {
  if (model.route !== 'list') return { model };
  const courseCodes = [
    ...new Set(
      projectedStudentCourses(model)
        .slice(0, DISPLAY_CHUNK)
        .map((course) => course.courseCode),
    ),
  ];
  const grades = requestGradeSignals(
    courseCodes,
    model.gradeSignals,
    model.activeRequestKey,
    false,
  );
  const decisions = requestDecisionSignals(
    courseCodes,
    model.decisionSignals,
    model.term,
    model.activeRequestKey,
    false,
  );
  return {
    model: modifyFields(model, {
      gradeSignals: () => grades.result,
      decisionSignals: () => decisions.result,
    }),
    commands: [...grades.commands, ...decisions.commands],
  };
};

export const normalizedUrl = (
  model: Model,
  selectedCode: string | null,
  pathname = EXPLORE_PATH,
): string => {
  const params = new URLSearchParams();
  params.set('lang', model.localization.locale);
  if (pathname === SCHEDULE_PATH) {
    // Schedule has its own compact URL state. `term` is still the root model's
    // value, but it remains explicit so a schedule link cannot silently change
    // period when the application default moves.
    params.set('term', model.term);
    params.set('week', String(model.schedule.week));
    // An explicit empty value means no courses are selected; it never means all.
    params.set('courses', model.schedule.selectedCodes.join(','));
    for (const key of model.schedule.hiddenActivityKeys) {
      params.append('hideActivity', key);
    }
    return `${pathname}?${params.toString()}`;
  }
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
  route === 'list'
    ? LIST_PATH
    : route === 'schedule'
      ? SCHEDULE_PATH
      : route === 'progress'
        ? PROGRESS_PATH
        : route === 'appearance'
          ? APPEARANCE_PATH
          : EXPLORE_PATH;

/** The shareable URL for the model as it currently stands. */
const currentUrl = (model: Model, selectedCode: string | null = model.selectedCode): string =>
  normalizedUrl(model, selectedCode, routePath(model.route));

const appearanceUrl = (model: Model): string => normalizedUrl(model, null, APPEARANCE_PATH);

export const listUrl = (model: Model): string => normalizedUrl(model, null, LIST_PATH);

const progressUrl = (model: Model): string => normalizedUrl(model, null, PROGRESS_PATH);

export const scheduleUrl = (model: Model): string => normalizedUrl(model, null, SCHEDULE_PATH);

export const exploreUrl = (model: Model): string => normalizedUrl(model, null, EXPLORE_PATH);

export const savedListState = (result: SavedCoursesResult): SavedListState | null =>
  result._tag === 'SavedCoursesReady' ? result.state : null;

export const isCourseSaved = (result: SavedCoursesResult, courseCode: string): boolean => {
  const state = savedListState(result);
  const identity = courseIdentity(courseCode);
  return state !== null && identity !== null && isSaved(state, identity);
};

export const projectedStudentCourses = (model: Model): ReadonlyArray<StudentCourse> => {
  const saved = savedListState(model.savedCourses);
  return saved === null ? [] : studentCourses(saved, progressResultCourses(model.progress));
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
): UpdateReturn => {
  const state = savedListState(model.savedCourses);
  const identity = courseIdentity(courseCode);
  if (state === null || identity === null) {
    return { model };
  }
  const next = change(state, identity);
  if (next === state && drafts === model.noteDrafts) {
    return { model };
  }
  const nextModel = modifyFields(model, {
    savedCourses: () =>
      SavedCoursesResultSchema.SavedCoursesReady({ state: next, repairedEntries: 0 }),
    noteDrafts: () => drafts,
  });
  return next === state
    ? { model: nextModel }
    : { model: nextModel, commands: [PersistSavedCourses({ state: next })] };
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
const canonicalizeLabelFilter = (model: Model): UpdateReturn => {
  const state = savedListState(model.savedCourses);
  if (state === null) {
    return { model };
  }
  const normalized = normalizeLabelFilter(state, model.labelFilter);
  if (sameLabelFilter(normalized.filter, model.labelFilter)) {
    return { model };
  }
  const nextModel = modifyFields(model, {
    labelFilter: () => normalized.filter,
    labelFilterNotice: () => ({
      unknownCount: normalized.unknownLabelIds.length,
      contradictoryLabelIds: normalized.contradictoryLabelIds,
      contradictoryUnlabeled: normalized.contradictoryUnlabeled,
    }),
  });
  return model.route === 'list'
    ? {
        model: nextModel,
        commands: [Navigate({ href: currentUrl(nextModel, null), mode: 'replace' })],
      }
    : { model: nextModel };
};

/**
 * A student-driven filter change is a history entry: Back and Forward restore
 * the previous recipe. It stays inside List, so no catalogue request is made.
 */
const applyLabelFilter = (model: Model, filter: LabelFilter): UpdateReturn => {
  if (sameLabelFilter(filter, model.labelFilter)) {
    return { model };
  }
  const nextModel = modifyFields(model, {
    labelFilter: () => filter,
    labelFilterNotice: () => null,
  });
  return {
    model: nextModel,
    commands: [Navigate({ href: currentUrl(nextModel, null), mode: 'push' })],
  };
};

/**
 * Everything the label form owns, returned to its initial state. Opening the
 * dialog, closing it by any route, and cancelling an edit all discard the draft
 * through this one value, so no path can leave half of it behind.
 */
const discardLabelDraft = (model: Model): Model =>
  modifyFields(model, {
    labelEditing: () => null,
    labelDraftName: () => '',
    labelDraftColor: () => defaultLabelColor,
    labelError: () => null,
    labelPendingDelete: () => null,
    selectionRemovePending: () => false,
    compareDifferencesOnly: () => true,
  });

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
): UpdateReturn => {
  switch (result._tag) {
    case 'LabelApplied': {
      const patchedModel = { ...model, ...patch };
      return {
        model: modifyFields(patchedModel, {
          savedCourses: () =>
            SavedCoursesResultSchema.SavedCoursesReady({ state: result.state, repairedEntries: 0 }),
          labelError: () => null,
        }),
        commands: [PersistSavedCourses({ state: result.state })],
      };
    }
    case 'LabelUnchanged':
      return { model: modifyFields({ ...model, ...patch }, { labelError: () => null }) };
    case 'LabelRejected':
      return { model: modifyFields(model, { labelError: () => result.reason }) };
  }
};

/** A label change that also has to leave the filter and the URL canonical, for
 *  instance after deleting a label the current recipe still refers to. */
const applyLabelStateChange = (
  model: Model,
  state: SavedListState,
  patch: Partial<Model> = {},
): UpdateReturn => {
  const normalized = normalizeLabelFilter(state, model.labelFilter);
  const filterChanged = !sameLabelFilter(normalized.filter, model.labelFilter);
  const nextModel = modifyFields(
    { ...model, ...patch },
    {
      savedCourses: () => SavedCoursesResultSchema.SavedCoursesReady({ state, repairedEntries: 0 }),
      labelError: () => null,
      labelFilter: () => normalized.filter,
      labelFilterNotice: () => null,
    },
  );
  return {
    model: nextModel,
    commands: [
      PersistSavedCourses({ state }),
      ...(filterChanged && model.route === 'list'
        ? [Navigate({ href: currentUrl(nextModel, null), mode: 'replace' })]
        : []),
    ],
  };
};

const startCatalogue = (
  model: Model,
  patch: Partial<
    Pick<Model, 'query' | 'term' | 'campus' | 'level' | 'sort' | 'openOnly' | 'englishOnly'>
  >,
): UpdateReturn => {
  const requestedModel = modifyFields(
    { ...model, ...patch },
    {
      selectedCode: () => null,
      detail: () => DetailResult.DetailClosed(),
    },
  );
  const request = searchRequest(requestedModel, 1);
  const key = requestKey(request);
  const nextModel = modifyFields(requestedModel, {
    activeRequestKey: () => key,
    visibleCount: () => DISPLAY_CHUNK,
    catalogue: () => CatalogueResult.CatalogueInitialLoading(),
    gradeSignals: () => GradeSignalsResult.GradeSignalsIdle(),
    decisionSignals: () => DecisionSignalsResult.DecisionSignalsIdle(),
    nextPage: () => NextPageState.NextPageIdle(),
  });
  return {
    model: nextModel,
    commands: [
      Navigate({ href: currentUrl(nextModel, null), mode: 'replace' }),
      fetchCommand(request, key, false),
    ],
  };
};

const oneOf = <A extends string>(value: string, values: ReadonlyArray<A>, fallback: A): A =>
  values.includes(value as A) ? (value as A) : fallback;

interface ParsedLocation {
  readonly locale: Locale;
  readonly route: Route;
  readonly query: string;
  readonly term: string;
  readonly scheduleWeek: number;
  readonly scheduleCodes: ReadonlyArray<string>;
  readonly scheduleHiddenActivityKeys: ReadonlyArray<string>;
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
    case SCHEDULE_PATH:
      return 'schedule';
    case PROGRESS_PATH:
      return 'progress';
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
  const term = url.searchParams.get('term') ?? DEFAULT_TERM;
  const scheduleCodes =
    path === 'schedule' ? parseScheduleCodes(url.searchParams.get('courses')) : [];
  const scheduleHiddenActivityKeys =
    path === 'schedule'
      ? parseHiddenActivityKeys(url.searchParams.getAll('hideActivity'), scheduleCodes)
      : [];
  return {
    route: path,
    locale: isLocale(requestedLocale) ? requestedLocale : fallbackLocale,
    query: url.searchParams.get('q') ?? '',
    term,
    scheduleWeek:
      path === 'schedule'
        ? normalizedWeek(url.searchParams.get('week'), term, currentOsloIsoWeek())
        : currentOsloIsoWeek(),
    scheduleCodes,
    scheduleHiddenActivityKeys,
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
    // List, Schedule, and Progress do not own course-detail state.
    selectedCode:
      path === 'list' || path === 'schedule' || path === 'progress'
        ? null
        : url.searchParams.get('course')?.trim().toUpperCase() || null,
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
        selectedCourseOrigins: [...courseOrigins],
        selectedCourseCodes: [],
        selectionRemovePending: false,
        labelDialogTarget: [],
      };

const scheduleSavedCourses = (result: SavedCoursesResult): ReadonlyArray<SavedCourse> | null =>
  result._tag === 'SavedCoursesReady' ? result.state.savedCourses : null;

const applyScheduleRouteState = (
  model: Model,
  term: string,
  week: number,
  selectedCodes: ReadonlyArray<string>,
  hiddenActivityKeys: ReadonlyArray<string>,
): UpdateReturn => {
  const savedCourses = scheduleSavedCourses(model.savedCourses);
  const scheduled = syncScheduleFromUrl(model.schedule, {
    term,
    week,
    selectedCodes,
    hiddenActivityKeys,
    availableCodes: savedCourses?.map((course) => course.courseCode) ?? null,
  });
  const nextModel = modifyFields(model, { schedule: () => scheduled.model });
  const commands = Command.mapMessages(scheduled.commands, (message) =>
    Message.GotScheduleMessage({ message }),
  );
  return scheduled.outMessage === undefined
    ? { model: nextModel, commands }
    : {
        model: nextModel,
        commands: [
          ...commands,
          Navigate({ href: scheduleUrl(nextModel), mode: scheduled.outMessage.mode }),
        ],
      };
};

const updateScheduleFeature = (
  model: Model,
  message: ScheduleMessage,
  toRootMessage: (message: ScheduleMessage) => Message,
): UpdateReturn => {
  const scheduled = updateSchedule(model.schedule, message, model.term);
  if (
    scheduled.model === model.schedule &&
    scheduled.commands === undefined &&
    scheduled.outMessage === undefined
  ) {
    return { model };
  }
  const nextModel = modifyFields(model, { schedule: () => scheduled.model });
  const commands = Command.mapMessages(scheduled.commands, toRootMessage);
  return scheduled.outMessage === undefined
    ? { model: nextModel, commands }
    : {
        model: nextModel,
        commands: [
          ...commands,
          Navigate({ href: scheduleUrl(nextModel), mode: scheduled.outMessage.mode }),
        ],
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

const applySelectValue = (model: Model, id: SelectControlId, value: string): UpdateReturn => {
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
      const selected = selectLocale(model, locale);
      const nextModel = selected.model;
      return {
        model: nextModel,
        commands: [
          ...(selected.commands ?? []),
          PersistLocale({ locale }),
          Navigate({ href: currentUrl(nextModel), mode: 'replace' }),
        ],
      };
    }
  }
};

const updateSelectFieldControl = (
  model: Model,
  id: SelectControlId,
  selectMessage: SelectFieldMessage,
  toRootMessage: (message: SelectFieldMessage) => Message,
): UpdateReturn => {
  const selectFieldUpdate = updateSelectField(
    selectFieldModel(model.selectFields, id),
    selectMessage,
  );
  const nextModel = modifyFields(model, {
    selectFields: () => replaceSelectFieldModel(model.selectFields, id, selectFieldUpdate.model),
  });
  const selectCommands = Command.mapMessages(selectFieldUpdate.commands, toRootMessage);
  if (selectFieldUpdate.outMessage === undefined) {
    return { model: nextModel, commands: selectCommands };
  }
  const selected = applySelectValue(nextModel, id, selectFieldUpdate.outMessage.value);
  return {
    model: selected.model,
    commands: [...selectCommands, ...(selected.commands ?? [])],
  };
};

const updateAppearancePreference = (
  model: Model,
  message: AppearanceMessage,
  toRootMessage: (message: AppearanceMessage) => Message,
): UpdateReturn => {
  const appearanceUpdate = updateAppearance(initAppearance(model.themePreference), message);
  return {
    model: modifyFields(model, {
      themePreference: () => appearanceUpdate.model.preference,
    }),
    commands: Command.mapMessages(appearanceUpdate.commands, toRootMessage),
  };
};

const updateLabelFilterModeRadioGroup = Update.foldChild({
  update: LabelFilterModeRadioGroup.update,
  read: (model: Model) => Option.some(model.labelFilterModeRadioGroup),
  write: (model, nextLabelFilterModeRadioGroup) =>
    modifyFields(model, {
      labelFilterModeRadioGroup: () => nextLabelFilterModeRadioGroup,
    }),
  toParentMessage: (message) => Message.GotLabelFilterModeRadioGroupMessage({ message }),
  foldOutMessage: (outMessage) =>
    RadioGroup.OutMessage.match<Update.Step<Model, Message>, typeof outMessage>(outMessage, {
      Selected:
        ({ value }) =>
        (model) =>
          applyLabelFilter(model, setLabelFilterMode(model.labelFilter, value)),
    }),
});

const updateListDensityRadioGroup = Update.foldChild({
  update: ListDensityRadioGroup.update,
  read: (model: Model) => Option.some(model.listDensityRadioGroup),
  write: (model, nextListDensityRadioGroup) =>
    modifyFields(model, {
      listDensityRadioGroup: () => nextListDensityRadioGroup,
    }),
  toParentMessage: (message) => Message.GotListDensityRadioGroupMessage({ message }),
  foldOutMessage: (outMessage) =>
    RadioGroup.OutMessage.match<Update.Step<Model, Message>, typeof outMessage>(outMessage, {
      Selected:
        ({ value }) =>
        (model) =>
          model.listDensity === value
            ? { model }
            : {
                model: modifyFields(model, { listDensity: () => value }),
                commands: [PersistListDensity({ density: value })],
              },
    }),
});

const updateLabelDraftColorRadioGroup = Update.foldChild({
  update: LabelDraftColorRadioGroup.update,
  read: (model: Model) => Option.some(model.labelDraftColorRadioGroup),
  write: (model, nextLabelDraftColorRadioGroup) =>
    modifyFields(model, {
      labelDraftColorRadioGroup: () => nextLabelDraftColorRadioGroup,
    }),
  toParentMessage: (message) => Message.GotLabelDraftColorRadioGroupMessage({ message }),
  foldOutMessage: (outMessage) =>
    RadioGroup.OutMessage.match<Update.Step<Model, Message>, typeof outMessage>(outMessage, {
      Selected:
        ({ value }) =>
        (model) => ({
          model: modifyFields(model, { labelDraftColor: () => value }),
        }),
    }),
});
export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    UpdatedQuery: ({ value }) => ({
      model: modifyFields(model, { query: () => value }),
    }),
    ChangedLocale: ({ value }) => {
      const locale = isLocale(value) ? value : 'en';
      const selected = selectLocale(model, locale);
      const nextModel = selected.model;
      return {
        model: nextModel,
        commands: [
          ...(selected.commands ?? []),
          PersistLocale({ locale }),
          Navigate({ href: currentUrl(nextModel), mode: 'replace' }),
        ],
      };
    },
    LoadedNorwegianMessages: ({ messages, tokens }) => {
      return {
        model: modifyFields(model, {
          localization: () => ({
            locale: model.localization.locale,
            messages,
            tokens,
          }),
          norwegianMessages: () => NorwegianMessagesLoaded(),
        }),
      };
    },
    FailedNorwegianMessages: ({ error }) => ({
      model: modifyFields(model, {
        norwegianMessages: () => NorwegianMessagesFailed({ error }),
      }),
    }),
    ToggledSidebar: () => {
      const sidebarCollapsed = !model.sidebarCollapsed;
      return {
        model: modifyFields(model, { sidebarCollapsed: () => sidebarCollapsed }),
        commands: [PersistSidebarPreference({ collapsed: sidebarCollapsed })],
      };
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
    ChangedOutcomeView: ({ value }) => ({
      model: modifyFields(model, {
        outcomeView: () => oneOf(value, ['letter', 'pass-fail'], 'letter'),
      }),
    }),
    RequestedMoreCourses: () => {
      const response = catalogueResponse(model.catalogue);
      if (response === null || model.nextPage._tag === 'NextPageLoading') {
        return { model };
      }
      if (model.visibleCount < response.items.length) {
        const visibleCount = Math.min(response.items.length, model.visibleCount + DISPLAY_CHUNK);
        const gradeSignalsRequest = requestVisibleGradeSignals(
          response,
          visibleCount,
          model.gradeSignals,
          model.activeRequestKey,
          false,
        );
        const decisionSignalsRequest = requestVisibleDecisionSignals(
          response,
          visibleCount,
          model.decisionSignals,
          model.term,
          model.activeRequestKey,
          false,
        );
        return {
          model: modifyFields(model, {
            visibleCount: () => visibleCount,
            gradeSignals: () => gradeSignalsRequest.result,
            decisionSignals: () => decisionSignalsRequest.result,
            nextPage: () => NextPageState.NextPageIdle(),
          }),
          commands: [...gradeSignalsRequest.commands, ...decisionSignalsRequest.commands],
        };
      }
      if (!response.meta.hasMore) {
        return { model };
      }
      const request = searchRequest(model, response.meta.page + 1);
      return {
        model: modifyFields(model, {
          nextPage: () => NextPageState.NextPageLoading(),
        }),
        commands: [fetchCommand(request, model.activeRequestKey, true)],
      };
    },
    RequestedUrl: ({ href, external }) => ({
      model,
      commands: [Navigate({ href, mode: external ? 'external' : 'push' })],
    }),
    ChangedUrl: ({ href }) => {
      const location = parseLocation(href);
      if (location.route === 'schedule') {
        const locationModel = modifyFields(forRoute(model, 'schedule'), {
          route: () => 'schedule',
          query: () => location.query,
          term: () => location.term,
          campus: () => location.campus,
          level: () => location.level,
          sort: () => location.sort,
          openOnly: () => location.openOnly,
          englishOnly: () => location.englishOnly,
          selectedCode: () => null,
          detail: () => DetailResult.DetailClosed(),
          labelFilter: () => emptyLabelFilter,
          compareCodes: () => [],
          labelFilterNotice: () => null,
        });
        const localized = selectLocale(locationModel, location.locale);
        const scheduled = applyScheduleRouteState(
          localized.model,
          location.term,
          location.scheduleWeek,
          location.scheduleCodes,
          location.scheduleHiddenActivityKeys,
        );
        return {
          model: scheduled.model,
          commands: [
            ...(localized.commands ?? []),
            ...(location.locale === model.localization.locale
              ? []
              : [PersistLocale({ locale: location.locale })]),
            ...(scheduled.commands ?? []),
          ],
        };
      }
      const withCanonicalFilter = (result: UpdateReturn): UpdateReturn => {
        const canonicalization = canonicalizeLabelFilter(result.model);
        const signals = requestListCourseSignals(canonicalization.model);
        return {
          model: signals.model,
          commands: [
            ...(result.commands ?? []),
            ...(canonicalization.commands ?? []),
            ...(signals.commands ?? []),
          ],
        };
      };
      if (!locationMatchesModel(location, model) || model.route === 'schedule') {
        const locationModel = modifyFields(forRoute(model, location.route), {
          route: () => location.route,
          query: () => location.query,
          term: () => location.term,
          campus: () => location.campus,
          level: () => location.level,
          sort: () => location.sort,
          openOnly: () => location.openOnly,
          englishOnly: () => location.englishOnly,
          selectedCode: () => location.selectedCode,
          detail: () =>
            location.selectedCode === null
              ? DetailResult.DetailClosed()
              : DetailResult.DetailLoading(),
          catalogue: () => CatalogueResult.CatalogueInitialLoading(),
          gradeSignals: () => GradeSignalsResult.GradeSignalsIdle(),
          decisionSignals: () => DecisionSignalsResult.DecisionSignalsIdle(),
          nextPage: () => NextPageState.NextPageIdle(),
          visibleCount: () => DISPLAY_CHUNK,
          labelFilter: () => location.labelFilter,
          compareCodes: () => location.compareCodes,
          labelFilterNotice: () => null,
        });
        const localized = selectLocale(locationModel, location.locale);
        const request = searchRequest(localized.model, 1);
        const key = requestKey(request);
        const nextModel = modifyFields(localized.model, {
          activeRequestKey: () => key,
        });
        return withCanonicalFilter({
          model: nextModel,
          commands: [
            ...(localized.commands ?? []),
            ...(location.locale === model.localization.locale
              ? []
              : [PersistLocale({ locale: location.locale })]),
            fetchCommand(request, key, false),
            ...(location.selectedCode === null
              ? []
              : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
          ],
        });
      }
      /**
       * A label-filter change is local interaction state: the catalogue
       * request is unchanged, so history navigation restores the recipe
       * without refetching anything.
       */
      const routedModel: Model =
        location.locale === model.localization.locale &&
        location.route === model.route &&
        sameLabelFilter(location.labelFilter, model.labelFilter)
          ? model
          : modifyFields(forRoute(model, location.route), {
              route: () => location.route,
              labelFilter: () => location.labelFilter,
              compareCodes: () => location.compareCodes,
              labelFilterNotice: () =>
                sameLabelFilter(location.labelFilter, model.labelFilter)
                  ? model.labelFilterNotice
                  : null,
            });
      const localized = selectLocale(routedModel, location.locale);
      const localeCommands: Commands = [
        ...(localized.commands ?? []),
        ...(location.locale === model.localization.locale
          ? []
          : [PersistLocale({ locale: location.locale })]),
      ];
      if (location.selectedCode === model.selectedCode) {
        return withCanonicalFilter({ model: localized.model, commands: localeCommands });
      }
      const nextModel = modifyFields(localized.model, {
        selectedCode: () => location.selectedCode,
        detail: () =>
          location.selectedCode === null
            ? DetailResult.DetailClosed()
            : DetailResult.DetailLoading(),
      });
      return withCanonicalFilter({
        model: nextModel,
        commands:
          location.selectedCode === null
            ? localeCommands
            : [
                ...localeCommands,
                FetchCourseInsight({ courseCode: location.selectedCode, term: model.term }),
              ],
      });
    },
    ClosedCourse: () => ({
      model,
      commands: [Navigate({ href: currentUrl(model, null), mode: 'replace' })],
    }),
    SucceededCourseSearch: ({ requestKey: key, append, response: nextResponse }) => {
      if (key !== model.activeRequestKey) {
        return { model };
      }
      const response = mergeResponses(
        append ? catalogueResponse(model.catalogue) : null,
        nextResponse,
      );
      const result: CatalogueResult =
        response.items.length === 0
          ? CatalogueResult.CatalogueEmpty()
          : isPartial(response)
            ? CatalogueResult.CataloguePartial({ response })
            : CatalogueResult.CatalogueSuccess({ response });
      const visibleCount = append
        ? Math.min(response.items.length, model.visibleCount + DISPLAY_CHUNK)
        : Math.min(DISPLAY_CHUNK, response.items.length);
      const gradeSignalsRequest = requestVisibleGradeSignals(
        response,
        visibleCount,
        model.gradeSignals,
        key,
        !append,
      );
      const decisionSignalsRequest = requestVisibleDecisionSignals(
        response,
        visibleCount,
        model.decisionSignals,
        model.term,
        key,
        !append,
      );
      return {
        model: modifyFields(model, {
          catalogue: () => result,
          gradeSignals: () => gradeSignalsRequest.result,
          decisionSignals: () => decisionSignalsRequest.result,
          visibleCount: () => visibleCount,
          nextPage: () => NextPageState.NextPageIdle(),
        }),
        commands: [...gradeSignalsRequest.commands, ...decisionSignalsRequest.commands],
      };
    },
    FailedCourseSearch: ({ requestKey: key, append, error }) => {
      if (key !== model.activeRequestKey) {
        return { model };
      }
      return {
        model: modifyFields(model, {
          ...(append
            ? { nextPage: () => NextPageState.NextPageFailure({ error }) }
            : { catalogue: () => CatalogueResult.CatalogueFailure({ error }) }),
        }),
      };
    },
    SucceededGradeSignals: ({ requestKey: key, courseCodes, response: nextResponse }) => {
      if (key !== model.activeRequestKey) {
        return { model };
      }
      const response = mergeGradeSignals(gradeSignalsResponse(model.gradeSignals), nextResponse);
      const completedCodes = new Set(courseCodes);
      const pendingCodes =
        model.gradeSignals._tag === 'GradeSignalsLoading'
          ? model.gradeSignals.pendingCodes.filter((code) => !completedCodes.has(code))
          : [];
      return {
        model: modifyFields(model, {
          gradeSignals: () =>
            pendingCodes.length > 0
              ? GradeSignalsResult.GradeSignalsLoading({ previous: response, pendingCodes })
              : isGradeSignalsPartial(response)
                ? GradeSignalsResult.GradeSignalsPartial({ response })
                : GradeSignalsResult.GradeSignalsSuccess({ response }),
        }),
      };
    },
    FailedGradeSignals: ({ requestKey: key, error }) =>
      key !== model.activeRequestKey
        ? { model }
        : {
            model: modifyFields(model, {
              gradeSignals: () =>
                GradeSignalsResult.GradeSignalsFailure({
                  previous: gradeSignalsResponse(model.gradeSignals),
                  error,
                }),
            }),
          },
    SucceededDecisionSignals: ({ requestKey: key, courseCodes, response: nextResponse }) => {
      if (key !== model.activeRequestKey) {
        return { model };
      }
      const response = mergeDecisionSignals(
        decisionSignalsResponse(model.decisionSignals),
        nextResponse,
      );
      const completedCodes = new Set(courseCodes);
      const pendingCodes =
        model.decisionSignals._tag === 'DecisionSignalsLoading'
          ? model.decisionSignals.pendingCodes.filter((code) => !completedCodes.has(code))
          : [];
      return {
        model: modifyFields(model, {
          decisionSignals: () =>
            pendingCodes.length > 0
              ? DecisionSignalsResult.DecisionSignalsLoading({ previous: response, pendingCodes })
              : DecisionSignalsResult.DecisionSignalsSuccess({ response }),
        }),
      };
    },
    FailedDecisionSignals: ({ requestKey: key, error }) =>
      key !== model.activeRequestKey
        ? { model }
        : {
            model: modifyFields(model, {
              decisionSignals: () =>
                DecisionSignalsResult.DecisionSignalsFailure({
                  previous: decisionSignalsResponse(model.decisionSignals),
                  error,
                }),
            }),
          },
    SucceededCourseInsight: ({ courseCode, response }) => {
      if (courseCode !== model.selectedCode) {
        return { model };
      }
      return {
        model: modifyFields(model, {
          detail: () =>
            response.meta.partial
              ? DetailResult.DetailPartial({ response })
              : DetailResult.DetailSuccess({ response }),
        }),
      };
    },
    FailedCourseInsight: ({ courseCode, error }) =>
      courseCode === model.selectedCode
        ? {
            model: modifyFields(model, {
              detail: () => DetailResult.DetailFailure({ error }),
            }),
          }
        : { model },
    CompletedNavigation: () => ({ model }),
    FailedNavigation: () => ({ model }),
    PersistedLocale: () => ({ model }),
    FailedLocalePersistence: () => ({ model }),
    PersistedSidebarPreference: () => ({ model }),
    FailedSidebarPreferencePersistence: () => ({ model }),
    RequestedOpenRefineDialog: () => {
      const refineDialogOpen = Dialog.open(model.refineDialog);
      return {
        model: modifyFields(model, {
          refineDialog: () => refineDialogOpen.model,
        }),
        commands: Command.mapMessages(refineDialogOpen.commands, (message) =>
          Message.GotRefineDialogMessage({ message }),
        ),
      };
    },
    GotRefineDialogMessage: ({ message: dialogMessage }) => {
      const refineDialogUpdate = Dialog.update(model.refineDialog, dialogMessage);
      return {
        model: modifyFields(model, {
          refineDialog: () => refineDialogUpdate.model,
        }),
        commands: Command.mapMessages(refineDialogUpdate.commands, (message) =>
          Message.GotRefineDialogMessage({ message }),
        ),
      };
    },
    GotAppearanceMessage: ({ message: appearanceMessage }) =>
      updateAppearancePreference(model, appearanceMessage, (message) =>
        Message.GotAppearanceMessage({ message }),
      ),
    GotProgressMessage: ({ message: progressMessage }) => {
      const progressUpdate = updateProgress(model.progress, progressMessage);
      const updatedModel = modifyFields(model, {
        progress: () => progressUpdate.model,
        selectedCourseCodes: () => (model.route === 'list' ? [] : model.selectedCourseCodes),
        selectionRemovePending: () =>
          model.route === 'list' ? false : model.selectionRemovePending,
      });
      const signals = requestListCourseSignals(updatedModel);
      return {
        model: signals.model,
        commands: [
          ...Command.mapMessages(progressUpdate.commands, (message) =>
            Message.GotProgressMessage({ message }),
          ),
          ...(signals.commands ?? []),
        ],
      };
    },
    GotLabelFilterModeRadioGroupMessage: ({ message }) =>
      updateLabelFilterModeRadioGroup(model, message),
    GotListDensityRadioGroupMessage: ({ message }) => updateListDensityRadioGroup(model, message),
    GotLabelDraftColorRadioGroupMessage: ({ message }) =>
      updateLabelDraftColorRadioGroup(model, message),
    LoadedSavedCourses: ({ load }) => {
      switch (load._tag) {
        case 'SavedListEmpty': {
          const loadedModel = modifyFields(model, {
            savedCourses: () =>
              SavedCoursesResultSchema.SavedCoursesReady({
                state: emptySavedList,
                repairedEntries: 0,
              }),
          });
          return loadedModel.route === 'schedule'
            ? applyScheduleRouteState(
                loadedModel,
                loadedModel.term,
                loadedModel.schedule.week,
                loadedModel.schedule.selectedCodes,
                loadedModel.schedule.hiddenActivityKeys,
              )
            : requestListCourseSignals(loadedModel);
        }
        case 'SavedListLoaded': {
          // A filter recipe can only be judged against a loaded label set, so
          // canonicalization happens here rather than while parsing the URL.
          const loadedModel = modifyFields(model, {
            savedCourses: () =>
              SavedCoursesResultSchema.SavedCoursesReady({
                state: load.state,
                repairedEntries: load.repairedEntries,
              }),
          });
          if (loadedModel.route === 'schedule') {
            const scheduled = applyScheduleRouteState(
              loadedModel,
              loadedModel.term,
              loadedModel.schedule.week,
              loadedModel.schedule.selectedCodes,
              loadedModel.schedule.hiddenActivityKeys,
            );
            return {
              model: scheduled.model,
              commands: [
                ...(load.repairedEntries === 0 ? [] : [PersistSavedCourses({ state: load.state })]),
                ...(scheduled.commands ?? []),
              ],
            };
          }
          const canonicalization = canonicalizeLabelFilter(loadedModel);
          const signals = requestListCourseSignals(canonicalization.model);
          return {
            model: signals.model,
            commands: [
              // Repairs are written back so the stored value matches what the
              // student is shown; an untouched list is never rewritten.
              ...(load.repairedEntries === 0 ? [] : [PersistSavedCourses({ state: load.state })]),
              ...(canonicalization.commands ?? []),
              ...(signals.commands ?? []),
            ],
          };
        }
        case 'SavedListUnsupported':
          return {
            model: modifyFields(model, {
              savedCourses: () =>
                SavedCoursesResultSchema.SavedCoursesRecovery({
                  reason: 'unsupported-version',
                  storedVersion: load.storedVersion,
                  raw: load.raw,
                }),
            }),
          };
        case 'SavedListCorrupt':
          return {
            model: modifyFields(model, {
              savedCourses: () =>
                SavedCoursesResultSchema.SavedCoursesRecovery({
                  reason: load.reason === 'invalid-json' ? 'invalid-json' : 'unreadable',
                  storedVersion: null,
                  raw: load.raw,
                }),
            }),
          };
      }
    },
    FailedSavedCoursesLoad: () => ({
      model: modifyFields(model, {
        savedCourses: () =>
          SavedCoursesResultSchema.SavedCoursesRecovery({
            reason: 'unavailable',
            storedVersion: null,
            raw: '',
          }),
      }),
    }),
    RequestedSaveCourse: ({ courseCode }) => {
      const state = savedListState(model.savedCourses);
      const identity = courseIdentity(courseCode);
      return state === null || identity === null || isSaved(state, identity)
        ? { model }
        : { model, commands: [StampSavedCourse({ courseCode: identity.courseCode })] };
    },
    StampedSavedCourse: ({ courseCode, savedAt }) =>
      applySavedListChange(
        model,
        (state, identity) => saveCourse(state, identity, savedAt),
        courseCode,
      ),
    RequestedRemoveSavedCourse: ({ courseCode }) => {
      const state = savedListState(model.savedCourses);
      const identity = courseIdentity(courseCode);
      if (state === null || identity === null) {
        return { model };
      }
      if (findSavedCourse(state, identity) === null) {
        return { model };
      }
      const next = removeSavedCourse(state, identity);
      return {
        model: modifyFields(model, {
          savedCourses: () =>
            SavedCoursesResultSchema.SavedCoursesReady({ state: next, repairedEntries: 0 }),
          noteDrafts: () => withoutNoteDraft(model.noteDrafts, identity.courseCode),
          // Removing a course clears its memberships, its note draft, and its
          // selection in the same transition; nothing can act on it after.
          selectedCourseCodes: () =>
            withoutSelected(model.selectedCourseCodes, identity.courseCode),
          labelDialogTarget: () => withoutSelected(model.labelDialogTarget, identity.courseCode),
        }),
        commands: [PersistSavedCourses({ state: next })],
      };
    },
    UpdatedSavedNoteDraft: ({ courseCode, value }) => ({
      model: modifyFields(model, {
        noteDrafts: () => [
          ...withoutNoteDraft(model.noteDrafts, courseCode),
          { courseCode, value },
        ],
      }),
    }),
    SubmittedSavedNote: ({ courseCode }) => {
      const draft = model.noteDrafts.find((entry) => entry.courseCode === courseCode);
      return draft === undefined
        ? { model }
        : applySavedListChange(
            model,
            (state, identity) => setSavedCourseNote(state, identity, draft.value),
            courseCode,
            withoutNoteDraft(model.noteDrafts, courseCode),
          );
    },
    RequestedSavedCoursesReset: () => ({
      model: modifyFields(model, {
        savedCourses: () =>
          SavedCoursesResultSchema.SavedCoursesReady({
            state: emptySavedList,
            repairedEntries: 0,
          }),
        noteDrafts: () => [],
        selectedCourseCodes: () => [],
        labelDialogTarget: () => [],
        labelFilter: () => emptyLabelFilter,
        labelFilterNotice: () => null,
        labelEditing: () => null,
        labelDraftName: () => '',
        labelPendingDelete: () => null,
      }),
      commands: [PersistSavedCourses({ state: emptySavedList })],
    }),
    PersistedSavedCourses: () =>
      model.savedCoursesPersistFailed
        ? {
            model: modifyFields(model, {
              savedCoursesPersistFailed: () => false,
            }),
          }
        : { model },
    FailedSavedCoursesPersistence: () => ({
      model: modifyFields(model, {
        savedCoursesPersistFailed: () => true,
      }),
    }),
    ChangedLabelInclusion: ({ predicate, isIncluded }) =>
      applyLabelFilter(model, setPredicateIncluded(model.labelFilter, predicate, isIncluded)),
    ChangedLabelExclusion: ({ predicate, isExcluded }) =>
      applyLabelFilter(model, setPredicateExcluded(model.labelFilter, predicate, isExcluded)),
    ChangedLabelFilterMode: ({ mode }) =>
      applyLabelFilter(model, setLabelFilterMode(model.labelFilter, mode)),
    ClearedLabelFilter: () => applyLabelFilter(model, emptyLabelFilter),
    ClearedCourseFilters: () =>
      applyLabelFilter(
        modifyFields(model, {
          selectedCourseOrigins: () => [...courseOrigins],
          selectedCourseCodes: () => [],
          selectionRemovePending: () => false,
        }),
        emptyLabelFilter,
      ),
    ToggledSavedCourseSelection: ({ courseCode, isSelected }) => ({
      model: modifyFields(model, {
        selectedCourseCodes: () =>
          isSelected
            ? [...withoutSelected(model.selectedCourseCodes, courseCode), courseCode]
            : withoutSelected(model.selectedCourseCodes, courseCode),
        // The prompt named a specific set; changing the set retracts it.
        selectionRemovePending: () => false,
      }),
    }),
    ClearedSavedCourseSelection: () => ({
      model: modifyFields(model, {
        selectedCourseCodes: () => [],
        selectionRemovePending: () => false,
      }),
    }),
    /**
     * Entering a comparison hands the ephemeral selection to the URL, where
     * a refresh or a back step can find it again. The selection itself stays
     * out of the URL and is cleared, so the tray does not shadow the
     * comparison it just opened.
     */
    RequestedCompare: () => {
      const nextModel = modifyFields(model, {
        compareCodes: () => model.selectedCourseCodes,
        selectedCourseCodes: () => [],
        selectionRemovePending: () => false,
      });
      return {
        model: nextModel,
        commands: [Navigate({ href: currentUrl(nextModel, null), mode: 'push' })],
      };
    },
    GotCompareMessage: ({ message: compareMessage }) =>
      updateComparison(model, compareMessage, (message) => Message.GotCompareMessage({ message })),
    GotScheduleMessage: ({ message: scheduleMessage }) =>
      updateScheduleFeature(model, scheduleMessage, (message) =>
        Message.GotScheduleMessage({ message }),
      ),
    RequestedRemoveSelected: () => ({
      model: modifyFields(model, { selectionRemovePending: () => true }),
    }),
    CancelledRemoveSelected: () => ({
      model: modifyFields(model, { selectionRemovePending: () => false }),
    }),
    ConfirmedRemoveSelected: () => {
      const state = savedListState(model.savedCourses);
      if (state === null) {
        return {
          model: modifyFields(model, { selectionRemovePending: () => false }),
        };
      }
      const identities = model.selectedCourseCodes
        .map((courseCode) => courseIdentity(courseCode))
        .filter((identity) => identity !== null);
      const courses = identities
        .map((identity) => findSavedCourse(state, identity))
        .filter((course) => course !== null);
      if (courses.length === 0) {
        return {
          model: modifyFields(model, {
            selectionRemovePending: () => false,
            selectedCourseCodes: () => [],
          }),
        };
      }
      const next = identities.reduce(
        (remaining, identity) => removeSavedCourse(remaining, identity),
        state,
      );
      return {
        model: modifyFields(model, {
          savedCourses: () =>
            SavedCoursesResultSchema.SavedCoursesReady({ state: next, repairedEntries: 0 }),
          noteDrafts: () =>
            identities.reduce(
              (drafts, identity) => withoutNoteDraft(drafts, identity.courseCode),
              model.noteDrafts,
            ),
          selectedCourseCodes: () => [],
          labelDialogTarget: () => [],
          selectionRemovePending: () => false,
        }),
        commands: [PersistSavedCourses({ state: next })],
      };
    },
    /** A density change is a preference, never a change to the saved set: it
     *  persists locally and produces no navigation and no fetch. */
    ChangedListDensity: ({ value }) =>
      model.listDensity === value
        ? { model }
        : {
            model: modifyFields(model, { listDensity: () => value }),
            commands: [PersistListDensity({ density: value })],
          },
    ToggledCourseOrigin: ({ origin, isIncluded }) =>
      model.selectedCourseOrigins.includes(origin) === isIncluded
        ? { model }
        : {
            model: modifyFields(model, {
              selectedCourseOrigins: () =>
                isIncluded
                  ? courseOrigins.filter(
                      (candidate) =>
                        candidate === origin || model.selectedCourseOrigins.includes(candidate),
                    )
                  : model.selectedCourseOrigins.filter((candidate) => candidate !== origin),
              selectedCourseCodes: () => [],
              selectionRemovePending: () => false,
            }),
          },
    PersistedListDensity: () => ({ model }),
    FailedListDensityPersistence: () => ({ model }),
    /**
     * One dialog owns label creation, editing, and attachment. Opening it
     * carries the explicit target: a single row, the current selection, or
     * nothing at all when the student only manages the label set.
     */
    RequestedLabelDialog: ({ courseCodes }) => {
      const labelDialogOpen = Dialog.open(model.labelDialog);
      return {
        model: modifyFields(discardLabelDraft(model), {
          labelDialog: () => labelDialogOpen.model,
          labelDialogTarget: () => courseCodes,
        }),
        commands: Command.mapMessages(labelDialogOpen.commands, (message) =>
          Message.GotLabelDialogMessage({ message }),
        ),
      };
    },
    /**
     * Cancel, the backdrop, and Escape all arrive here as one close, so the
     * draft is discarded on exactly one path rather than three.
     */
    GotLabelDialogMessage: ({ message: dialogMessage }) => {
      const labelDialogUpdate = Dialog.update(model.labelDialog, dialogMessage);
      const closing = dialogMessage._tag === 'RequestedClose';
      return {
        model: modifyFields(closing ? discardLabelDraft(model) : model, {
          labelDialog: () => labelDialogUpdate.model,
          ...(closing ? { labelDialogTarget: () => [] } : {}),
        }),
        commands: Command.mapMessages(labelDialogUpdate.commands, (message) =>
          Message.GotLabelDialogMessage({ message }),
        ),
      };
    },
    /**
     * The draft is the only thing that changes while the student types. Once
     * an Apply attempt has produced feedback, the feedback is recomputed from
     * the draft being corrected, so it never describes a name that is no
     * longer on screen — and it stays absent until that first attempt.
     */
    UpdatedLabelDraftName: ({ value }) => {
      const nextModel = modifyFields(model, { labelDraftName: () => value });
      return {
        model: modifyFields(nextModel, {
          labelError: () => (model.labelError === null ? null : labelDraftRejection(nextModel)),
        }),
      };
    },
    /**
     * Colour is draft state like the name. Choosing one never creates,
     * updates, or attaches a label; only Apply does.
     */
    ChangedLabelDraftColor: ({ value }) => ({
      model: modifyFields(model, { labelDraftColor: () => value }),
    }),
    /**
     * Apply is the single transition. Creating needs an id from the boundary,
     * so the rules are checked here first: an empty or duplicate name never
     * reaches the command, and the student keeps the draft they have to fix.
     */
    SubmittedLabelForm: () => {
      const state = savedListState(model.savedCourses);
      if (state === null) {
        return { model };
      }
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
      return rejection === null
        ? { model, commands: [StampLabel()] }
        : {
            model: modifyFields(model, {
              labelError: () => rejection,
            }),
          };
    },
    /**
     * A label created from a course or a selection is attached in the same
     * transition, so "Add labels" is one action rather than create-then-find.
     */
    StampedLabel: ({ labelId }) => {
      const state = savedListState(model.savedCourses);
      if (state === null) {
        return { model };
      }
      const created = createLabel(state, {
        id: labelId,
        name: model.labelDraftName,
        color: model.labelDraftColor,
      });
      // A refused create attaches nothing: the draft stays exactly as the
      // student left it so they can correct the reason and try again.
      if (created._tag !== 'LabelApplied') {
        return applyLabelResult(model, created);
      }
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
      return label === null
        ? {
            model: modifyFields(model, {
              labelError: () => 'unknown-label',
            }),
          }
        : {
            model: modifyFields(model, {
              labelEditing: () => label.id,
              labelDraftName: () => label.name,
              labelDraftColor: () => label.color,
              labelError: () => null,
            }),
          };
    },
    CancelledLabelEdit: () => ({ model: discardLabelDraft(model) }),
    /** Deletion is permanent and drops every membership on the label, so a
     *  single click only arms an in-dialog confirmation. Nothing is removed
     *  until the student explicitly confirms that specific label. */
    RequestedDeleteLabel: ({ labelId }) =>
      savedListState(model.savedCourses) === null
        ? { model }
        : {
            model: modifyFields(model, {
              labelPendingDelete: () => labelId,
            }),
          },
    CancelledLabelDelete: () => ({
      model: modifyFields(model, { labelPendingDelete: () => null }),
    }),
    /** Deleting a label removes its memberships and leaves no filter that can
     *  still refer to it, so the URL is rewritten to the canonical recipe. */
    ConfirmedDeleteLabel: ({ labelId }) => {
      const state = savedListState(model.savedCourses);
      if (state === null) {
        return { model };
      }
      const result = deleteLabel(state, labelId);
      if (result._tag !== 'LabelApplied') {
        return applyLabelResult(model, result);
      }
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
      if (state === null) {
        return { model };
      }
      const targets = labelTargetIdentities(state, model.labelDialogTarget);
      if (targets.length === 0) {
        return { model };
      }
      const next = isAttached
        ? attachLabel(state, labelId, targets)
        : detachLabel(state, labelId, targets);
      return next === state
        ? { model }
        : applyLabelResult(model, { _tag: 'LabelApplied', state: next });
    },
    GotSelectFieldMessage: ({ id, message: selectMessage }) =>
      updateSelectFieldControl(model, id, selectMessage, (message) =>
        Message.GotSelectFieldMessage({ id, message }),
      ),
  });
const updateComparison = (
  model: Model,
  message: CompareMessage,
  toRootMessage: (message: CompareMessage) => Message,
): UpdateReturn => {
  const comparisonUpdate = updateCompare(
    {
      codes: model.compareCodes,
      differencesOnly: model.compareDifferencesOnly,
    },
    message,
  );
  const nextModel = modifyFields(model, {
    compareCodes: () => comparisonUpdate.model.codes,
    compareDifferencesOnly: () => comparisonUpdate.model.differencesOnly,
  });
  const commands = Command.mapMessages(comparisonUpdate.commands, toRootMessage);
  return comparisonUpdate.outMessage === undefined
    ? { model: nextModel, commands }
    : {
        model: nextModel,
        commands: [...commands, Navigate({ href: currentUrl(nextModel, null), mode: 'push' })],
      };
};

export const initForHref = (
  href: string,
  fallbackLocale: Locale = 'en',
  sidebarCollapsed = false,
  themePreference: ThemePreference = defaultThemePreference,
  listDensity: ListDensity = 'card',
): UpdateReturn => {
  const location = parseLocation(href, fallbackLocale);
  const progressInit = initProgress();
  const base: Model = {
    localization: { locale: location.locale },
    norwegianMessages: NorwegianMessagesIdle(),
    route: location.route,
    progress: progressInit.model,
    schedule: initSchedule(
      location.scheduleWeek,
      location.scheduleCodes,
      location.scheduleHiddenActivityKeys,
    ),
    savedCourses: SavedCoursesResultSchema.SavedCoursesLoading(),
    noteDrafts: [],
    savedCoursesPersistFailed: false,
    compareCodes: location.compareCodes,
    compareDifferencesOnly: true,
    labelFilter: location.labelFilter,
    selectedCourseOrigins: [...courseOrigins],
    labelFilterModeRadioGroup: RadioGroup.init({ id: 'saved-label-filter-mode' }),
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
    labelDraftColorRadioGroup: RadioGroup.init({ id: 'saved-label-draft-color' }),
    labelEditing: null,
    labelPendingDelete: null,
    selectionRemovePending: false,
    labelError: null,
    listDensity,
    listDensityRadioGroup: RadioGroup.init({ id: 'saved-list-density' }),
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
    catalogue: CatalogueResult.CatalogueInitialLoading(),
    gradeSignals: GradeSignalsResult.GradeSignalsIdle(),
    decisionSignals: DecisionSignalsResult.DecisionSignalsIdle(),
    nextPage: NextPageState.NextPageIdle(),
    selectedCode: location.selectedCode,
    detail:
      location.selectedCode === null ? DetailResult.DetailClosed() : DetailResult.DetailLoading(),
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
  const localized = loadNorwegianMessages(base);
  const request = location.route === 'schedule' ? null : searchRequest(localized.model, 1);
  const key = request === null ? '' : requestKey(request);
  const model = modifyFields(localized.model, { activeRequestKey: () => key });
  return {
    model,
    commands: [
      ...(localized.commands ?? []),
      LoadSavedCourses(),
      ...Command.mapMessages(progressInit.commands, (message) =>
        Message.GotProgressMessage({ message }),
      ),
      ...(request === null ? [] : [fetchCommand(request, key, false)]),
      ...(request === null || location.selectedCode === null
        ? []
        : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
    ],
  };
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
  if (model.route === 'list') return translate(model.localization, 'app.listTitle');
  if (model.route === 'schedule') return translate(model.localization, 'app.scheduleTitle');
  if (model.route === 'progress') return translate(model.localization, 'app.progressTitle');
  return model.detail._tag === 'DetailSuccess' || model.detail._tag === 'DetailPartial'
    ? `${model.detail.response.item.code} · ${translate(model.localization, 'app.name')}`
    : translate(model.localization, 'app.catalogueTitle');
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: documentTitle(model),
  body: appView(model, h),
});

const norwegianMessagesFailureAlert = (model: Model, h: HtmlBuilder<Message>): Html =>
  model.localization.locale === 'nb' && model.norwegianMessages._tag === 'NorwegianMessagesFailed'
    ? h.p(
        [
          h.Class(
            'm-0 rounded-m3-medium border border-error bg-error-container px-4 py-3 text-sm font-bold text-on-error-container',
          ),
          h.Role('alert'),
        ],
        ['Norwegian translations could not be loaded. English is shown instead.'],
      )
    : h.empty;

const appView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('min-h-screen')],
    [
      lazyDesktopNavigation(desktopNavigation, [
        model.localization,
        model.sidebarCollapsed,
        model.route,
        exploreUrl(model),
        listUrl(model),
        scheduleUrl(model),
        progressUrl(model),
        appearanceUrl(model),
        Message.ToggledSidebar(),
        languageSelectControl(
          model.selectFields,
          'language-desktop',
          model.localization,
          model.sidebarCollapsed,
          h,
        ),
        h,
      ]),
      h.main(
        [h.Class(mainContentClass(model.sidebarCollapsed))],
        [
          h.div(
            [h.Class(mainColumnClass)],
            [
              savedCoursesPersistenceAlert(model, h),
              norwegianMessagesFailureAlert(model, h),
              model.route === 'appearance'
                ? h.submodel({
                    slotId: 'appearance-settings',
                    model: initAppearance(model.themePreference),
                    view: appearanceView,
                    viewInputs: {
                      locale: model.localization,
                      renderMobileLanguageControl: () =>
                        selectControl(
                          model.selectFields,
                          'language-mobile',
                          translate(model.localization, 'locale.label'),
                          model.localization.locale,
                          [
                            ['en', translate(model.localization, 'locale.en')],
                            ['nb', translate(model.localization, 'locale.nb')],
                          ],
                          {},
                          h,
                        ),
                      renderFooter: () => lazyProductFooter(productFooter, [model.localization, h]),
                    },
                    toParentMessage: (message) => Message.GotAppearanceMessage({ message }),
                  })
                : model.route === 'schedule'
                  ? h.submodel({
                      slotId: 'schedule',
                      model: model.schedule,
                      view: scheduleView,
                      viewInputs: {
                        locale: model.localization,
                        term: model.term,
                        savedCourses: scheduleSavedCourses(model.savedCourses),
                      },
                      toParentMessage: (message) => Message.GotScheduleMessage({ message }),
                    })
                  : model.route === 'progress'
                    ? h.submodel({
                        slotId: 'progress',
                        model: model.progress,
                        view: progressView,
                        viewInputs: {
                          locale: model.localization,
                          courseUrl: (courseCode) => normalizedUrl(model, courseCode, EXPLORE_PATH),
                        },
                        toParentMessage: (message) => Message.GotProgressMessage({ message }),
                      })
                    : model.route === 'list'
                      ? listView(model, h)
                      : model.selectedCode === null
                        ? catalogueView(model, h)
                        : selectedCourseView(model, h),
            ],
          ),
        ],
      ),
      lazyCatalogueRefineDialog(catalogueRefineDialogFromValues, [
        model.localization,
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
        h,
      ]),
      bottomStackView(model, selectedSavedCourses(model), h),
      model.route === 'list' ? labelDialogView(model, h) : h.empty,
      lazyMobileNavigation(mobileNavigation, [
        model.localization,
        model.route,
        exploreUrl(model),
        listUrl(model),
        scheduleUrl(model),
        progressUrl(model),
        appearanceUrl(model),
        h,
      ]),
    ],
  );

/** A failed write is never silent: the student is told the change was not kept. */

export const selectControl = (
  fields: Model['selectFields'],
  id: SelectControlId,
  label: string,
  value: string,
  options: ReadonlyArray<readonly [string, string, AppIcon?]>,
  config: Readonly<{ compact?: boolean; portal?: boolean }>,
  h: HtmlBuilder<Message>,
): Html =>
  selectField(
    {
      model: selectFieldModel(fields, id),
      label,
      value,
      options: options.map(([optionValue, optionLabel, optionIcon]): SelectOption => ({
        value: optionValue,
        label: optionLabel,
        ...(optionIcon === undefined ? {} : { icon: optionIcon }),
      })),
      ...(config.compact === undefined ? {} : { compact: config.compact }),
      ...(config.portal === undefined ? {} : { portal: config.portal }),
      toParentMessage: (message) => Message.GotSelectFieldMessage({ id, message }),
    },
    h,
  );

export const languageSelectControl = (
  fields: Model['selectFields'],
  id: 'language-desktop' | 'language-mobile',
  localization: Localization,
  compact: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  selectControl(
    fields,
    id,
    translate(localization, 'locale.label'),
    localization.locale,
    [
      ['en', compact ? 'EN' : translate(localization, 'locale.en')],
      ['nb', compact ? 'NO' : translate(localization, 'locale.nb')],
    ],
    { compact },
    h,
  );

export const checkboxControl = (
  id: string,
  label: string,
  isChecked: boolean,
  onToggle: (isChecked: boolean) => Message,
  h: HtmlBuilder<Message>,
): Html =>
  selectionChip(
    {
      id,
      label,
      isSelected: isChecked,
      onToggle,
    },
    h,
  );
/**
 * The one contextual feedback affordance for the decision screens. It follows
 * the VITE_TIP_URL pattern exactly: a static HTTPS link that exists only when
 * the operator configured a valid HTTPS URL, and opens in a new tab.
 */
export const feedbackRow = (locale: Localization, h: HtmlBuilder<Message>): Html => {
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

export const productFooter = (locale: Localization, h: HtmlBuilder<Message>): Html => {
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
