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
