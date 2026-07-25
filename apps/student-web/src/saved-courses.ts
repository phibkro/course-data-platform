import { Result, Schema as S } from 'effect';
import { ts } from 'foldkit/schema';

/**
 * Student-owned saved-course state for the List slice.
 *
 * The module is pure: it never touches storage, the clock, the DOM, or the
 * network. The web application owns those boundaries and passes observed
 * values in explicitly.
 *
 * Two rules shape the representation:
 *
 * 1. A saved course references a course identity. It never copies official
 *    facts, so the factual cache (catalogue, decision signals, outcomes)
 *    stays separate and keeps its own observation time and source state.
 * 2. Notes and labels are student-authored. They never acquire source or
 *    inferred provenance.
 *
 * Persisted values are untrusted input. `parseSavedList` is the only entry
 * point that accepts them, and it never partially populates a usable state:
 * a stored value is empty, loaded, an unsupported version, or corrupt.
 */

export const savedListStorageKey = 'course-lens:list';

export const savedListSchemaVersion = 1;

export const noteMaxLength = 2000;

/**
 * Label colours are a constrained repository-owned set that mirrors the
 * semantic theme families. Label creation ships in the following slice; the
 * fields exist in schema version 1 so that stored state does not need a
 * migration to gain them.
 */
export const labelColors = ['blue', 'violet', 'amber', 'rose', 'emerald', 'sky'] as const;

export type LabelColor = (typeof labelColors)[number];

const LabelColorSchema = S.Literals(labelColors);

export const SavedCourseSchema = S.Struct({
  id: S.String,
  institutionId: S.Literal('ntnu'),
  courseCode: S.String,
  savedAt: S.String,
  note: S.NullOr(S.String),
  observedDataRevision: S.NullOr(S.String),
});

export const LabelSchema = S.Struct({
  id: S.String,
  name: S.String,
  color: LabelColorSchema,
});

export const LabelMembershipSchema = S.Struct({
  savedCourseId: S.String,
  labelId: S.String,
});

export const SavedListStateSchema = S.Struct({
  version: S.Literal(savedListSchemaVersion),
  savedCourses: S.Array(SavedCourseSchema),
  labels: S.Array(LabelSchema),
  memberships: S.Array(LabelMembershipSchema),
});

export type SavedCourse = typeof SavedCourseSchema.Type;
export type Label = typeof LabelSchema.Type;
export type LabelMembership = typeof LabelMembershipSchema.Type;
export type SavedListState = typeof SavedListStateSchema.Type;

export const emptySavedList: SavedListState = {
  version: savedListSchemaVersion,
  savedCourses: [],
  labels: [],
  memberships: [],
};

/**
 * A course identity that survived normalization. Construct it with
 * `courseIdentity`; an unparseable code cannot reach the saved set.
 */
export interface CourseIdentity {
  readonly institutionId: 'ntnu';
  readonly courseCode: string;
  readonly savedCourseId: string;
}

const courseCodePattern = /^[A-ZÆØÅ0-9]{2,20}$/;

export const courseIdentity = (candidate: string): CourseIdentity | null => {
  const courseCode = candidate.trim().toUpperCase();
  if (!courseCodePattern.test(courseCode)) return null;
  return { institutionId: 'ntnu', courseCode, savedCourseId: `ntnu:${courseCode}` };
};

/**
 * Truncates by Unicode code point, never by UTF-16 code unit, so a surrogate
 * pair sitting on the boundary is kept or dropped whole rather than split
 * into a lone, unrenderable surrogate half.
 */
const normalizeNote = (note: string): string | null => {
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;
  // Code point count is never greater than UTF-16 length, so this stays
  // within bounds whenever the cheap length check already does.
  if (trimmed.length <= noteMaxLength) return trimmed;
  const codePoints = Array.from(trimmed);
  return codePoints.length > noteMaxLength ? codePoints.slice(0, noteMaxLength).join('') : trimmed;
};

export const findSavedCourse = (
  state: SavedListState,
  identity: CourseIdentity,
): SavedCourse | null =>
  state.savedCourses.find((course) => course.id === identity.savedCourseId) ?? null;

export const isSaved = (state: SavedListState, identity: CourseIdentity): boolean =>
  findSavedCourse(state, identity) !== null;

export const savedCourseCount = (state: SavedListState): number => state.savedCourses.length;

/**
 * Newest saved first, with the course code as a stable tiebreaker so the order
 * never depends on insertion accidents.
 */
export const savedCoursesNewestFirst = (state: SavedListState): ReadonlyArray<SavedCourse> =>
  [...state.savedCourses].sort((left, right) =>
    left.savedAt === right.savedAt
      ? left.courseCode.localeCompare(right.courseCode)
      : right.savedAt.localeCompare(left.savedAt),
  );

export const membershipsForSavedCourse = (
  state: SavedListState,
  identity: CourseIdentity,
): ReadonlyArray<LabelMembership> =>
  state.memberships.filter((membership) => membership.savedCourseId === identity.savedCourseId);

/** Saving twice is the same as saving once, and returns the identical state. */
export const saveCourse = (
  state: SavedListState,
  identity: CourseIdentity,
  savedAt: string,
  observedDataRevision: string | null = null,
): SavedListState => {
  if (isSaved(state, identity)) return state;
  return {
    ...state,
    savedCourses: [
      ...state.savedCourses,
      {
        id: identity.savedCourseId,
        institutionId: identity.institutionId,
        courseCode: identity.courseCode,
        savedAt,
        note: null,
        observedDataRevision,
      },
    ],
  };
};

/**
 * Removing a saved course removes its memberships in the same transition, so
 * no projection can observe a membership without its course.
 */
export const removeSavedCourse = (
  state: SavedListState,
  identity: CourseIdentity,
): SavedListState => {
  if (!isSaved(state, identity)) return state;
  return {
    ...state,
    savedCourses: state.savedCourses.filter((course) => course.id !== identity.savedCourseId),
    memberships: state.memberships.filter(
      (membership) => membership.savedCourseId !== identity.savedCourseId,
    ),
  };
};

/**
 * Restores an exact previously saved course together with the label
 * memberships it carried, for undoing a removal. A course that is already
 * present is left untouched, so restoring is safe to request more than once
 * for the same snapshot.
 */
export const restoreSavedCourse = (
  state: SavedListState,
  course: SavedCourse,
  memberships: ReadonlyArray<LabelMembership>,
): SavedListState => {
  if (state.savedCourses.some((existing) => existing.id === course.id)) return state;
  return {
    ...state,
    savedCourses: [...state.savedCourses, course],
    memberships: [...state.memberships, ...memberships],
  };
};

export const setSavedCourseNote = (
  state: SavedListState,
  identity: CourseIdentity,
  note: string,
): SavedListState => {
  const existing = findSavedCourse(state, identity);
  if (existing === null) return state;
  const next = normalizeNote(note);
  if (existing.note === next) return state;
  return {
    ...state,
    savedCourses: state.savedCourses.map((course) =>
      course.id === identity.savedCourseId ? { ...course, note: next } : course,
    ),
  };
};

export const labelNameMaxLength = 40;

/**
 * Labels are a small, human-curated set. The bound keeps the filter row and the
 * label dialog scannable, and it makes "how many can I have" answerable rather
 * than discovered by degradation.
 */
export const labelsMaxCount = 24;

const collapseWhitespace = (value: string): string => value.trim().replace(/\s+/gu, ' ');

const clampCodePoints = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const codePoints = Array.from(value);
  return codePoints.length > maxLength ? codePoints.slice(0, maxLength).join('') : value;
};

/**
 * The stored form of a label name: trimmed, inner whitespace collapsed, and
 * bounded by Unicode code points. Returns `null` when nothing is left, so an
 * unnamed label cannot be represented.
 */
export const normalizeLabelName = (name: string): string | null => {
  const collapsed = collapseWhitespace(name);
  if (collapsed.length === 0) return null;
  return clampCodePoints(collapsed, labelNameMaxLength);
};

/**
 * The documented comparison for label-name uniqueness: normalized, then
 * case-folded. `Ask adviser` and `ask  Adviser` are the same label name.
 */
export const labelNameKey = (name: string): string =>
  collapseWhitespace(name).toLocaleLowerCase('en');

export const findLabel = (state: SavedListState, labelId: string): Label | null =>
  state.labels.find((label) => label.id === labelId) ?? null;

export const findLabelByName = (state: SavedListState, name: string): Label | null => {
  const key = labelNameKey(name);
  return state.labels.find((label) => labelNameKey(label.name) === key) ?? null;
};

/** Labels in a stable, locale-aware display order that renaming re-sorts. */
export const labelsByName = (state: SavedListState): ReadonlyArray<Label> =>
  [...state.labels].sort((left, right) => left.name.localeCompare(right.name));

export const labelCourseCount = (state: SavedListState, labelId: string): number =>
  state.memberships.filter((membership) => membership.labelId === labelId).length;

export const labelIdsForSavedCourse = (
  state: SavedListState,
  identity: CourseIdentity,
): ReadonlyArray<string> =>
  state.memberships
    .filter((membership) => membership.savedCourseId === identity.savedCourseId)
    .map((membership) => membership.labelId);

/** The labels attached to one saved course, in the same order as the label set. */
export const labelsForSavedCourse = (
  state: SavedListState,
  identity: CourseIdentity,
): ReadonlyArray<Label> => {
  const attached = new Set(labelIdsForSavedCourse(state, identity));
  return labelsByName(state).filter((label) => attached.has(label.id));
};

export const hasLabel = (
  state: SavedListState,
  labelId: string,
  identity: CourseIdentity,
): boolean =>
  state.memberships.some(
    (membership) =>
      membership.labelId === labelId && membership.savedCourseId === identity.savedCourseId,
  );

export const labelRejections = [
  'empty-name',
  'duplicate-name',
  'limit-reached',
  'unknown-label',
] as const;

export type LabelRejection = (typeof labelRejections)[number];

/**
 * Label edits are total: every call answers with the new state, an explicit
 * "nothing to do", or a named reason the interface can translate. A rejection
 * is never silently swallowed and never partially applied.
 */
export type LabelResult =
  | { readonly _tag: 'LabelApplied'; readonly state: SavedListState }
  | { readonly _tag: 'LabelUnchanged' }
  | { readonly _tag: 'LabelRejected'; readonly reason: LabelRejection };

const labelApplied = (state: SavedListState): LabelResult => ({ _tag: 'LabelApplied', state });
const labelUnchanged: LabelResult = { _tag: 'LabelUnchanged' };
const labelRejected = (reason: LabelRejection): LabelResult => ({
  _tag: 'LabelRejected',
  reason,
});

/**
 * The rules for a new label, in one place. The application checks them before
 * asking the boundary for an id, and `createLabel` checks them again when the
 * id arrives, so a slow round trip cannot smuggle a duplicate past them.
 */
export const validateNewLabel = (state: SavedListState, name: string): LabelRejection | null => {
  const normalized = normalizeLabelName(name);
  if (normalized === null) return 'empty-name';
  if (findLabelByName(state, normalized) !== null) return 'duplicate-name';
  if (state.labels.length >= labelsMaxCount) return 'limit-reached';
  return null;
};

export const createLabel = (
  state: SavedListState,
  input: Readonly<{ id: string; name: string; color: LabelColor }>,
): LabelResult => {
  const rejection = validateNewLabel(state, input.name);
  if (rejection !== null) return labelRejected(rejection);
  const name = normalizeLabelName(input.name);
  if (name === null) return labelRejected('empty-name');
  if (findLabel(state, input.id) !== null) return labelUnchanged;
  return labelApplied({
    ...state,
    labels: [...state.labels, { id: input.id, name, color: input.color }],
  });
};

/** Renaming and recolouring one label is a single transition, so a form that
 *  changes both never lands as two observable states. Membership refers to the
 *  label identity, so every projection follows automatically. */
export const editLabel = (
  state: SavedListState,
  labelId: string,
  input: Readonly<{ name: string; color: LabelColor }>,
): LabelResult => {
  const existing = findLabel(state, labelId);
  if (existing === null) return labelRejected('unknown-label');
  const name = normalizeLabelName(input.name);
  if (name === null) return labelRejected('empty-name');
  const clash = findLabelByName(state, name);
  if (clash !== null && clash.id !== labelId) return labelRejected('duplicate-name');
  if (existing.name === name && existing.color === input.color) return labelUnchanged;
  return labelApplied({
    ...state,
    labels: state.labels.map((label) =>
      label.id === labelId ? { ...label, name, color: input.color } : label,
    ),
  });
};

/** Deleting a label deletes its memberships and nothing else: saved courses,
 *  notes, and other labels are untouched. */
export const deleteLabel = (state: SavedListState, labelId: string): LabelResult => {
  if (findLabel(state, labelId) === null) return labelRejected('unknown-label');
  return labelApplied({
    ...state,
    labels: state.labels.filter((label) => label.id !== labelId),
    memberships: state.memberships.filter((membership) => membership.labelId !== labelId),
  });
};

/**
 * Attaches one label to many saved courses. A course is never duplicated: the
 * membership pair is the only thing added, and an existing pair is left alone.
 * Unknown labels and unsaved courses are ignored rather than creating dangling
 * references.
 */
export const attachLabel = (
  state: SavedListState,
  labelId: string,
  identities: ReadonlyArray<CourseIdentity>,
): SavedListState => {
  if (findLabel(state, labelId) === null) return state;
  const additions = identities
    .filter((identity) => isSaved(state, identity) && !hasLabel(state, labelId, identity))
    .map((identity) => ({ savedCourseId: identity.savedCourseId, labelId }));
  const unique = additions.filter(
    (addition, index) =>
      additions.findIndex((other) => other.savedCourseId === addition.savedCourseId) === index,
  );
  if (unique.length === 0) return state;
  return { ...state, memberships: [...state.memberships, ...unique] };
};

export const detachLabel = (
  state: SavedListState,
  labelId: string,
  identities: ReadonlyArray<CourseIdentity>,
): SavedListState => {
  const targets = new Set(identities.map((identity) => identity.savedCourseId));
  const memberships = state.memberships.filter(
    (membership) => !(membership.labelId === labelId && targets.has(membership.savedCourseId)),
  );
  return memberships.length === state.memberships.length ? state : { ...state, memberships };
};

export const labelFilterModes = ['any', 'all'] as const;

export type LabelFilterMode = (typeof labelFilterModes)[number];

/**
 * The whole collection language: included labels combined by `any` or `all`,
 * minus excluded labels. Deliberately not recursive — there is no nesting, no
 * operator precedence, and no expression to parse.
 */
export interface LabelFilter {
  readonly includeLabelIds: ReadonlyArray<string>;
  readonly includeMode: LabelFilterMode;
  readonly excludeLabelIds: ReadonlyArray<string>;
}

export const emptyLabelFilter: LabelFilter = {
  includeLabelIds: [],
  includeMode: 'any',
  excludeLabelIds: [],
};

export const isLabelFilterActive = (filter: LabelFilter): boolean =>
  filter.includeLabelIds.length > 0 || filter.excludeLabelIds.length > 0;

export interface NormalizedLabelFilter {
  readonly filter: LabelFilter;
  /** Requested ids that no longer name a label; dropped and reported. */
  readonly unknownLabelIds: ReadonlyArray<string>;
  /** Ids requested as both included and excluded. Exclude wins, and the id is
   *  dropped from the included set so the view never shows an unexplained
   *  empty collection. */
  readonly contradictoryLabelIds: ReadonlyArray<string>;
}

const distinct = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  values.filter((value, index) => values.indexOf(value) === index);

export const normalizeLabelFilter = (
  state: SavedListState,
  filter: LabelFilter,
): NormalizedLabelFilter => {
  const known = new Set(state.labels.map((label) => label.id));
  const requested = distinct([...filter.includeLabelIds, ...filter.excludeLabelIds]);
  const unknownLabelIds = requested.filter((labelId) => !known.has(labelId));
  const excludeLabelIds = distinct(filter.excludeLabelIds).filter((labelId) => known.has(labelId));
  const excluded = new Set(excludeLabelIds);
  const includeCandidates = distinct(filter.includeLabelIds).filter((labelId) =>
    known.has(labelId),
  );
  const contradictoryLabelIds = includeCandidates.filter((labelId) => excluded.has(labelId));
  return {
    filter: {
      includeLabelIds: includeCandidates.filter((labelId) => !excluded.has(labelId)),
      includeMode: filter.includeMode,
      excludeLabelIds,
    },
    unknownLabelIds,
    contradictoryLabelIds,
  };
};

/**
 * Applies a filter to the canonical saved set. The order is always the
 * canonical newest-first order, so a collection is a view over one List rather
 * than a second container with its own ordering.
 */
export const filterSavedCourses = (
  state: SavedListState,
  filter: LabelFilter,
): ReadonlyArray<SavedCourse> => {
  const { filter: normalized } = normalizeLabelFilter(state, filter);
  const universe = savedCoursesNewestFirst(state);
  const attachedTo = (course: SavedCourse): Set<string> =>
    new Set(
      state.memberships
        .filter((membership) => membership.savedCourseId === course.id)
        .map((membership) => membership.labelId),
    );
  return universe.filter((course) => {
    const attached = attachedTo(course);
    if (normalized.excludeLabelIds.some((labelId) => attached.has(labelId))) return false;
    if (normalized.includeLabelIds.length === 0) return true;
    return normalized.includeMode === 'all'
      ? normalized.includeLabelIds.every((labelId) => attached.has(labelId))
      : normalized.includeLabelIds.some((labelId) => attached.has(labelId));
  });
};

/**
 * Including a label that is currently excluded moves it rather than creating a
 * contradiction, so the interactive path can never build one; only a shared or
 * stale URL can, and `normalizeLabelFilter` reports that visibly.
 */
export const toggleIncludeLabel = (filter: LabelFilter, labelId: string): LabelFilter =>
  filter.includeLabelIds.includes(labelId)
    ? { ...filter, includeLabelIds: filter.includeLabelIds.filter((id) => id !== labelId) }
    : {
        ...filter,
        includeLabelIds: [...filter.includeLabelIds, labelId],
        excludeLabelIds: filter.excludeLabelIds.filter((id) => id !== labelId),
      };

/**
 * Sets whether a label is excluded, rather than toggling relative to the
 * current filter, so a duplicate identical message — for instance a Checkbox
 * click that bubbles from the control to its wrapping label and fires twice —
 * cannot flip it back off. Excluding moves the label out of Include (the last
 * explicit action wins) and is a no-op if it is already excluded and not
 * included; un-excluding is a no-op if it was not excluded.
 */
export const setLabelExcluded = (
  filter: LabelFilter,
  labelId: string,
  isExcluded: boolean,
): LabelFilter => {
  if (!isExcluded) {
    return filter.excludeLabelIds.includes(labelId)
      ? { ...filter, excludeLabelIds: filter.excludeLabelIds.filter((id) => id !== labelId) }
      : filter;
  }
  if (filter.excludeLabelIds.includes(labelId) && !filter.includeLabelIds.includes(labelId)) {
    return filter;
  }
  return {
    ...filter,
    excludeLabelIds: filter.excludeLabelIds.includes(labelId)
      ? filter.excludeLabelIds
      : [...filter.excludeLabelIds, labelId],
    includeLabelIds: filter.includeLabelIds.filter((id) => id !== labelId),
  };
};

export const setLabelFilterMode = (filter: LabelFilter, mode: LabelFilterMode): LabelFilter =>
  filter.includeMode === mode ? filter : { ...filter, includeMode: mode };

export const serializeSavedList = (state: SavedListState): string => JSON.stringify(state);

export const SavedListEmpty = ts('SavedListEmpty');
export const SavedListLoaded = ts('SavedListLoaded', {
  state: SavedListStateSchema,
  repairedEntries: S.Number,
});
export const SavedListUnsupported = ts('SavedListUnsupported', {
  storedVersion: S.NullOr(S.Number),
  raw: S.String,
});
export const SavedListCorrupt = ts('SavedListCorrupt', {
  reason: S.String,
  raw: S.String,
});

export const SavedListLoadSchema = S.Union([
  SavedListEmpty,
  SavedListLoaded,
  SavedListUnsupported,
  SavedListCorrupt,
]);

export type SavedListLoad =
  | ReturnType<typeof SavedListEmpty>
  | {
      readonly _tag: 'SavedListLoaded';
      readonly state: SavedListState;
      readonly repairedEntries: number;
    }
  | ReturnType<typeof SavedListUnsupported>
  | ReturnType<typeof SavedListCorrupt>;

/**
 * Migrations from released older schema versions. Schema version 1 is the
 * first released shape, so the table is empty: an older or unknown version is
 * reported as unsupported rather than reinterpreted as the current one.
 */
const migrations: Readonly<Record<number, (value: unknown) => unknown>> = {};

interface RepairedList {
  readonly state: SavedListState;
  readonly repairedEntries: number;
}

/**
 * Schema decoding cannot express referential integrity. Anything that survives
 * decoding but breaks an invariant is dropped and counted so the interface can
 * report it instead of silently serving inconsistent state.
 */
const repairSavedList = (state: SavedListState): RepairedList => {
  let repairedEntries = 0;
  const savedCourses: Array<SavedCourse> = [];
  const seenCourseIds = new Set<string>();

  for (const course of state.savedCourses) {
    const identity = courseIdentity(course.courseCode);
    if (identity === null || identity.savedCourseId !== course.id) {
      repairedEntries += 1;
      continue;
    }
    if (seenCourseIds.has(course.id)) {
      repairedEntries += 1;
      continue;
    }
    seenCourseIds.add(course.id);
    const note = course.note === null ? null : normalizeNote(course.note);
    if (note !== course.note) repairedEntries += 1;
    savedCourses.push(note === course.note ? course : { ...course, note });
  }

  const labels: Array<Label> = [];
  const seenLabelIds = new Set<string>();
  const seenLabelNames = new Set<string>();

  for (const label of state.labels) {
    const name = label.name.trim();
    if (name.length === 0 || seenLabelIds.has(label.id) || seenLabelNames.has(name.toLowerCase())) {
      repairedEntries += 1;
      continue;
    }
    seenLabelIds.add(label.id);
    seenLabelNames.add(name.toLowerCase());
    labels.push(name === label.name ? label : { ...label, name });
  }

  const memberships: Array<LabelMembership> = [];
  const seenMemberships = new Set<string>();

  for (const membership of state.memberships) {
    const key = `${membership.savedCourseId} ${membership.labelId}`;
    if (
      !seenCourseIds.has(membership.savedCourseId) ||
      !seenLabelIds.has(membership.labelId) ||
      seenMemberships.has(key)
    ) {
      repairedEntries += 1;
      continue;
    }
    seenMemberships.add(key);
    memberships.push(membership);
  }

  return {
    state:
      repairedEntries === 0
        ? state
        : { version: savedListSchemaVersion, savedCourses, labels, memberships },
    repairedEntries,
  };
};

const decodeSavedList = S.decodeUnknownResult(SavedListStateSchema);

const storedVersionOf = (value: unknown): number | null => {
  if (typeof value !== 'object' || value === null) return null;
  const version = (value as { readonly version?: unknown }).version;
  return typeof version === 'number' && Number.isInteger(version) && version > 0 ? version : null;
};

/**
 * Parses persisted state. The raw value is preserved on every failure path so
 * the interface can offer export or an explicit, destructive reset instead of
 * overwriting data it could not read.
 */
export const parseSavedList = (raw: string | null): SavedListLoad => {
  if (raw === null || raw.trim().length === 0) return SavedListEmpty();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return SavedListCorrupt({ reason: 'invalid-json', raw });
  }

  const storedVersion = storedVersionOf(parsed);
  if (storedVersion === null) {
    return SavedListCorrupt({ reason: 'missing-version', raw });
  }
  if (storedVersion > savedListSchemaVersion) {
    return SavedListUnsupported({ storedVersion, raw });
  }

  let candidate = parsed;
  for (let version = storedVersion; version < savedListSchemaVersion; version += 1) {
    const migration = migrations[version];
    if (migration === undefined) return SavedListUnsupported({ storedVersion, raw });
    candidate = migration(candidate);
  }

  const decoded = decodeSavedList(candidate);
  if (Result.isFailure(decoded)) {
    return SavedListCorrupt({ reason: 'invalid-shape', raw });
  }

  const repaired = repairSavedList(decoded.success);
  return SavedListLoaded({
    state: repaired.state,
    repairedEntries: repaired.repairedEntries,
  });
};
