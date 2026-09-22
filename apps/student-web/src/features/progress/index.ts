import { Effect, Option, Schema as S } from 'effect';
import { Button, Checkbox, FileDrop, Input } from '@foldkit/ui';
import { Command, Update } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineTaggedUnion } from 'foldkit/schema';
import { defineView } from 'foldkit/submodel';
import { modifyFields } from 'foldkit/struct';

import {
  buttonPrimary,
  buttonSecondary,
  compactButtonBase,
  controlGroupClass,
  eyebrowClass,
  fieldLabelClass,
  loadingIndicatorClass,
  stateCardBase,
  stateCardFailure,
  stateCardFailurePClass,
  stateCardH2Class,
} from '../../app-styles';
import { localeTag, translate, type Locale, type Localization } from '../../i18n';
import {
  CourseDraftFieldsSchema,
  CourseResultSchema,
  ImportReceiptSchema,
  ProgressStateSchema,
  TranscriptProposalSchema,
  calculateProgress,
  courseAttemptKey,
  createProgressSession,
  cumulativeSemesterAverageSeries,
  defaultTranscriptVocabulary,
  decodeProgressBackup,
  decodeProgressState,
  dispatchProgressAction,
  emptyProgressState,
  encodeProgressBackup,
  exampleProgressState,
  gradeCreditDistribution,
  ntnuResultCourses,
  partitionAttempts,
  previewImportMerge,
  progressStorageKey,
  seekProgressSession,
  serializeProgressState,
  validateCourseDraft,
  validateTargetCreditsDraft,
  validateTranscriptVocabulary,
  type CourseResult,
  type Grade,
  type ProgressAction,
  type ProgressSession,
  type NtnuResultCourse,
  type ProgressState,
  type TranscriptVocabulary,
} from './domain';
import * as Editor from './editor';

const RetakePolicySchema = S.Literals(['latest', 'best']);
const DraftTextFieldSchema = S.Literals([
  'institution',
  'code',
  'name',
  'year',
  'term',
  'credits',
  'grade',
]);
type DraftTextField = typeof DraftTextFieldSchema.Type;
const VocabularyFieldSchema = S.Literals(['terms', 'grades', 'totals']);
type VocabularyField = typeof VocabularyFieldSchema.Type;

const ImportFailureReasonSchema = S.Literals([
  'non-file',
  'wrong-file-count',
  'unsupported-file',
  'preview-failed',
  'backup-failed',
]);

const LoadState = defineTaggedUnion({
  ProgressLoading: {},
  ProgressReady: {},
  ProgressRecovery: { reason: S.String },
  ProgressUnavailable: {},
});
type LoadState = typeof LoadState.Type;

const PersistenceState = defineTaggedUnion({
  PersistenceIdle: {},
  PersistenceSaving: { revision: S.Number },
  PersistenceFailed: { revision: S.Number },
});
type PersistenceState = typeof PersistenceState.Type;

const TimelineSnapshotSchema = S.Struct({
  results: S.Array(CourseResultSchema),
  importReceipts: S.Array(ImportReceiptSchema),
});
const TimelineEntrySchema = S.Struct({
  kind: S.Literals(['import', 'add', 'edit', 'remove', 'restore']),
  attemptKey: S.NullOr(S.String),
  importedResults: S.NullOr(S.Number),
  after: TimelineSnapshotSchema,
});
const ProgressSessionSchema = S.Struct({
  current: ProgressStateSchema,
  baseline: TimelineSnapshotSchema,
  timeline: S.Array(TimelineEntrySchema),
  cursor: S.Number,
});

const ImportDraftRowSchema = S.Struct({
  fields: CourseDraftFieldsSchema,
  selected: S.Boolean,
});
type ImportDraftRow = typeof ImportDraftRowSchema.Type;

const ImportState = defineTaggedUnion({
  ImportIdle: {},
  ImportOpening: { requestId: S.Number, fileName: S.String },
  ImportPreview: {
    requestId: S.Number,
    fileName: S.String,
    objectUrl: S.String,
    baseRevision: S.Number,
    error: S.String,
  },
  ImportParsing: {
    requestId: S.Number,
    fileName: S.String,
    objectUrl: S.String,
    baseRevision: S.Number,
  },
  ImportReview: {
    requestId: S.Number,
    fileName: S.String,
    objectUrl: S.String,
    baseRevision: S.Number,
    rows: S.Array(ImportDraftRowSchema),
    warnings: S.Array(S.String),
    statedCredits: S.NullOr(S.Number),
    editing: S.Boolean,
    showingSource: S.Boolean,
    dirty: S.Boolean,
    committing: S.Boolean,
    error: S.String,
  },
  ImportFailure: {
    reason: ImportFailureReasonSchema,
    fileName: S.NullOr(S.String),
  },
});
type ImportState = typeof ImportState.Type;
type ImportPreview = Extract<ImportState, { readonly _tag: 'ImportPreview' }>;
type ImportReview = Extract<ImportState, { readonly _tag: 'ImportReview' }>;

const ConfirmationSchema = S.Literals(['none', 'restore', 'clear', 'example']);

const reviewState = (
  reviewing: ImportReview,
  changes: Partial<Omit<ImportReview, '_tag'>>,
): ImportReview =>
  ImportState.ImportReview({
    requestId: changes.requestId ?? reviewing.requestId,
    fileName: changes.fileName ?? reviewing.fileName,
    objectUrl: changes.objectUrl ?? reviewing.objectUrl,
    baseRevision: changes.baseRevision ?? reviewing.baseRevision,
    rows: changes.rows ?? reviewing.rows,
    warnings: changes.warnings ?? reviewing.warnings,
    statedCredits:
      changes.statedCredits === undefined ? reviewing.statedCredits : changes.statedCredits,
    editing: changes.editing ?? reviewing.editing,
    showingSource: changes.showingSource ?? reviewing.showingSource,
    dirty: changes.dirty ?? reviewing.dirty,
    committing: changes.committing ?? reviewing.committing,
    error: changes.error ?? reviewing.error,
  });
const normalizedVocabularyLabels = (values: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase().replaceAll(/\s+/gu, ' ').trim();
    if (key.length === 0 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mappedVocabularyLines = (
  text: string,
  kind: 'term' | 'grade',
): ReadonlyArray<readonly [string, string | number]> => {
  if (text.trim().length === 0) return [];
  return text.split(/\r?\n/u).map((rawLine) => {
    const line = rawLine.trim();
    const separator = line.lastIndexOf('=');
    if (separator <= 0 || separator === line.length - 1) {
      throw new Error(`Each ${kind} label must use “label=value” on its own line.`);
    }
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (kind === 'term') {
      if (value !== '1' && value !== '2') {
        throw new Error('Term label values must be 1 or 2.');
      }
      return [label, Number(value)] as const;
    }
    if (
      value !== 'A' &&
      value !== 'B' &&
      value !== 'C' &&
      value !== 'D' &&
      value !== 'E' &&
      value !== 'F' &&
      value !== 'pass' &&
      value !== 'fail' &&
      value !== 'recognized'
    ) {
      throw new Error('Grade label values must be A–F, pass, fail, or recognized.');
    }
    return [label, value] as const;
  });
};

const transcriptVocabulary = (
  termsText: string,
  gradesText: string,
  totalsText: string,
): TranscriptVocabulary => {
  const terms = Object.fromEntries([
    ...Object.entries(defaultTranscriptVocabulary.terms),
    ...mappedVocabularyLines(termsText, 'term'),
  ]);
  const grades = Object.fromEntries([
    ...Object.entries(defaultTranscriptVocabulary.grades),
    ...mappedVocabularyLines(gradesText, 'grade'),
  ]);
  const totalLabels = normalizedVocabularyLabels([
    ...defaultTranscriptVocabulary.totalLabels,
    ...totalsText.split(/\r?\n/u).map((label) => label.trim()),
  ]);
  return validateTranscriptVocabulary({ terms, grades, totalLabels });
};

/**
 * Durable state is browser-local. Files and PDF bytes remain inside Commands;
 * the model holds only an explicitly releasable Blob URL during one import.
 */
export const Model = S.Struct({
  loadState: LoadState,
  session: ProgressSessionSchema,
  persistence: PersistenceState,
  persistenceRevision: S.Number,
  fileDrop: FileDrop.Model,
  importState: ImportState,
  nextRequest: S.Number,
  editor: S.NullOr(Editor.Model),
  editorError: S.String,
  search: S.String,
  targetDraft: S.String,
  previousOpen: S.Boolean,
  sessionHistoryOpen: S.Boolean,
  confirmation: ConfirmationSchema,
  backupCandidate: S.NullOr(ProgressStateSchema),
  status: S.String,
  vocabularyTerms: S.String,
  vocabularyGrades: S.String,
  vocabularyTotals: S.String,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  LoadedProgress: { raw: S.NullOr(S.String) },
  FailedProgressLoad: {},
  GotFileDropMessage: { message: FileDrop.Message },
  OpenedTranscriptPreview: {
    requestId: S.Number,
    fileName: S.String,
    objectUrl: S.String,
  },
  FailedTranscriptPreview: { requestId: S.Number, fileName: S.String },
  RequestedTranscriptParse: {},
  ParsedTranscript: {
    requestId: S.Number,
    fileName: S.String,
    proposal: TranscriptProposalSchema,
  },
  FailedTranscriptParse: { requestId: S.Number, fileName: S.String },
  ReleasedTranscriptPreview: { objectUrl: S.String },
  CancelledImport: {},
  ToggledImportSource: {},
  ToggledImportEditing: {},
  ChangedImportField: { index: S.Number, field: DraftTextFieldSchema, value: S.String },
  ToggledImportResult: { index: S.Number, included: S.Boolean },
  IncludedAllImportResults: {},
  ChangedVocabulary: { field: VocabularyFieldSchema, value: S.String },
  ClearedImportResults: {},
  RequestedApproveImport: {},
  StampedImport: {
    requestId: S.Number,
    baseRevision: S.Number,
    results: S.Array(CourseResultSchema),
    at: S.String,
  },
  RestoredBackupCandidate: { requestId: S.Number, state: ProgressStateSchema },
  FailedBackupCandidate: { requestId: S.Number, fileName: S.String },
  RequestedAddCourse: {},
  RequestedEditCourse: { attemptKey: S.String },
  GotCourseEditorMessage: { message: Editor.Message },
  ChangedSearch: { value: S.String },
  ChangedTargetDraft: { value: S.String },
  RequestedApplyTarget: {},
  ChangedIncludeF: { includeF: S.Boolean },
  ChangedRetakePolicy: { retakes: RetakePolicySchema },
  ToggledCommittedResult: { attemptKey: S.String, included: S.Boolean },
  RequestedUndo: {},
  RequestedRedo: {},
  RequestedSeek: { cursor: S.Number },
  ToggledPreviousResults: { isOpen: S.Boolean },
  ToggledSessionHistory: { isOpen: S.Boolean },
  RequestedDownloadBackup: {},
  DownloadedBackup: {},
  FailedBackupDownload: {},
  RequestedClearProgress: {},
  RequestedExampleProgress: {},
  RequestedRecoveryReset: {},
  CancelledConfirmation: {},
  ConfirmedAction: {},
  RequestedRetryPersistence: {},
  PersistedProgress: { revision: S.Number },
  FailedProgressPersistence: { revision: S.Number },
});
export type Message = typeof Message.Type;

type UpdateReturn = Update.Return<Model, Message>;
type Commands = Update.Commands<Message>;
type PersistReturn = Readonly<{ model: Model; commands: Commands }>;

export const LoadProgress = Command.define('LoadProgress', {
  messages: [Message.LoadedProgress, Message.FailedProgressLoad],
  execute: Effect.try({
    try: () => Message.LoadedProgress({ raw: localStorage.getItem(progressStorageKey) }),
    catch: () => undefined,
  }).pipe(Effect.catch(() => Effect.succeed(Message.FailedProgressLoad()))),
});

export const PersistProgress = Command.define('PersistProgress', {
  args: { state: ProgressStateSchema, revision: S.Number },
  messages: [Message.PersistedProgress, Message.FailedProgressPersistence],
  execute: ({ state, revision }) =>
    Effect.try({
      try: () => localStorage.setItem(progressStorageKey, serializeProgressState(state)),
      catch: () => undefined,
    }).pipe(
      Effect.as(Message.PersistedProgress({ revision })),
      Effect.catch(() => Effect.succeed(Message.FailedProgressPersistence({ revision }))),
    ),
});

/**
 * A static PDF import would retain the parser in the initial app chunk. Each
 * command imports the complete browser-only adapter at the boundary instead.
 */
const OpenTranscriptPreview = Command.define('OpenTranscriptPreview', {
  args: { file: S.File, requestId: S.Number },
  messages: [Message.OpenedTranscriptPreview, Message.FailedTranscriptPreview],
  execute: ({ file, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        const { openTranscriptPreview } = await import('./pdf');
        return openTranscriptPreview(file);
      },
      catch: () => undefined,
    }).pipe(
      Effect.map(({ fileName, objectUrl }) =>
        Message.OpenedTranscriptPreview({ requestId, fileName, objectUrl }),
      ),
      Effect.catch(() =>
        Effect.succeed(Message.FailedTranscriptPreview({ requestId, fileName: file.name })),
      ),
    ),
});

const ParseTranscriptPreview = Command.define('ParseTranscriptPreview', {
  args: {
    objectUrl: S.String,
    fileName: S.String,
    requestId: S.Number,
    vocabulary: S.Unknown,
  },
  messages: [Message.ParsedTranscript, Message.FailedTranscriptParse],
  execute: ({ objectUrl, fileName, requestId, vocabulary }) =>
    Effect.tryPromise({
      try: async (signal) => {
        const { parseTranscriptPreview } = await import('./pdf');
        return parseTranscriptPreview(objectUrl, signal, validateTranscriptVocabulary(vocabulary));
      },
      catch: () => undefined,
    }).pipe(
      Effect.map((proposal) => Message.ParsedTranscript({ requestId, fileName, proposal })),
      Effect.catch(() => Effect.succeed(Message.FailedTranscriptParse({ requestId, fileName }))),
    ),
});

const ReleaseTranscriptPreview = Command.define('ReleaseTranscriptPreview', {
  args: { objectUrl: S.String },
  messages: [Message.ReleasedTranscriptPreview],
  execute: ({ objectUrl }) =>
    Effect.tryPromise({
      try: async () => {
        const { releaseTranscriptPreview } = await import('./pdf');
        releaseTranscriptPreview(objectUrl);
      },
      catch: () => new Error('Transcript preview could not be released'),
    }).pipe(
      Effect.catch(() =>
        Effect.sync(() => {
          if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(objectUrl);
          }
        }),
      ),
      Effect.as(Message.ReleasedTranscriptPreview({ objectUrl })),
    ),
});

const ReadProgressBackup = Command.define('ReadProgressBackup', {
  args: { file: S.File, requestId: S.Number },
  messages: [Message.RestoredBackupCandidate, Message.FailedBackupCandidate],
  execute: ({ file, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        if (file.size > 2_000_000) throw new Error('Backup is too large.');
        const decoded = decodeProgressBackup(await file.text());
        if (!decoded.ok) throw new Error(decoded.reason);
        return decoded.state;
      },
      catch: () => undefined,
    }).pipe(
      Effect.map((state) => Message.RestoredBackupCandidate({ requestId, state })),
      Effect.catch(() =>
        Effect.succeed(Message.FailedBackupCandidate({ requestId, fileName: file.name })),
      ),
    ),
});

const StampProgressImport = Command.define('StampProgressImport', {
  args: {
    requestId: S.Number,
    baseRevision: S.Number,
    results: S.Array(CourseResultSchema),
  },
  messages: [Message.StampedImport],
  execute: ({ requestId, baseRevision, results }) =>
    Effect.sync(() =>
      Message.StampedImport({
        requestId,
        baseRevision,
        results,
        at: new Date().toISOString().slice(0, 10),
      }),
    ),
});

const DownloadProgressBackup = Command.define('DownloadProgressBackup', {
  args: { state: ProgressStateSchema },
  messages: [Message.DownloadedBackup, Message.FailedBackupDownload],
  execute: ({ state }) =>
    Effect.try({
      try: () => {
        const blob = new Blob([encodeProgressBackup(state)], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `course-lens-progress-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      },
      catch: () => undefined,
    }).pipe(
      Effect.as(Message.DownloadedBackup()),
      Effect.catch(() => Effect.succeed(Message.FailedBackupDownload())),
    ),
});

const isReady = (model: Model): boolean => model.loadState._tag === 'ProgressReady';
export const progressResultCourses = (model: Model): ReadonlyArray<NtnuResultCourse> =>
  isReady(model) ? ntnuResultCourses(model.session.current.results) : [];
const isValidIndex = (index: number, length: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < length;

const previewUrl = (state: ImportState): string | null => {
  switch (state._tag) {
    case 'ImportPreview':
    case 'ImportParsing':
    case 'ImportReview':
      return state.objectUrl;
    default:
      return null;
  }
};

const releasePreviewCommands = (state: ImportState): Commands => {
  const objectUrl = previewUrl(state);
  return objectUrl === null ? [] : [ReleaseTranscriptPreview({ objectUrl })];
};

const fileDropIsVisible = (model: Model): boolean =>
  isReady(model) &&
  model.editor === null &&
  model.confirmation === 'none' &&
  (model.importState._tag === 'ImportIdle' || model.importState._tag === 'ImportFailure');

const toImportFailure = (
  model: Model,
  reason: typeof ImportFailureReasonSchema.Type,
  fileName: string | null,
): UpdateReturn => ({
  model: modifyFields(model, {
    importState: () => ImportState.ImportFailure({ reason, fileName }),
  }),
});

const beginSelectedFile = (model: Model, files: ReadonlyArray<File>): UpdateReturn => {
  if (!fileDropIsVisible(model)) return { model };
  if (files.length !== 1) return toImportFailure(model, 'wrong-file-count', null);
  const file = files[0];
  if (file === undefined) return { model };

  const requestId = model.nextRequest + 1;
  const lowerName = file.name.toLowerCase();
  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return {
      model: modifyFields(model, {
        importState: () => ImportState.ImportOpening({ requestId, fileName: file.name }),
        nextRequest: () => requestId,
        status: () => '',
      }),
      commands: [OpenTranscriptPreview({ file, requestId })],
    };
  }
  if (file.type === 'application/json' || lowerName.endsWith('.json')) {
    return {
      model: modifyFields(model, {
        importState: () => ImportState.ImportOpening({ requestId, fileName: file.name }),
        nextRequest: () => requestId,
        status: () => '',
      }),
      commands: [ReadProgressBackup({ file, requestId })],
    };
  }
  return toImportFailure(model, 'unsupported-file', file.name);
};

const persistSession = (model: Model, session: ProgressSession): PersistReturn => {
  const revision = model.persistenceRevision + 1;
  return {
    model: modifyFields(model, {
      session: () => session,
      targetDraft: () => String(session.current.targetCredits),
      persistence: () => PersistenceState.PersistenceSaving({ revision }),
      persistenceRevision: () => revision,
    }),
    commands: [PersistProgress({ state: session.current, revision })],
  };
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'The requested progress change could not be applied.';

const applyAction = (model: Model, action: ProgressAction): PersistReturn => {
  try {
    return persistSession(model, dispatchProgressAction(model.session, action));
  } catch (error) {
    return {
      model: modifyFields(model, { status: () => errorMessage(error) }),
      commands: [],
    };
  }
};

const selectedDraftResults = (
  reviewing: ImportReview,
): Readonly<
  { readonly ok: true; readonly results: ReadonlyArray<CourseResult> } | { readonly ok: false }
> => {
  const results: Array<CourseResult> = [];
  for (const row of reviewing.rows) {
    if (!row.selected) continue;
    const validated = validateCourseDraft(row.fields);
    if (!validated.ok) return { ok: false };
    results.push(validated.result);
  }
  return { ok: true, results };
};

const updateFileDrop = Update.foldChild({
  update: FileDrop.update,
  read: (model: Model) => Option.some(model.fileDrop),
  write: (model, fileDrop) => modifyFields(model, { fileDrop: () => fileDrop }),
  toParentMessage: (message) => Message.GotFileDropMessage({ message }),
  foldOutMessage: (outMessage) =>
    FileDrop.OutMessage.match<Update.Step<Model, Message>, typeof outMessage>(outMessage, {
      ReceivedFiles:
        ({ files }) =>
        (model) =>
          beginSelectedFile(model, files),
      RejectedNonFiles: () => (model) =>
        fileDropIsVisible(model) ? toImportFailure(model, 'non-file', null) : { model },
    }),
});

const foldEditor = (model: Model, editorMessage: Editor.Message): UpdateReturn => {
  if (model.editor === null) return { model };
  const result = Editor.update(model.editor, editorMessage);
  const commands = Command.mapMessages(result.commands, (message) =>
    Message.GotCourseEditorMessage({ message }),
  );
  const nextModel: Model = modifyFields(model, {
    editor: () => result.model,
    editorError: () => '',
  });
  const outcome = result.outMessage;
  if (outcome === undefined) return { model: nextModel, commands };
  if (outcome._tag === 'Close') {
    return {
      model: modifyFields(nextModel, { editor: () => null, editorError: () => '' }),
      commands,
    };
  }
  if (outcome.baseRevision !== model.persistenceRevision) {
    return {
      model: modifyFields(nextModel, { editorError: () => 'stale' }),
      commands,
    };
  }

  const action: ProgressAction =
    outcome._tag === 'Remove'
      ? { _tag: 'Remove', attemptKey: outcome.attemptKey }
      : outcome.originalAttemptKey === null
        ? { _tag: 'Add', result: outcome.result }
        : {
            _tag: 'Edit',
            attemptKey: outcome.originalAttemptKey,
            result: outcome.result,
          };
  const applied = applyAction(nextModel, action);
  return {
    model:
      applied.model.status.length > 0
        ? applied.model
        : modifyFields(applied.model, {
            editor: () => null,
            editorError: () => '',
            status: () => 'course-saved',
          }),
    commands: [...commands, ...applied.commands],
  };
};

export const init = (): Update.Return<Model, Message> => {
  const session = createProgressSession();
  return {
    model: {
      loadState: LoadState.ProgressLoading(),
      session,
      persistence: PersistenceState.PersistenceIdle(),
      persistenceRevision: 0,
      fileDrop: FileDrop.init({ id: 'progress-import-file' }),
      importState: ImportState.ImportIdle(),
      nextRequest: 0,
      editor: null,
      editorError: '',
      search: '',
      targetDraft: String(session.current.targetCredits),
      previousOpen: false,
      sessionHistoryOpen: false,
      confirmation: 'none',
      backupCandidate: null,
      status: '',
      vocabularyTerms: '',
      vocabularyGrades: '',
      vocabularyTotals: '',
    },
    commands: [LoadProgress()],
  };
};

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    LoadedProgress: ({ raw }) => {
      if (model.loadState._tag !== 'ProgressLoading') return { model };
      const decoded = decodeProgressState(raw);
      if (!decoded.ok) {
        return {
          model: modifyFields(model, {
            loadState: () => LoadState.ProgressRecovery({ reason: decoded.reason }),
          }),
        };
      }
      const session = createProgressSession(decoded.state);
      return {
        model: modifyFields(model, {
          loadState: () => LoadState.ProgressReady(),
          session: () => session,
          targetDraft: () => String(session.current.targetCredits),
        }),
      };
    },
    FailedProgressLoad: () =>
      model.loadState._tag !== 'ProgressLoading'
        ? { model }
        : {
            model: modifyFields(model, {
              loadState: () => LoadState.ProgressUnavailable(),
            }),
          },
    GotFileDropMessage: ({ message: fileDropMessage }) =>
      fileDropIsVisible(model) ? updateFileDrop(model, fileDropMessage) : { model },
    OpenedTranscriptPreview: ({ requestId, fileName, objectUrl }) => {
      const opening = model.importState;
      if (
        !isReady(model) ||
        opening._tag !== 'ImportOpening' ||
        opening.requestId !== requestId ||
        opening.fileName !== fileName
      ) {
        return { model, commands: [ReleaseTranscriptPreview({ objectUrl })] };
      }
      return {
        model: modifyFields(model, {
          importState: () =>
            ImportState.ImportPreview({
              requestId,
              fileName,
              objectUrl,
              baseRevision: model.persistenceRevision,
              error: '',
            }),
        }),
      };
    },
    FailedTranscriptPreview: ({ requestId, fileName }) => {
      const opening = model.importState;
      return opening._tag === 'ImportOpening' &&
        opening.requestId === requestId &&
        opening.fileName === fileName
        ? toImportFailure(model, 'preview-failed', fileName)
        : { model };
    },
    ChangedVocabulary: ({ field, value }) => {
      if (!isReady(model) || model.importState._tag === 'ImportParsing') return { model };
      const changes =
        field === 'terms'
          ? { vocabularyTerms: () => value }
          : field === 'grades'
            ? { vocabularyGrades: () => value }
            : { vocabularyTotals: () => value };
      return { model: modifyFields(model, changes) };
    },
    RequestedTranscriptParse: () => {
      const previewing = model.importState;
      if (!isReady(model) || previewing._tag !== 'ImportPreview') return { model };
      let vocabulary: TranscriptVocabulary;
      try {
        vocabulary = transcriptVocabulary(
          model.vocabularyTerms,
          model.vocabularyGrades,
          model.vocabularyTotals,
        );
      } catch {
        return {
          model: modifyFields(model, {
            importState: () =>
              ImportState.ImportPreview({
                ...previewing,
                error: 'vocabulary-invalid',
              }),
          }),
        };
      }
      return {
        model: modifyFields(model, {
          importState: () =>
            ImportState.ImportParsing({
              requestId: previewing.requestId,
              fileName: previewing.fileName,
              objectUrl: previewing.objectUrl,
              baseRevision: previewing.baseRevision,
            }),
        }),
        commands: [
          ParseTranscriptPreview({
            objectUrl: previewing.objectUrl,
            fileName: previewing.fileName,
            requestId: previewing.requestId,
            vocabulary,
          }),
        ],
      };
    },
    ParsedTranscript: ({ requestId, fileName, proposal }) => {
      const parsing = model.importState;
      if (
        !isReady(model) ||
        parsing._tag !== 'ImportParsing' ||
        parsing.requestId !== requestId ||
        parsing.fileName !== fileName
      ) {
        return { model };
      }
      return {
        model: modifyFields(model, {
          importState: () =>
            ImportState.ImportReview({
              requestId,
              fileName,
              objectUrl: parsing.objectUrl,
              baseRevision: parsing.baseRevision,
              rows: proposal.results.map((result) => ({
                fields: {
                  institution: result.institution,
                  code: result.code,
                  name: result.name,
                  year: String(result.year),
                  term: String(result.term),
                  credits: String(result.credits),
                  grade: result.grade,
                  included: result.included,
                },
                selected: true,
              })),
              warnings: proposal.warnings,
              statedCredits: proposal.statedCredits,
              editing: false,
              showingSource: false,
              dirty: false,
              committing: false,
              error: '',
            }),
        }),
      };
    },
    FailedTranscriptParse: ({ requestId, fileName }) => {
      const parsing = model.importState;
      if (
        !isReady(model) ||
        parsing._tag !== 'ImportParsing' ||
        parsing.requestId !== requestId ||
        parsing.fileName !== fileName
      ) {
        return { model };
      }
      return {
        model: modifyFields(model, {
          importState: () =>
            ImportState.ImportPreview({
              requestId,
              fileName,
              objectUrl: parsing.objectUrl,
              baseRevision: parsing.baseRevision,
              error: 'parse-failed',
            }),
        }),
      };
    },
    ReleasedTranscriptPreview: () => ({ model }),
    CancelledImport: () => {
      const commands = releasePreviewCommands(model.importState);
      return {
        model: modifyFields(model, { importState: () => ImportState.ImportIdle() }),
        commands,
      };
    },
    ToggledImportSource: () => {
      const reviewing = model.importState;
      return reviewing._tag !== 'ImportReview' || reviewing.committing
        ? { model }
        : {
            model: modifyFields(model, {
              importState: () =>
                reviewState(reviewing, { showingSource: !reviewing.showingSource }),
            }),
          };
    },
    ToggledImportEditing: () => {
      const reviewing = model.importState;
      return reviewing._tag !== 'ImportReview' || reviewing.committing
        ? { model }
        : {
            model: modifyFields(model, {
              importState: () => reviewState(reviewing, { editing: !reviewing.editing }),
            }),
          };
    },
    ChangedImportField: ({ index, field, value }) => {
      const reviewing = model.importState;
      if (
        reviewing._tag !== 'ImportReview' ||
        reviewing.committing ||
        !reviewing.editing ||
        !isValidIndex(index, reviewing.rows.length)
      ) {
        return { model };
      }
      return {
        model: modifyFields(model, {
          importState: () =>
            reviewState(reviewing, {
              rows: reviewing.rows.map((row, rowIndex) =>
                rowIndex === index ? { ...row, fields: { ...row.fields, [field]: value } } : row,
              ),
              dirty: true,
              error: '',
            }),
        }),
      };
    },
    ToggledImportResult: ({ index, included }) => {
      const reviewing = model.importState;
      if (
        reviewing._tag !== 'ImportReview' ||
        reviewing.committing ||
        !isValidIndex(index, reviewing.rows.length)
      ) {
        return { model };
      }
      const row = reviewing.rows[index];
      if (row === undefined || row.selected === included) return { model };
      return {
        model: modifyFields(model, {
          importState: () =>
            reviewState(reviewing, {
              rows: reviewing.rows.map((candidate, rowIndex) =>
                rowIndex === index ? { ...candidate, selected: included } : candidate,
              ),
              dirty: true,
              error: '',
            }),
        }),
      };
    },
    IncludedAllImportResults: () => {
      const reviewing = model.importState;
      return reviewing._tag !== 'ImportReview' || reviewing.committing
        ? { model }
        : {
            model: modifyFields(model, {
              importState: () =>
                reviewState(reviewing, {
                  rows: reviewing.rows.map((row) => ({ ...row, selected: true })),
                  dirty: true,
                  error: '',
                }),
            }),
          };
    },
    ClearedImportResults: () => {
      const reviewing = model.importState;
      return reviewing._tag !== 'ImportReview' || reviewing.committing
        ? { model }
        : {
            model: modifyFields(model, {
              importState: () =>
                reviewState(reviewing, {
                  rows: reviewing.rows.map((row) => ({ ...row, selected: false })),
                  dirty: true,
                  error: '',
                }),
            }),
          };
    },
    RequestedApproveImport: () => {
      const reviewing = model.importState;
      if (reviewing._tag !== 'ImportReview' || reviewing.committing) return { model };
      const selected = selectedDraftResults(reviewing);
      if (!selected.ok || selected.results.length === 0) {
        return {
          model: modifyFields(model, {
            importState: () => reviewState(reviewing, { error: 'invalid-draft' }),
          }),
        };
      }
      try {
        previewImportMerge(model.session.current.results, selected.results);
      } catch (error) {
        return {
          model: modifyFields(model, {
            importState: () => reviewState(reviewing, { error: errorMessage(error) }),
          }),
        };
      }
      return {
        model: modifyFields(model, {
          importState: () => reviewState(reviewing, { committing: true, error: '' }),
        }),
        commands: [
          StampProgressImport({
            requestId: reviewing.requestId,
            baseRevision: reviewing.baseRevision,
            results: [...selected.results],
          }),
        ],
      };
    },
    StampedImport: ({ requestId, baseRevision, results, at }) => {
      const reviewing = model.importState;
      if (reviewing._tag !== 'ImportReview' || reviewing.requestId !== requestId) {
        return { model };
      }
      if (baseRevision !== model.persistenceRevision) {
        return {
          model: modifyFields(model, {
            importState: () => reviewState(reviewing, { committing: false, error: 'stale' }),
          }),
        };
      }
      const applied = applyAction(model, { _tag: 'Import', results, at });
      if (applied.model.status.length > 0) {
        return {
          model: modifyFields(applied.model, {
            importState: () => reviewState(reviewing, { committing: false }),
          }),
          commands: applied.commands,
        };
      }
      return {
        model: modifyFields(applied.model, {
          importState: () => ImportState.ImportIdle(),
          status: () => 'import-saved',
        }),
        commands: [
          ...applied.commands,
          ReleaseTranscriptPreview({ objectUrl: reviewing.objectUrl }),
        ],
      };
    },
    RestoredBackupCandidate: ({ requestId, state }) => {
      const opening = model.importState;
      if (opening._tag !== 'ImportOpening' || opening.requestId !== requestId) return { model };
      return {
        model: modifyFields(model, {
          importState: () => ImportState.ImportIdle(),
          backupCandidate: () => state,
          confirmation: () => 'restore',
        }),
      };
    },
    FailedBackupCandidate: ({ requestId, fileName }) => {
      const opening = model.importState;
      return opening._tag === 'ImportOpening' && opening.requestId === requestId
        ? toImportFailure(model, 'backup-failed', fileName)
        : { model };
    },
    RequestedAddCourse: () =>
      !isReady(model) || model.editor !== null || model.confirmation !== 'none'
        ? { model }
        : {
            model: modifyFields(model, {
              editor: () => Editor.init(null, model.persistenceRevision),
              editorError: () => '',
              status: () => '',
            }),
          },
    RequestedEditCourse: ({ attemptKey }) => {
      if (!isReady(model) || model.editor !== null || model.confirmation !== 'none') {
        return { model };
      }
      const result = model.session.current.results.find(
        (candidate) => courseAttemptKey(candidate) === attemptKey,
      );
      return result === undefined
        ? { model }
        : {
            model: modifyFields(model, {
              editor: () => Editor.init(result, model.persistenceRevision),
              editorError: () => '',
              status: () => '',
            }),
          };
    },
    GotCourseEditorMessage: ({ message: editorMessage }) => foldEditor(model, editorMessage),
    ChangedSearch: ({ value }) => ({
      model: modifyFields(model, { search: () => value }),
    }),
    ChangedTargetDraft: ({ value }) => ({
      model: modifyFields(model, { targetDraft: () => value, status: () => '' }),
    }),
    RequestedApplyTarget: () => {
      const validated = validateTargetCreditsDraft(model.targetDraft);
      return validated.ok
        ? applyAction(model, {
            _tag: 'SetTargetCredits',
            targetCredits: validated.targetCredits,
          })
        : {
            model: modifyFields(model, { status: () => validated.error }),
          };
    },
    ChangedIncludeF: ({ includeF }) =>
      model.session.current.policy.includeF === includeF
        ? { model }
        : applyAction(model, {
            _tag: 'SetPolicy',
            policy: { ...model.session.current.policy, includeF },
          }),
    ChangedRetakePolicy: ({ retakes }) =>
      model.session.current.policy.retakes === retakes
        ? { model }
        : applyAction(model, {
            _tag: 'SetPolicy',
            policy: { ...model.session.current.policy, retakes },
          }),
    ToggledCommittedResult: ({ attemptKey, included }) =>
      applyAction(model, { _tag: 'SetIncluded', attemptKey, included }),
    RequestedUndo: () => {
      const next = seekProgressSession(model.session, model.session.cursor - 1);
      return next.cursor === model.session.cursor ? { model } : persistSession(model, next);
    },
    RequestedRedo: () => {
      const next = seekProgressSession(model.session, model.session.cursor + 1);
      return next.cursor === model.session.cursor ? { model } : persistSession(model, next);
    },
    RequestedSeek: ({ cursor }) => {
      const next = seekProgressSession(model.session, cursor);
      return next.cursor === model.session.cursor ? { model } : persistSession(model, next);
    },
    ToggledPreviousResults: ({ isOpen }) => ({
      model: modifyFields(model, { previousOpen: () => isOpen }),
    }),
    ToggledSessionHistory: ({ isOpen }) => ({
      model: modifyFields(model, { sessionHistoryOpen: () => isOpen }),
    }),
    RequestedDownloadBackup: () => ({
      model,
      commands: [DownloadProgressBackup({ state: model.session.current })],
    }),
    DownloadedBackup: () => ({
      model: modifyFields(model, { status: () => 'backup-downloaded' }),
    }),
    FailedBackupDownload: () => ({
      model: modifyFields(model, { status: () => 'backup-failed' }),
    }),
    RequestedClearProgress: () => ({
      model: modifyFields(model, { confirmation: () => 'clear' }),
    }),
    RequestedExampleProgress: () => ({
      model: modifyFields(model, { confirmation: () => 'example' }),
    }),
    CancelledConfirmation: () => ({
      model: modifyFields(model, {
        confirmation: () => 'none',
        backupCandidate: () => null,
      }),
    }),
    ConfirmedAction: () => {
      if (model.confirmation === 'restore' && model.backupCandidate !== null) {
        const applied = applyAction(model, {
          _tag: 'RestoreBackup',
          state: model.backupCandidate,
        });
        return {
          model: modifyFields(applied.model, {
            confirmation: () => 'none',
            backupCandidate: () => null,
            status: () => 'backup-restored',
          }),
          commands: applied.commands,
        };
      }
      if (model.confirmation === 'example') {
        const applied = applyAction(model, {
          _tag: 'RestoreBackup',
          state: exampleProgressState,
        });
        return {
          model: modifyFields(applied.model, {
            confirmation: () => 'none',
            status: () => '',
          }),
          commands: applied.commands,
        };
      }
      if (model.confirmation === 'clear') {
        const cleared = persistSession(model, createProgressSession(emptyProgressState));
        return {
          model: modifyFields(cleared.model, {
            confirmation: () => 'none',
            backupCandidate: () => null,
            editor: () => null,
            importState: () => ImportState.ImportIdle(),
            status: () => 'cleared',
          }),
          commands: [...releasePreviewCommands(model.importState), ...cleared.commands],
        };
      }
      return { model };
    },
    RequestedRecoveryReset: () => {
      if (
        model.loadState._tag !== 'ProgressRecovery' &&
        model.loadState._tag !== 'ProgressUnavailable'
      ) {
        return { model };
      }
      const session = createProgressSession(emptyProgressState);
      const revision = model.persistenceRevision + 1;
      return {
        model: modifyFields(model, {
          loadState: () => LoadState.ProgressReady(),
          session: () => session,
          targetDraft: () => String(session.current.targetCredits),
          persistence: () => PersistenceState.PersistenceSaving({ revision }),
          persistenceRevision: () => revision,
        }),
        commands: [PersistProgress({ state: session.current, revision })],
      };
    },
    RequestedRetryPersistence: () => {
      if (model.persistence._tag !== 'PersistenceFailed') return { model };
      const revision = model.persistence.revision;
      return {
        model: modifyFields(model, {
          persistence: () => PersistenceState.PersistenceSaving({ revision }),
        }),
        commands: [PersistProgress({ state: model.session.current, revision })],
      };
    },
    PersistedProgress: ({ revision }) =>
      model.persistence._tag !== 'PersistenceSaving' || model.persistence.revision !== revision
        ? { model }
        : {
            model: modifyFields(model, {
              persistence: () => PersistenceState.PersistenceIdle(),
            }),
          },
    FailedProgressPersistence: ({ revision }) =>
      model.persistence._tag !== 'PersistenceSaving' || model.persistence.revision !== revision
        ? { model }
        : {
            model: modifyFields(model, {
              persistence: () => PersistenceState.PersistenceFailed({ revision }),
            }),
          },
  });

const panelClass =
  'grid gap-4 rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(1rem,3vw,1.5rem)] shadow-m3-1';
const compactActionClass = `${compactButtonBase} inline-flex min-h-11 items-center justify-center rounded-[1.5rem] border border-outline bg-surface-container px-3 text-sm font-bold text-primary`;
const selectionControlClass =
  'inline-flex min-h-11 cursor-pointer items-center gap-[0.55rem] rounded-[1.5rem] border border-outline px-3 text-sm font-bold text-on-surface-variant focus-within:outline-3 focus-within:outline-tertiary focus-within:outline-offset-[3px] has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-container has-[[data-checked]]:text-on-primary-container';
const selectionBoxClass =
  'grid size-[1.15rem] place-items-center rounded-[0.3rem] border-2 border-current text-xs leading-none';
const resultCardClass =
  '@container grid gap-3 rounded-m3-large border border-outline-variant bg-surface-container p-4 [@media(min-width:42rem)]:grid-cols-[minmax(0,1fr)_auto] [@media(min-width:42rem)]:items-start';

const numberFormatters: Readonly<Record<Locale, Intl.NumberFormat>> = {
  en: new Intl.NumberFormat(localeTag('en'), { maximumFractionDigits: 2 }),
  nb: new Intl.NumberFormat(localeTag('nb'), { maximumFractionDigits: 2 }),
};

const formatNumber = (value: number, locale: Localization): string =>
  numberFormatters[locale.locale].format(value);

const formatCredits = (credits: number, locale: Localization): string =>
  formatNumber(credits, locale);

const gradeLabel = (grade: Grade, locale: Localization): string => {
  switch (grade) {
    case 'pass':
      return translate(locale, 'progress.gradePass');
    case 'fail':
      return translate(locale, 'progress.gradeFail');
    case 'recognized':
      return translate(locale, 'progress.gradeRecognized');
    default:
      return grade;
  }
};

const resultTitleId = (scope: 'history' | 'review', index: number): string =>
  `progress-${scope}-result-${index}-title`;

const resultFacts = (result: CourseResult, locale: Localization, h: HtmlBuilder<Message>): Html =>
  h.dl(
    [h.Class('grid grid-cols-2 gap-x-4 gap-y-3 m-0 @min-[28rem]:grid-cols-4')],
    [
      h.div(
        [],
        [
          h.dt(
            [h.Class('text-xs font-extrabold tracking-[0.05em] uppercase text-on-surface-variant')],
            [translate(locale, 'progress.resultCourse')],
          ),
          h.dd([h.Class('m-0 mt-1 text-sm font-bold')], [result.code]),
        ],
      ),
      h.div(
        [],
        [
          h.dt(
            [h.Class('text-xs font-extrabold tracking-[0.05em] uppercase text-on-surface-variant')],
            [translate(locale, 'progress.resultSemester')],
          ),
          h.dd([h.Class('m-0 mt-1 text-sm font-bold')], [`${result.year}/${result.term}`]),
        ],
      ),
      h.div(
        [],
        [
          h.dt(
            [h.Class('text-xs font-extrabold tracking-[0.05em] uppercase text-on-surface-variant')],
            [translate(locale, 'progress.resultGrade')],
          ),
          h.dd([h.Class('m-0 mt-1 text-sm font-bold')], [gradeLabel(result.grade, locale)]),
        ],
      ),
      h.div(
        [],
        [
          h.dt(
            [h.Class('text-xs font-extrabold tracking-[0.05em] uppercase text-on-surface-variant')],
            [translate(locale, 'progress.resultCredits')],
          ),
          h.dd([h.Class('m-0 mt-1 text-sm font-bold')], [formatCredits(result.credits, locale)]),
        ],
      ),
    ],
  );

const checkboxControl = (
  id: string,
  describedBy: string,
  isChecked: boolean,
  onToggle: (isChecked: boolean) => Message,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  Checkbox.view<Message>(
    {
      id,
      isChecked,
      onToggle,
      toView: (attributes) =>
        h.label(
          [...attributes.label, h.Class(selectionControlClass)],
          [
            h.span(
              [
                ...attributes.checkbox,
                h.AriaLabelledBy(`${id}-text`),
                h.AriaDescribedBy(describedBy),
                h.Class(selectionBoxClass),
              ],
              [h.span([h.AriaHidden(true)], [isChecked ? '✓' : ''])],
            ),
            h.span([h.Id(`${id}-text`)], [translate(locale, 'progress.resultInclude')]),
          ],
        ),
    },
    h,
  );

const pageHeader = (locale: Localization, h: HtmlBuilder<Message>): Html =>
  h.header(
    [],
    [
      h.p([h.Class(eyebrowClass)], [translate(locale, 'progress.label')]),
      h.h1(
        [h.Class('text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]')],
        [translate(locale, 'progress.heading')],
      ),
      h.p(
        [h.Class('mt-[0.4rem] max-w-168 text-on-surface-variant leading-[1.5]')],
        [translate(locale, 'progress.description')],
      ),
    ],
  );

const summaryFact = (label: string, value: string, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        'grid min-h-28 content-between gap-3 rounded-m3-large border border-outline-variant bg-surface-container p-4',
      ),
    ],
    [
      h.dt(
        [h.Class('text-xs font-extrabold tracking-[0.05em] uppercase text-on-surface-variant')],
        [label],
      ),
      h.dd(
        [h.Class('m-0 text-[clamp(1.35rem,3vw,1.9rem)] font-extrabold tracking-[-0.03em]')],
        [value],
      ),
    ],
  );

const actionButton = (
  label: string,
  message: Message,
  variant: 'primary' | 'secondary' | 'compact',
  h: HtmlBuilder<Message>,
  isDisabled = false,
): Html =>
  Button.view<Message>(
    {
      type: 'button',
      isDisabled,
      onClick: message,
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(
              variant === 'primary'
                ? buttonPrimary
                : variant === 'secondary'
                  ? buttonSecondary
                  : compactActionClass,
            ),
          ],
          [label],
        ),
    },
    h,
  );

const summaryView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const state = model.session.current;
  const summary = calculateProgress(state.results, state.policy);
  const average =
    summary.average === null
      ? translate(locale, 'progress.noAverage')
      : formatNumber(summary.average, locale);
  const targetPercentage = Math.min((summary.earnedCredits / state.targetCredits) * 100, 100);

  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.summaryHeading'))],
    [
      h.div(
        [h.Class('flex flex-wrap items-start justify-between gap-3')],
        [
          h.div(
            [],
            [
              h.h2(
                [h.Class('m-0 text-lg font-extrabold')],
                [translate(locale, 'progress.summaryHeading')],
              ),
              h.p(
                [h.Class('mb-0 mt-1 text-sm text-on-surface-variant')],
                [
                  translate(locale, 'progress.targetProgress', {
                    earned: formatCredits(summary.earnedCredits, locale),
                    target: formatCredits(state.targetCredits, locale),
                  }),
                ],
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                'rounded-full bg-primary-container px-3 py-1 text-sm font-extrabold text-on-primary-container',
              ),
            ],
            [`${formatNumber(targetPercentage, locale)}%`],
          ),
        ],
      ),
      h.progress(
        [
          h.Class('h-3 w-full overflow-hidden rounded-full accent-primary'),
          h.Max(String(state.targetCredits)),
          h.Value(String(Math.min(summary.earnedCredits, state.targetCredits))),
          h.AriaLabel(translate(locale, 'progress.targetProgressLabel')),
        ],
        [],
      ),
      h.dl(
        [h.Class('grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3 m-0')],
        [
          summaryFact(translate(locale, 'progress.weightedAverage'), average, h),
          summaryFact(
            translate(locale, 'progress.earnedCredits'),
            translate(locale, 'progress.creditsValue', {
              credits: formatCredits(summary.earnedCredits, locale),
            }),
            h,
          ),
          summaryFact(
            translate(locale, 'progress.gradedCredits'),
            translate(locale, 'progress.creditsValue', {
              credits: formatCredits(summary.gradedCredits, locale),
            }),
            h,
          ),
          summaryFact(
            translate(locale, 'progress.includedCourses'),
            translate(
              locale,
              summary.includedCourses === 1
                ? 'progress.courseCountOne'
                : 'progress.courseCountMany',
              { count: summary.includedCourses },
            ),
            h,
          ),
        ],
      ),
    ],
  );
};

const policyButton = (
  retakes: ProgressState['policy']['retakes'],
  value: ProgressState['policy']['retakes'],
  label: string,
  h: HtmlBuilder<Message>,
): Html => {
  const selected = retakes === value;
  return Button.view<Message>(
    {
      type: 'button',
      onClick: Message.ChangedRetakePolicy({ retakes: value }),
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(
              `min-h-11 cursor-pointer border-0 px-3 text-sm font-bold focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-[3px] ${
                selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
              }`,
            ),
            h.AriaPressed(String(selected)),
          ],
          [label],
        ),
    },
    h,
  );
};

const calculatorView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const state = model.session.current;
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.calculatorHeading'))],
    [
      h.div(
        [],
        [
          h.h2(
            [h.Class('m-0 text-lg font-extrabold')],
            [translate(locale, 'progress.calculatorHeading')],
          ),
          h.p(
            [h.Class('mb-0 mt-1 text-sm leading-[1.45] text-on-surface-variant')],
            [translate(locale, 'progress.calculatorDescription')],
          ),
        ],
      ),
      h.div(
        [h.Class('grid gap-2')],
        [
          h.h3([h.Class(fieldLabelClass)], [translate(locale, 'progress.retakePolicy')]),
          h.div(
            [
              h.Class('grid grid-cols-2 overflow-hidden rounded-m3-medium border border-outline'),
              h.Role('group'),
              h.AriaLabel(translate(locale, 'progress.retakePolicy')),
            ],
            [
              policyButton(
                state.policy.retakes,
                'latest',
                translate(locale, 'progress.retakeLatest'),
                h,
              ),
              policyButton(
                state.policy.retakes,
                'best',
                translate(locale, 'progress.retakeBest'),
                h,
              ),
            ],
          ),
        ],
      ),
      Checkbox.view<Message>(
        {
          id: 'progress-include-f',
          isChecked: state.policy.includeF,
          onToggle: (includeF) => Message.ChangedIncludeF({ includeF }),
          toView: (attributes) =>
            h.label(
              [...attributes.label, h.Class(selectionControlClass)],
              [
                h.span(
                  [
                    ...attributes.checkbox,
                    h.AriaLabelledBy('progress-include-f-text'),
                    h.Class(selectionBoxClass),
                  ],
                  [h.span([h.AriaHidden(true)], [state.policy.includeF ? '✓' : ''])],
                ),
                h.span([h.Id('progress-include-f-text')], [translate(locale, 'progress.includeF')]),
              ],
            ),
        },
        h,
      ),
      Input.view<Message>(
        {
          id: 'progress-target-credits',
          name: 'targetCredits',
          value: model.targetDraft,
          onInput: (value) => Message.ChangedTargetDraft({ value }),
          toView: (attributes) =>
            h.div(
              [h.Class('grid gap-1')],
              [
                h.label(
                  [...attributes.label, h.Class(fieldLabelClass)],
                  [translate(locale, 'progress.targetLabel')],
                ),
                h.div(
                  [h.Class('flex flex-wrap gap-2')],
                  [
                    h.input([
                      ...attributes.input,
                      h.Type('number'),
                      h.Min('1'),
                      h.Max('2000'),
                      h.Class(
                        'min-h-12 min-w-0 flex-1 rounded-m3-medium border border-outline bg-surface-container-low px-4 text-base',
                      ),
                    ]),
                    actionButton(
                      translate(locale, 'progress.targetApply'),
                      Message.RequestedApplyTarget(),
                      'compact',
                      h,
                    ),
                  ],
                ),
              ],
            ),
        },
        h,
      ),
    ],
  );
};

const distributionView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const rows = gradeCreditDistribution(
    model.session.current.results,
    model.session.current.policy,
  ).filter((row) => row.credits > 0);
  const maximum = Math.max(0, ...rows.map((row) => row.credits));
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.distributionHeading'))],
    [
      h.h2(
        [h.Class('m-0 text-lg font-extrabold')],
        [translate(locale, 'progress.distributionHeading')],
      ),
      rows.length === 0
        ? h.p(
            [h.Class('m-0 text-sm text-on-surface-variant')],
            [translate(locale, 'progress.noAverage')],
          )
        : h.ul(
            [h.Class('m-0 grid list-none gap-3 p-0')],
            rows.map((row) =>
              h.keyed('li')(
                row.grade,
                [h.Class('grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3')],
                [
                  h.span([h.Class('font-extrabold')], [gradeLabel(row.grade, locale)]),
                  h.div(
                    [h.Class('h-5 overflow-hidden rounded-full bg-surface-container-highest')],
                    [
                      h.span(
                        [
                          h.Class('block h-full min-w-1 rounded-full bg-primary'),
                          h.Style({ width: `${(row.credits / maximum) * 100}%` }),
                          h.AriaHidden(true),
                        ],
                        [],
                      ),
                    ],
                  ),
                  h.span(
                    [h.Class('text-sm font-bold tabular-nums')],
                    [
                      translate(locale, 'progress.creditsValue', {
                        credits: formatCredits(row.credits, locale),
                      }),
                    ],
                  ),
                ],
              ),
            ),
          ),
    ],
  );
};

const trendView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const points = cumulativeSemesterAverageSeries(
    model.session.current.results,
    model.session.current.policy,
  );
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.semesterHeading'))],
    [
      h.h2(
        [h.Class('m-0 text-lg font-extrabold')],
        [translate(locale, 'progress.semesterHeading')],
      ),
      points.length === 0
        ? h.p(
            [h.Class('m-0 text-sm text-on-surface-variant')],
            [translate(locale, 'progress.noTrend')],
          )
        : h.ol(
            [h.Class('m-0 grid list-none gap-3 p-0')],
            points.map((point) =>
              h.keyed('li')(
                `${point.year}-${point.term}`,
                [h.Class('grid gap-1')],
                [
                  h.div(
                    [h.Class('flex items-baseline justify-between gap-3')],
                    [
                      h.span([h.Class('text-sm font-bold')], [`${point.year}/${point.term}`]),
                      h.span(
                        [h.Class('text-sm font-extrabold tabular-nums')],
                        [
                          point.average === null
                            ? translate(locale, 'progress.noAverage')
                            : formatNumber(point.average, locale),
                        ],
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class('h-3 overflow-hidden rounded-full bg-surface-container-highest')],
                    [
                      h.span(
                        [
                          h.Class('block h-full min-w-1 rounded-full bg-tertiary'),
                          h.Style({
                            width: `${point.average === null ? 0 : (point.average / 5) * 100}%`,
                          }),
                          h.AriaHidden(true),
                        ],
                        [],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
    ],
  );
};

const importFailureMessage = (
  reason: typeof ImportFailureReasonSchema.Type,
  locale: Localization,
): string => {
  switch (reason) {
    case 'non-file':
      return translate(locale, 'progress.importNonFile');
    case 'wrong-file-count':
      return translate(locale, 'progress.importOneFile');
    case 'unsupported-file':
      return translate(locale, 'progress.importSupportedOnly');
    case 'preview-failed':
      return translate(locale, 'progress.importFailed');
    case 'backup-failed':
      return translate(locale, 'progress.restoreInvalid');
  }
};

const fileDropView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const retrying = model.importState._tag === 'ImportFailure';
  const helpId = 'progress-transcript-file-help';
  return h.submodel({
    slotId: 'progress-file-drop',
    model: model.fileDrop,
    view: FileDrop.view,
    viewInputs: {
      accept: ['application/pdf', 'application/json'],
      multiple: false,
      toView: (attributes) =>
        h.label(
          [
            ...attributes.root,
            h.Class(
              'grid min-h-44 cursor-pointer content-center justify-items-center gap-2 rounded-m3-large border border-dashed border-outline bg-surface-container p-5 text-center transition-[border-color,box-shadow,background-color] duration-150 ease-in-out focus-within:border-primary focus-within:bg-primary-container focus-within:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)] data-[drag-over]:border-primary data-[drag-over]:bg-primary-container',
            ),
          ],
          [
            h.input([...attributes.input, h.AriaDescribedBy(helpId)]),
            h.span(
              [h.Class('text-sm font-extrabold text-primary')],
              [translate(locale, retrying ? 'progress.importRetry' : 'progress.importChoose')],
            ),
            h.span(
              [h.Class('text-sm text-on-surface-variant')],
              [translate(locale, 'progress.importDropHint')],
            ),
            h.span(
              [h.Id(helpId), h.Class('text-xs leading-[1.4] text-on-surface-variant')],
              [translate(locale, 'progress.importRequirements')],
            ),
          ],
        ),
    },
    toParentMessage: (message) => Message.GotFileDropMessage({ message }),
  });
};
const vocabularyField = (
  id: string,
  field: VocabularyField,
  label: string,
  help: string,
  value: string,
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('grid gap-1')],
    [
      h.label([h.For(id), h.Class(fieldLabelClass)], [label]),
      h.textarea([
        h.Id(id),
        h.Name(field),
        h.Value(value),
        h.Rows(3),
        h.Disabled(model.importState._tag === 'ImportParsing'),
        h.OnInput((next) => Message.ChangedVocabulary({ field, value: next })),
        h.Class(
          'min-h-24 w-full resize-y rounded-m3-medium border border-outline bg-surface-container-low px-3 py-2 font-mono text-sm',
        ),
        h.AriaDescribedBy(`${id}-help`),
      ]),
      h.p(
        [h.Id(`${id}-help`), h.Class('m-0 text-xs leading-[1.4] text-on-surface-variant')],
        [help],
      ),
    ],
  );

const vocabularyView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html =>
  h.details(
    [h.Class('rounded-m3-large border border-outline-variant bg-surface-container p-4')],
    [
      h.summary(
        [h.Class('cursor-pointer font-extrabold')],
        [translate(locale, 'progress.vocabularyHeading')],
      ),
      h.div(
        [h.Class('mt-4 grid gap-4')],
        [
          h.p(
            [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
            [translate(locale, 'progress.vocabularyDescription')],
          ),
          vocabularyField(
            'progress-vocabulary-terms',
            'terms',
            translate(locale, 'progress.vocabularyTerms'),
            translate(locale, 'progress.vocabularyTermsHelp'),
            model.vocabularyTerms,
            model,
            h,
          ),
          vocabularyField(
            'progress-vocabulary-grades',
            'grades',
            translate(locale, 'progress.vocabularyGrades'),
            translate(locale, 'progress.vocabularyGradesHelp'),
            model.vocabularyGrades,
            model,
            h,
          ),
          vocabularyField(
            'progress-vocabulary-totals',
            'totals',
            translate(locale, 'progress.vocabularyTotals'),
            translate(locale, 'progress.vocabularyTotalsHelp'),
            model.vocabularyTotals,
            model,
            h,
          ),
        ],
      ),
    ],
  );

const pdfPreview = (
  objectUrl: string,
  fileName: string,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('grid gap-3')],
    [
      h.iframe(
        [
          h.Src(objectUrl),
          h.Title(translate(locale, 'progress.previewReady')),
          h.Class(
            'h-[min(62svh,42rem)] w-full rounded-m3-large border border-outline-variant bg-surface',
          ),
        ],
        [],
      ),
      h.p(
        [h.Class('m-0 text-xs text-on-surface-variant')],
        [translate(locale, 'progress.previewDescription')],
      ),
    ],
  );

const previewView = (
  previewing: ImportPreview,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('grid gap-4')],
    [
      h.div(
        [],
        [
          h.h3(
            [h.Class('m-0 text-base font-extrabold')],
            [translate(locale, 'progress.previewHeading')],
          ),
          h.p(
            [h.Class('mb-0 mt-1 text-sm text-on-surface-variant')],
            [translate(locale, 'progress.previewDescription')],
          ),
        ],
      ),
      previewing.error.length === 0
        ? h.empty
        : h.p(
            [
              h.Class(
                'm-0 rounded-m3-medium bg-error-container px-4 py-3 text-sm text-on-error-container',
              ),
              h.Role('alert'),
            ],
            [
              translate(
                locale,
                previewing.error === 'vocabulary-invalid'
                  ? 'progress.vocabularyInvalid'
                  : 'progress.importFailed',
              ),
            ],
          ),
      pdfPreview(previewing.objectUrl, previewing.fileName, locale, h),
      h.div(
        [h.Class(controlGroupClass)],
        [
          actionButton(
            translate(locale, 'progress.previewParse'),
            Message.RequestedTranscriptParse(),
            'primary',
            h,
          ),
          actionButton(
            translate(locale, 'progress.reviewCancel'),
            Message.CancelledImport(),
            'secondary',
            h,
          ),
        ],
      ),
    ],
  );

const importDraftField = (
  field: DraftTextField,
  label: string,
  value: string,
  index: number,
  isDisabled: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const id = `progress-import-${index}-${field}`;
  return h.div(
    [h.Class(`grid gap-1 ${field === 'name' ? '@min-[36rem]:col-span-2' : ''}`)],
    [
      h.label([h.For(id), h.Class(fieldLabelClass)], [label]),
      h.input([
        h.Id(id),
        h.Name(field),
        h.Value(value),
        h.Disabled(isDisabled),
        h.Autocomplete('off'),
        h.OnInput((next) => Message.ChangedImportField({ index, field, value: next })),
        h.Class(
          'min-h-11 min-w-0 rounded-m3-medium border border-outline bg-surface-container-low px-3 text-base',
        ),
      ]),
    ],
  );
};

const draftLabels = (field: DraftTextField, locale: Localization): string => {
  switch (field) {
    case 'institution':
      return translate(locale, 'progress.fieldInstitution');
    case 'code':
      return translate(locale, 'progress.fieldCode');
    case 'name':
      return translate(locale, 'progress.fieldName');
    case 'year':
      return translate(locale, 'progress.fieldYear');
    case 'term':
      return translate(locale, 'progress.fieldTerm');
    case 'credits':
      return translate(locale, 'progress.fieldCredits');
    case 'grade':
      return translate(locale, 'progress.fieldGrade');
  }
};

const differenceLabel = (disposition: string, locale: Localization): string => {
  switch (disposition) {
    case 'new':
      return translate(locale, 'progress.reviewNew');
    case 'update':
      return translate(locale, 'progress.reviewUpdate');
    case 'unchanged':
      return translate(locale, 'progress.reviewUnchanged');
    case 'previous':
      return translate(locale, 'progress.reviewPrevious');
    default:
      return disposition;
  }
};

const reviewRow = (
  row: ImportDraftRow,
  index: number,
  disposition: string | null,
  reviewing: ImportReview,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const validation = validateCourseDraft(row.fields);
  const title = row.fields.name.length > 0 ? row.fields.name : row.fields.code;
  const titleId = resultTitleId('review', index);
  return h.keyed('li')(
    `${row.fields.institution}:${row.fields.code}:${row.fields.year}:${row.fields.term}:${index}`,
    [h.Class(resultCardClass)],
    [
      h.div(
        [h.Class('min-w-0 grid gap-3')],
        [
          h.div(
            [h.Class('flex flex-wrap items-center gap-2')],
            [
              h.h3(
                [h.Id(titleId), h.Class('m-0 text-base font-extrabold [overflow-wrap:anywhere]')],
                [title],
              ),
              disposition === null
                ? h.empty
                : h.span(
                    [
                      h.Class(
                        'rounded-full bg-tertiary-container px-2 py-1 text-xs font-extrabold text-on-tertiary-container',
                      ),
                    ],
                    [differenceLabel(disposition, locale)],
                  ),
            ],
          ),
          reviewing.editing
            ? h.div(
                [h.Class('grid gap-3 @min-[36rem]:grid-cols-2')],
                (['institution', 'code', 'name', 'year', 'term', 'credits', 'grade'] as const).map(
                  (field) =>
                    importDraftField(
                      field,
                      draftLabels(field, locale),
                      row.fields[field],
                      index,
                      reviewing.committing,
                      h,
                    ),
                ),
              )
            : validation.ok
              ? resultFacts(validation.result, locale, h)
              : h.p(
                  [h.Class('m-0 text-sm font-bold text-error'), h.Role('alert')],
                  [translate(locale, 'progress.editorValidation')],
                ),
        ],
      ),
      h.div(
        [h.Class('grid gap-2 [@media(min-width:42rem)]:justify-items-end')],
        [
          checkboxControl(
            `progress-import-result-${index}`,
            titleId,
            row.selected,
            (included) => Message.ToggledImportResult({ index, included }),
            locale,
            h,
          ),
        ],
      ),
    ],
  );
};

const reviewView = (
  reviewing: ImportReview,
  state: ProgressState,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const selected = selectedDraftResults(reviewing);
  let dispositions = new Map<string, string>();
  if (selected.ok) {
    try {
      dispositions = new Map(
        previewImportMerge(state.results, selected.results).differences.map((difference) => [
          difference.attemptKey,
          difference.disposition,
        ]),
      );
    } catch {
      dispositions = new Map();
    }
  }
  const selectedCount = reviewing.rows.filter((row) => row.selected).length;
  return h.div(
    [h.Class('grid gap-4')],
    [
      h.div(
        [h.Class('grid gap-1')],
        [
          h.h3(
            [h.Class('m-0 text-base font-extrabold')],
            [translate(locale, 'progress.reviewHeading')],
          ),
          h.p(
            [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
            [translate(locale, 'progress.reviewDescription')],
          ),
          h.p(
            [h.Class('m-0 text-sm text-on-surface-variant')],
            [translate(locale, 'progress.reviewFile', { fileName: reviewing.fileName })],
          ),
        ],
      ),
      reviewing.showingSource
        ? pdfPreview(reviewing.objectUrl, reviewing.fileName, locale, h)
        : h.empty,
      reviewing.statedCredits === null
        ? h.empty
        : h.p(
            [
              h.Class(
                'm-0 rounded-m3-medium bg-secondary-container px-4 py-3 font-bold text-on-secondary-container',
              ),
            ],
            [
              `${translate(locale, 'progress.resultStatedCredits')}: ${formatCredits(
                reviewing.statedCredits,
                locale,
              )}`,
            ],
          ),
      reviewing.warnings.length === 0
        ? h.empty
        : h.aside(
            [
              h.Class(
                'grid gap-2 rounded-m3-medium border border-warning bg-warning-container px-4 py-3 text-on-warning-container',
              ),
              h.Role('status'),
            ],
            [
              h.h4(
                [h.Class('m-0 text-sm font-extrabold')],
                [translate(locale, 'progress.reviewWarningsHeading')],
              ),
              h.ul(
                [h.Class('m-0 grid gap-1 pl-5 text-sm leading-[1.45]')],
                reviewing.warnings.map((warning) => h.keyed('li')(warning, [], [warning])),
              ),
            ],
          ),
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.p(
            [h.Class('m-0 text-sm font-bold'), h.Role('status'), h.AriaLive('polite')],
            [translate(locale, 'progress.reviewSelection', { count: selectedCount })],
          ),
          h.div(
            [h.Class('flex flex-wrap gap-2')],
            [
              actionButton(
                translate(
                  locale,
                  reviewing.showingSource ? 'progress.reviewBack' : 'progress.reviewSource',
                ),
                Message.ToggledImportSource(),
                'compact',
                h,
                reviewing.committing,
              ),
              actionButton(
                translate(
                  locale,
                  reviewing.editing ? 'progress.reviewDoneEditing' : 'progress.reviewEdit',
                ),
                Message.ToggledImportEditing(),
                'compact',
                h,
                reviewing.committing,
              ),
              actionButton(
                translate(locale, 'progress.reviewSelectAll'),
                Message.IncludedAllImportResults(),
                'compact',
                h,
                reviewing.committing,
              ),
              actionButton(
                translate(locale, 'progress.reviewSelectNone'),
                Message.ClearedImportResults(),
                'compact',
                h,
                reviewing.committing,
              ),
            ],
          ),
        ],
      ),
      reviewing.rows.length === 0
        ? h.p(
            [h.Class('m-0 text-sm text-on-surface-variant')],
            [translate(locale, 'progress.reviewNoRows')],
          )
        : h.ol(
            [h.Class('grid gap-3 m-0 list-none p-0')],
            reviewing.rows.map((row, index) => {
              const validated = validateCourseDraft(row.fields);
              const disposition =
                validated.ok && row.selected
                  ? (dispositions.get(courseAttemptKey(validated.result)) ?? null)
                  : null;
              return reviewRow(row, index, disposition, reviewing, locale, h);
            }),
          ),
      reviewing.error.length === 0
        ? h.empty
        : h.p(
            [
              h.Class(
                'm-0 rounded-m3-medium bg-error-container px-4 py-3 text-sm font-bold text-on-error-container',
              ),
              h.Role('alert'),
            ],
            [
              reviewing.error === 'stale'
                ? translate(locale, 'progress.staleDraft')
                : translate(locale, 'progress.editorValidation'),
            ],
          ),
      h.div(
        [h.Class(controlGroupClass)],
        [
          actionButton(
            translate(
              locale,
              reviewing.committing ? 'progress.persistenceSaving' : 'progress.reviewApprove',
            ),
            Message.RequestedApproveImport(),
            'primary',
            h,
            reviewing.committing || selectedCount === 0,
          ),
          actionButton(
            translate(locale, 'progress.reviewCancel'),
            Message.CancelledImport(),
            'secondary',
            h,
            reviewing.committing,
          ),
        ],
      ),
    ],
  );
};

const importView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const state = model.importState;
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.importHeading'))],
    [
      h.div(
        [],
        [
          h.h2(
            [h.Class('m-0 text-lg font-extrabold')],
            [translate(locale, 'progress.importHeading')],
          ),
          h.p(
            [h.Class('mb-0 mt-1 text-sm leading-[1.45] text-on-surface-variant')],
            [translate(locale, 'progress.importDescription')],
          ),
        ],
      ),
      state._tag === 'ImportIdle' ||
      state._tag === 'ImportFailure' ||
      state._tag === 'ImportPreview'
        ? vocabularyView(model, locale, h)
        : h.empty,
      state._tag === 'ImportFailure'
        ? h.p(
            [
              h.Class(
                'm-0 rounded-m3-medium border border-error bg-error-container px-4 py-3 text-sm text-on-error-container',
              ),
              h.Role('alert'),
            ],
            [importFailureMessage(state.reason, locale)],
          )
        : h.empty,
      state._tag === 'ImportOpening' || state._tag === 'ImportParsing'
        ? h.div(
            [
              h.Class(
                'grid min-h-44 place-items-center content-center gap-3 rounded-m3-large border border-outline-variant bg-surface-container text-center',
              ),
              h.Role('status'),
              h.AriaLive('polite'),
            ],
            [
              h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
              h.p(
                [h.Class('m-0 text-sm font-bold')],
                [
                  translate(
                    locale,
                    state._tag === 'ImportOpening'
                      ? 'progress.importOpening'
                      : 'progress.importParsing',
                    {
                      fileName: state.fileName,
                    },
                  ),
                ],
              ),
            ],
          )
        : state._tag === 'ImportPreview'
          ? previewView(state, locale, h)
          : state._tag === 'ImportReview'
            ? reviewView(state, model.session.current, locale, h)
            : fileDropView(model, locale, h),
    ],
  );
};

const editorLabels = (locale: Localization): Editor.Labels => ({
  addHeading: translate(locale, 'progress.addCourse'),
  editHeading: translate(locale, 'progress.editResult'),
  description: translate(locale, 'progress.editorDescription'),
  institution: translate(locale, 'progress.fieldInstitution'),
  code: translate(locale, 'progress.fieldCode'),
  name: translate(locale, 'progress.fieldName'),
  year: translate(locale, 'progress.fieldYear'),
  term: translate(locale, 'progress.fieldTerm'),
  credits: translate(locale, 'progress.resultCredits'),
  grade: translate(locale, 'progress.resultGrade'),
  included: translate(locale, 'progress.resultInclude'),
  addCourse: translate(locale, 'progress.addCourse'),
  saveChanges: translate(locale, 'progress.saveCourse'),
  cancel: translate(locale, 'progress.reviewCancel'),
  remove: translate(locale, 'progress.remove'),
  unsavedChanges: translate(locale, 'progress.editorUnsaved'),
  validationSummary: translate(locale, 'progress.editorValidation'),
  discardConfirmation: translate(locale, 'progress.discardHeading'),
  discardChanges: translate(locale, 'progress.discardChanges'),
  removeConfirmation: translate(locale, 'progress.removeCourseHeading'),
  confirmRemove: translate(locale, 'progress.confirmRemove'),
  keepEditing: translate(locale, 'progress.keepEditing'),
});

const historyRow = (
  result: CourseResult,
  locale: Localization,
  courseUrl: (courseCode: string) => string,
  h: HtmlBuilder<Message>,
): Html => {
  const attemptKey = courseAttemptKey(result);
  const controlId = `progress-history-${encodeURIComponent(attemptKey)}`;
  const titleId = `${controlId}-title`;
  return h.keyed('li')(
    attemptKey,
    [h.Class(resultCardClass)],
    [
      h.div(
        [h.Class('min-w-0')],
        [
          h.h3(
            [h.Id(titleId), h.Class('m-0 text-base font-extrabold [overflow-wrap:anywhere]')],
            [result.name],
          ),
          h.p(
            [h.Class('mb-0 mt-1 text-xs font-extrabold tracking-[0.08em] uppercase text-primary')],
            [result.institution],
          ),
          h.div([h.Class('mt-3')], [resultFacts(result, locale, h)]),
          result.institution.toLocaleUpperCase().includes('NTNU')
            ? h.p(
                [h.Class('mb-0 mt-3')],
                [
                  h.a(
                    [
                      h.Href(courseUrl(result.code)),
                      h.Class('font-bold text-primary underline underline-offset-4'),
                    ],
                    [translate(locale, 'progress.openCourse', { courseCode: result.code })],
                  ),
                ],
              )
            : h.empty,
        ],
      ),
      h.div(
        [h.Class('grid gap-2 [@media(min-width:42rem)]:justify-items-end')],
        [
          checkboxControl(
            controlId,
            titleId,
            result.included,
            (included) => Message.ToggledCommittedResult({ attemptKey, included }),
            locale,
            h,
          ),
          actionButton(
            translate(locale, 'progress.editCourse', { courseCode: result.code }),
            Message.RequestedEditCourse({ attemptKey }),
            'compact',
            h,
          ),
        ],
      ),
    ],
  );
};

const historyView = (
  model: Model,
  locale: Localization,
  courseUrl: (courseCode: string) => string,
  h: HtmlBuilder<Message>,
): Html => {
  const state = model.session.current;
  const query = model.search.trim().toLocaleLowerCase(localeTag(locale.locale));
  const filtered = state.results.filter((result) =>
    query.length === 0
      ? true
      : `${result.code} ${result.name} ${result.institution}`
          .toLocaleLowerCase(localeTag(locale.locale))
          .includes(query),
  );
  const partitioned = partitionAttempts(filtered, state.policy);
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.historyHeading'))],
    [
      h.div(
        [h.Class('flex flex-wrap items-start justify-between gap-3')],
        [
          h.div(
            [],
            [
              h.h2(
                [h.Class('m-0 text-lg font-extrabold')],
                [translate(locale, 'progress.historyHeading')],
              ),
              h.p(
                [h.Class('mb-0 mt-1 text-sm leading-[1.45] text-on-surface-variant')],
                [translate(locale, 'progress.historyDescription')],
              ),
            ],
          ),
          actionButton(
            translate(locale, 'progress.addCourse'),
            Message.RequestedAddCourse(),
            'primary',
            h,
          ),
        ],
      ),
      state.results.length === 0
        ? h.div(
            [
              h.Class(
                'grid min-h-48 place-items-center content-center rounded-m3-large border border-outline-variant bg-surface-container p-5 text-center',
              ),
            ],
            [
              h.h3(
                [h.Class('m-0 text-base font-extrabold')],
                [translate(locale, 'progress.emptyHeading')],
              ),
              h.p(
                [h.Class('mb-0 mt-2 max-w-112 text-sm leading-[1.45] text-on-surface-variant')],
                [translate(locale, 'progress.emptyDescription')],
              ),
            ],
          )
        : Input.view<Message>(
            {
              id: 'progress-result-search',
              name: 'progressSearch',
              value: model.search,
              onInput: (value) => Message.ChangedSearch({ value }),
              toView: (attributes) =>
                h.div(
                  [h.Class('grid gap-1')],
                  [
                    h.label(
                      [...attributes.label, h.Class(fieldLabelClass)],
                      [translate(locale, 'progress.searchLabel')],
                    ),
                    h.input([
                      ...attributes.input,
                      h.Type('search'),
                      h.Autocomplete('off'),
                      h.Placeholder(translate(locale, 'progress.searchPlaceholder')),
                      h.Class(
                        'min-h-12 w-full rounded-m3-medium border border-outline bg-surface-container-low px-4 text-base',
                      ),
                    ]),
                  ],
                ),
            },
            h,
          ),
      state.results.length > 0 && filtered.length === 0
        ? h.p(
            [h.Class('m-0 text-sm text-on-surface-variant'), h.Role('status')],
            [translate(locale, 'progress.searchEmpty')],
          )
        : h.empty,
      partitioned.selected.length === 0
        ? h.empty
        : h.ol(
            [h.Class('grid gap-3 m-0 list-none p-0')],
            partitioned.selected.map((result) => historyRow(result, locale, courseUrl, h)),
          ),
      partitioned.previous.length === 0
        ? h.empty
        : h.details(
            [h.Class('rounded-m3-large border border-outline-variant bg-surface-container p-4')],
            [
              h.summary(
                [h.Class('cursor-pointer font-extrabold')],
                [
                  translate(
                    locale,
                    partitioned.previous.length === 1
                      ? 'progress.previousCountOne'
                      : 'progress.previousCountMany',
                    { count: partitioned.previous.length },
                  ),
                ],
              ),
              h.ol(
                [h.Class('mt-4 grid gap-3 list-none p-0')],
                partitioned.previous.map((result) => historyRow(result, locale, courseUrl, h)),
              ),
            ],
          ),
    ],
  );
};

const receiptsView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const rows = [];
  let sequence = 0;
  for (const receipt of model.session.current.importReceipts) {
    sequence += 1;
    rows.push({ key: `progress-receipt-${sequence}`, receipt });
  }
  if (rows.length === 0) return h.empty;
  rows.reverse();
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.receiptsHeading'))],
    [
      h.h2(
        [h.Class('m-0 text-lg font-extrabold')],
        [translate(locale, 'progress.receiptsHeading')],
      ),
      h.ol(
        [h.Class('m-0 grid list-none gap-2 p-0')],
        rows.map(({ key, receipt }) =>
          h.keyed('li')(
            key,
            [
              h.Class(
                'flex flex-wrap justify-between gap-2 rounded-m3-medium bg-surface-container px-4 py-3 text-sm',
              ),
            ],
            [
              h.span([h.Class('font-bold')], [receipt.at]),
              h.span(
                [],
                [
                  translate(locale, 'progress.receiptSummary', {
                    imported: receipt.importedResults,
                    total: receipt.totalResults,
                    credits: formatCredits(receipt.earnedCredits, locale),
                  }),
                ],
              ),
            ],
          ),
        ),
      ),
    ],
  );
};

const timelineKindLabel = (
  kind: ProgressSession['timeline'][number]['kind'],
  locale: Localization,
): string => {
  switch (kind) {
    case 'import':
      return translate(locale, 'progress.timelineImport');
    case 'add':
      return translate(locale, 'progress.timelineAdd');
    case 'edit':
      return translate(locale, 'progress.timelineEdit');
    case 'remove':
      return translate(locale, 'progress.timelineRemove');
    case 'restore':
      return translate(locale, 'progress.timelineRestore');
  }
};

const timelineView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const session = model.session;
  const rows = [];
  let cursor = 0;
  for (const entry of session.timeline) {
    cursor += 1;
    rows.push({ cursor, entry });
  }
  if (rows.length === 0) return h.empty;
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.sessionHeading'))],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.div(
            [],
            [
              h.h2(
                [h.Class('m-0 text-lg font-extrabold')],
                [translate(locale, 'progress.sessionHeading')],
              ),
              h.p(
                [h.Class('mb-0 mt-1 text-sm text-on-surface-variant')],
                [translate(locale, 'progress.sessionDescription')],
              ),
            ],
          ),
          h.div(
            [h.Class('flex gap-2')],
            [
              actionButton(
                translate(locale, 'progress.sessionUndo'),
                Message.RequestedUndo(),
                'compact',
                h,
                session.cursor === 0,
              ),
              actionButton(
                translate(locale, 'progress.sessionRedo'),
                Message.RequestedRedo(),
                'compact',
                h,
                session.cursor === session.timeline.length,
              ),
            ],
          ),
        ],
      ),
      h.ol(
        [h.Class('m-0 grid list-none gap-2 p-0')],
        rows.map(({ cursor, entry }) => {
          const selected = cursor === session.cursor;
          return h.keyed('li')(
            `progress-timeline-${cursor}`,
            [],
            [
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: Message.RequestedSeek({ cursor }),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(
                          `grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-m3-medium border px-4 py-3 text-left ${
                            selected
                              ? 'border-primary bg-primary-container text-on-primary-container'
                              : 'border-outline-variant bg-surface-container'
                          }`,
                        ),
                        h.AriaPressed(String(selected)),
                      ],
                      [
                        h.span([h.Class('font-extrabold tabular-nums')], [String(cursor)]),
                        h.span([h.Class('font-bold')], [timelineKindLabel(entry.kind, locale)]),
                        h.span(
                          [h.Class('text-xs text-on-surface-variant')],
                          [
                            translate(locale, 'progress.timelineCourses', {
                              count: entry.after.results.length,
                            }),
                          ],
                        ),
                      ],
                    ),
                },
                h,
              ),
            ],
          );
        }),
      ),
    ],
  );
};

const calculationView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  const summary = calculateProgress(model.session.current.results, model.session.current.policy);
  const average =
    summary.average === null
      ? translate(locale, 'progress.noAverage')
      : formatNumber(summary.average, locale);
  return h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.calculationHeading'))],
    [
      h.h2(
        [h.Class('m-0 text-lg font-extrabold')],
        [translate(locale, 'progress.calculationHeading')],
      ),
      h.p(
        [
          h.Class(
            'm-0 rounded-m3-medium bg-surface-container-high px-4 py-3 text-center font-mono text-sm font-extrabold',
          ),
        ],
        [translate(locale, 'progress.calculationFormula')],
      ),
      h.dl(
        [h.Class('m-0 grid grid-cols-6 gap-2')],
        (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((grade, index) =>
          h.keyed('div')(
            grade,
            [h.Class('grid justify-items-center rounded-m3-medium bg-surface-container px-2 py-3')],
            [
              h.dt([h.Class('font-extrabold')], [grade]),
              h.dd([h.Class('m-0 text-sm text-on-surface-variant')], [String(5 - index)]),
            ],
          ),
        ),
      ),
      h.p(
        [h.Class('m-0 text-center text-base font-extrabold tabular-nums')],
        [
          `${formatNumber(summary.weightedSum, locale)} ÷ ${formatNumber(
            summary.gradedCredits,
            locale,
          )} = ${average}`,
        ],
      ),
      h.p(
        [h.Class('m-0 text-sm leading-[1.5] text-on-surface-variant')],
        [translate(locale, 'progress.calculationDescription')],
      ),
      h.p(
        [
          h.Class(
            'm-0 rounded-m3-medium border border-outline-variant px-4 py-3 text-sm leading-[1.5]',
          ),
        ],
        [translate(locale, 'progress.calculationDisclaimer')],
      ),
    ],
  );
};

const dataActionsView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class(panelClass), h.AriaLabel(translate(locale, 'progress.dataHeading'))],
    [
      h.h2([h.Class('m-0 text-lg font-extrabold')], [translate(locale, 'progress.dataHeading')]),
      h.p(
        [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
        [translate(locale, 'progress.dataDescription')],
      ),
      h.div(
        [h.Class(controlGroupClass)],
        [
          actionButton(
            translate(locale, 'progress.backupDownload'),
            Message.RequestedDownloadBackup(),
            'compact',
            h,
          ),
          actionButton(
            translate(locale, 'progress.exampleLoad'),
            Message.RequestedExampleProgress(),
            'compact',
            h,
          ),
          actionButton(
            translate(locale, 'progress.clearRequest'),
            Message.RequestedClearProgress(),
            'compact',
            h,
          ),
        ],
      ),
      h.p(
        [h.Class('m-0 text-xs text-on-surface-variant')],
        [translate(locale, 'progress.fileType')],
      ),
    ],
  );

const statusView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  if (model.persistence._tag === 'PersistenceSaving') {
    return h.p(
      [h.Class('m-0 text-sm text-on-surface-variant'), h.Role('status'), h.AriaLive('polite')],
      [translate(locale, 'progress.persistenceSaving')],
    );
  }
  if (model.persistence._tag === 'PersistenceFailed') {
    return h.div(
      [
        h.Class(
          'flex flex-wrap items-center justify-between gap-3 rounded-m3-medium border border-error bg-error-container px-4 py-3 text-on-error-container',
        ),
        h.Role('alert'),
      ],
      [
        h.p([h.Class('m-0 text-sm font-bold')], [translate(locale, 'progress.persistenceFailed')]),
        actionButton(
          translate(locale, 'progress.retrySave'),
          Message.RequestedRetryPersistence(),
          'compact',
          h,
        ),
      ],
    );
  }
  if (model.status.length === 0) return h.empty;
  const key =
    model.status === 'backup-downloaded'
      ? 'progress.backupDownloaded'
      : model.status === 'backup-restored'
        ? 'progress.backupRestored'
        : model.status === 'import-saved'
          ? 'progress.statusImportSaved'
          : model.status === 'cleared'
            ? 'progress.statusCleared'
            : model.status === 'course-saved'
              ? 'progress.statusCourseSaved'
              : null;
  return h.p(
    [
      h.Class(
        `m-0 rounded-m3-medium px-4 py-3 text-sm font-bold ${key === null ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'}`,
      ),
      h.Role(key === null ? 'alert' : 'status'),
      h.AriaLive('polite'),
    ],
    [key === null ? model.status : translate(locale, key)],
  );
};

const confirmationView = (model: Model, locale: Localization, h: HtmlBuilder<Message>): Html => {
  if (model.confirmation === 'none') return h.empty;
  const destructive = model.confirmation === 'clear';
  const prompt =
    model.confirmation === 'restore'
      ? translate(locale, 'progress.backupRestoreHeading')
      : model.confirmation === 'example'
        ? translate(locale, 'progress.exampleHeading')
        : translate(locale, 'progress.clearHeading');
  return h.section(
    [
      h.Class(
        'grid gap-3 rounded-m3-extra-large border border-outline-variant bg-surface-container-high p-5 shadow-m3-2',
      ),
      h.Role('alertdialog'),
      h.AriaLabel(prompt),
    ],
    [
      h.h2([h.Class('m-0 text-lg font-extrabold')], [prompt]),
      h.div(
        [h.Class(controlGroupClass)],
        [
          actionButton(
            translate(
              locale,
              model.confirmation === 'restore'
                ? 'progress.backupRestore'
                : destructive
                  ? 'progress.clearConfirm'
                  : 'progress.exampleConfirm',
            ),
            Message.ConfirmedAction(),
            destructive ? 'secondary' : 'primary',
            h,
          ),
          actionButton(
            translate(locale, 'progress.reviewCancel'),
            Message.CancelledConfirmation(),
            'secondary',
            h,
          ),
        ],
      ),
    ],
  );
};

const loadingView = (locale: Localization, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
    [
      h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
      h.h2([h.Class(stateCardH2Class)], [translate(locale, 'progress.loading')]),
    ],
  );

const recoveryView = (
  loadState: Exclude<LoadState, { readonly _tag: 'ProgressLoading' | 'ProgressReady' }>,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const unavailable = loadState._tag === 'ProgressUnavailable';
  return h.section(
    [
      h.Class(
        unavailable
          ? stateCardFailure
          : `${stateCardBase} border-warning bg-warning-container text-on-warning-container`,
      ),
      h.Role('alert'),
    ],
    [
      h.h2(
        [h.Class(stateCardH2Class)],
        [
          translate(
            locale,
            unavailable ? 'progress.recoveryUnavailableHeading' : 'progress.recoveryHeading',
          ),
        ],
      ),
      h.p(
        [h.Class(stateCardFailurePClass)],
        [
          translate(
            locale,
            unavailable
              ? 'progress.recoveryUnavailableDescription'
              : 'progress.recoveryDescription',
          ),
        ],
      ),
      actionButton(
        translate(locale, 'progress.recoveryReset'),
        Message.RequestedRecoveryReset(),
        'primary',
        h,
      ),
    ],
  );
};

export interface ViewInputs {
  readonly locale: Localization;
  readonly courseUrl: (courseCode: string) => string;
}

export const view = defineView<Model, Message, ViewInputs>((model, { locale, courseUrl }, h) => {
  const editor =
    model.editor === null
      ? h.empty
      : h.div(
          [h.Class('grid gap-2')],
          [
            model.editorError.length === 0
              ? h.empty
              : h.p(
                  [
                    h.Class(
                      'm-0 rounded-m3-medium bg-error-container px-4 py-3 text-sm font-bold text-on-error-container',
                    ),
                    h.Role('alert'),
                  ],
                  [translate(locale, 'progress.staleDraft')],
                ),
            h.submodel({
              slotId: 'progress-course-editor',
              model: model.editor,
              view: Editor.view,
              viewInputs: { locale, labels: editorLabels(locale) },
              toParentMessage: (message) => Message.GotCourseEditorMessage({ message }),
            }),
          ],
        );
  const page =
    model.loadState._tag === 'ProgressLoading'
      ? loadingView(locale, h)
      : model.loadState._tag === 'ProgressReady'
        ? h.div(
            [h.Class('grid gap-5')],
            [
              statusView(model, locale, h),
              confirmationView(model, locale, h),
              editor,
              summaryView(model, locale, h),
              h.div(
                [h.Class('grid gap-5 [@media(min-width:56rem)]:grid-cols-2')],
                [distributionView(model, locale, h), trendView(model, locale, h)],
              ),
              h.div(
                [
                  h.Class(
                    'grid gap-5 [@media(min-width:56rem)]:grid-cols-[minmax(15rem,0.78fr)_minmax(0,1.22fr)]',
                  ),
                ],
                [calculatorView(model, locale, h), importView(model, locale, h)],
              ),
              historyView(model, locale, courseUrl, h),
              receiptsView(model, locale, h),
              timelineView(model, locale, h),
              calculationView(model, locale, h),
              dataActionsView(model, locale, h),
            ],
          )
        : recoveryView(model.loadState, locale, h);

  return h.section(
    [h.Class('grid gap-5 pt-[clamp(1.5rem,4vw,3rem)]')],
    [pageHeader(locale, h), page],
  );
});
