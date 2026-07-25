import { expect, test } from 'vitest';

import {
  attachLabel,
  courseIdentity,
  createLabel,
  deleteLabel,
  detachLabel,
  editLabel,
  defaultLabelColor,
  emptyLabelFilter,
  emptySavedList,
  filterLabel,
  filterUnlabeled,
  filterSavedCourses,
  findSavedCourse,
  hasLabel,
  isLabelFilterActive,
  isSaved,
  labelColors,
  labelCourseCount,
  labelIdsForSavedCourse,
  labelNameKey,
  labelNameMaxLength,
  labelsByName,
  labelsForSavedCourse,
  labelsMaxCount,
  membershipsForSavedCourse,
  normalizeLabelFilter,
  normalizeLabelName,
  noteMaxLength,
  parseSavedList,
  removeSavedCourse,
  restoreSavedCourse,
  savedCoursesNewestFirst,
  saveCourse,
  serializeSavedList,
  savedListSchemaVersion,
  setLabelFilterMode,
  setPredicateExcluded,
  setPredicateIncluded,
  setSavedCourseNote,
  unlabeledCourseCount,
  validateLabelEdit,
  type LabelFilter,
  type LabelResult,
  type SavedListState,
  compareCourses,
  compareSelection,
  collectionsByName,
  deleteCollection,
  matchingCollection,
  saveCollection,
} from './saved-courses';

const tdt4136 = courseIdentity('TDT4136')!;
const tma4100 = courseIdentity('tma4100')!;

const savedAt = '2026-07-24T10:00:00.000Z';

test('course identity normalizes NTNU codes and rejects unusable input', () => {
  expect(courseIdentity(' tdt4136 ')).toEqual({
    institutionId: 'ntnu',
    courseCode: 'TDT4136',
    savedCourseId: 'ntnu:TDT4136',
  });
  expect(courseIdentity('MA')?.courseCode).toBe('MA');
  expect(courseIdentity('')).toBeNull();
  expect(courseIdentity('X')).toBeNull();
  expect(courseIdentity('TDT 4136')).toBeNull();
  expect(courseIdentity('TDT4136;DROP')).toBeNull();
  expect(courseIdentity('T'.repeat(21))).toBeNull();
});

test('saving a course stores an identity reference rather than course facts', () => {
  const saved = saveCourse(emptySavedList, tdt4136, savedAt);
  const course = findSavedCourse(saved, tdt4136);

  expect(course).toEqual({
    id: 'ntnu:TDT4136',
    institutionId: 'ntnu',
    courseCode: 'TDT4136',
    savedAt,
    note: null,
    observedDataRevision: null,
  });
  expect(Object.keys(course ?? {})).not.toContain('title');
});

test('saving is idempotent and does not duplicate the identity', () => {
  const saved = saveCourse(emptySavedList, tdt4136, savedAt);
  const again = saveCourse(saved, tdt4136, '2026-07-25T10:00:00.000Z');

  expect(again).toBe(saved);
  expect(again.savedCourses).toHaveLength(1);
  expect(again.savedCourses[0]?.savedAt).toBe(savedAt);
});

test('removing a saved course clears its label memberships in the same transition', () => {
  const withLabel: SavedListState = {
    version: savedListSchemaVersion,
    collections: [],
    savedCourses: [
      {
        id: 'ntnu:TDT4136',
        institutionId: 'ntnu',
        courseCode: 'TDT4136',
        savedAt,
        note: 'Ask adviser',
        observedDataRevision: null,
      },
    ],
    labels: [{ id: 'label-1', name: 'Autumn 2027', color: 'sky' }],
    memberships: [{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' }],
  };

  expect(membershipsForSavedCourse(withLabel, tdt4136)).toHaveLength(1);

  const removed = removeSavedCourse(withLabel, tdt4136);

  expect(isSaved(removed, tdt4136)).toBe(false);
  expect(removed.memberships).toEqual([]);
  expect(removed.labels).toEqual(withLabel.labels);
  expect(removeSavedCourse(removed, tdt4136)).toBe(removed);
});

test('notes are student-authored text that is trimmed, bounded, and clearable', () => {
  const saved = saveCourse(emptySavedList, tdt4136, savedAt);
  const noted = setSavedCourseNote(saved, tdt4136, '  Clashes with TMA4100  ');
  expect(findSavedCourse(noted, tdt4136)?.note).toBe('Clashes with TMA4100');

  const bounded = setSavedCourseNote(noted, tdt4136, 'x'.repeat(noteMaxLength + 50));
  expect(findSavedCourse(bounded, tdt4136)?.note).toHaveLength(noteMaxLength);

  const cleared = setSavedCourseNote(bounded, tdt4136, '   ');
  expect(findSavedCourse(cleared, tdt4136)?.note).toBeNull();

  expect(setSavedCourseNote(cleared, tdt4136, '')).toBe(cleared);
  expect(setSavedCourseNote(emptySavedList, tdt4136, 'note')).toBe(emptySavedList);
});

test('note truncation cuts on a Unicode code point and never splits a surrogate pair', () => {
  const prefix = 'x'.repeat(noteMaxLength - 1);
  const saved = saveCourse(emptySavedList, tdt4136, savedAt);

  const noted = setSavedCourseNote(saved, tdt4136, `${prefix}😀tail`);
  const note = findSavedCourse(noted, tdt4136)?.note ?? '';

  expect(note).toBe(`${prefix}😀`);
  expect(Array.from(note)).toHaveLength(noteMaxLength);
  expect(note).not.toMatch(/[\uD800-\uDBFF]$/);
});

test('a course restored after removal keeps its exact identity, note, and label memberships', () => {
  const withLabel: SavedListState = {
    version: savedListSchemaVersion,
    collections: [],
    savedCourses: [
      {
        id: 'ntnu:TDT4136',
        institutionId: 'ntnu',
        courseCode: 'TDT4136',
        savedAt,
        note: 'Ask adviser',
        observedDataRevision: null,
      },
    ],
    labels: [{ id: 'label-1', name: 'Autumn 2027', color: 'sky' }],
    memberships: [{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' }],
  };
  const course = withLabel.savedCourses[0]!;
  const memberships = membershipsForSavedCourse(withLabel, tdt4136);
  const removed = removeSavedCourse(withLabel, tdt4136);

  const restored = restoreSavedCourse(removed, course, memberships);

  expect(restored).toEqual(withLabel);
  expect(findSavedCourse(restored, tdt4136)?.note).toBe('Ask adviser');
  expect(membershipsForSavedCourse(restored, tdt4136)).toEqual(memberships);

  expect(restoreSavedCourse(restored, course, memberships)).toBe(restored);
});

test('saved courses are ordered newest first with a stable tiebreaker', () => {
  const first = saveCourse(emptySavedList, tdt4136, '2026-07-24T10:00:00.000Z');
  const second = saveCourse(first, tma4100, '2026-07-25T10:00:00.000Z');

  expect(savedCoursesNewestFirst(second).map((course) => course.courseCode)).toEqual([
    'TMA4100',
    'TDT4136',
  ]);
});

test('a stored list round-trips through serialization', () => {
  const saved = setSavedCourseNote(saveCourse(emptySavedList, tdt4136, savedAt), tdt4136, 'Keep');
  const load = parseSavedList(serializeSavedList(saved));

  expect(load).toMatchObject({ _tag: 'SavedListLoaded', repairedEntries: 0 });
  expect(load._tag === 'SavedListLoaded' ? load.state : null).toEqual(saved);
});

test('absent storage is an empty list rather than a recovery state', () => {
  expect(parseSavedList(null)._tag).toBe('SavedListEmpty');
  expect(parseSavedList('   ')._tag).toBe('SavedListEmpty');
});

test('unreadable stored values are corrupt and keep the raw value for recovery', () => {
  expect(parseSavedList('{not json')).toMatchObject({
    _tag: 'SavedListCorrupt',
    reason: 'invalid-json',
    raw: '{not json',
  });
  expect(parseSavedList('"a string"')).toMatchObject({
    _tag: 'SavedListCorrupt',
    reason: 'missing-version',
  });
  expect(parseSavedList(JSON.stringify({ savedCourses: [] }))).toMatchObject({
    _tag: 'SavedListCorrupt',
    reason: 'missing-version',
  });
  expect(
    parseSavedList(JSON.stringify({ version: 1, savedCourses: [{ id: 'ntnu:TDT4136' }] })),
  ).toMatchObject({ _tag: 'SavedListCorrupt', reason: 'invalid-shape' });
});

test('a future or unmigratable version is never reinterpreted as the current one', () => {
  const future = JSON.stringify({
    version: savedListSchemaVersion + 1,
    savedCourses: [],
    labels: [],
    memberships: [],
  });
  expect(parseSavedList(future)).toMatchObject({
    _tag: 'SavedListUnsupported',
    storedVersion: savedListSchemaVersion + 1,
    raw: future,
  });

  const older = JSON.stringify({ version: 0.5 });
  expect(parseSavedList(older)).toMatchObject({ _tag: 'SavedListCorrupt' });
});

const version1WithColor = (color: unknown): string =>
  JSON.stringify({
    version: 1,
    savedCourses: [
      {
        id: 'ntnu:TDT4136',
        institutionId: 'ntnu',
        courseCode: 'TDT4136',
        savedAt,
        note: null,
        observedDataRevision: null,
      },
    ],
    labels: [{ id: 'label-1', name: 'Autumn 2027', color }],
    memberships: [{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' }],
  });

test('a stored version 1 label colour of blue is migrated to sky, keeping its memberships', () => {
  const load = parseSavedList(version1WithColor('blue'));

  expect(load._tag).toBe('SavedListLoaded');
  if (load._tag !== 'SavedListLoaded') return;
  expect(load.state.version).toBe(savedListSchemaVersion);
  expect(load.state.labels).toEqual([{ id: 'label-1', name: 'Autumn 2027', color: 'sky' }]);
  expect(load.state.memberships).toEqual([{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' }]);
  // The rewrite is a migration, not a repair: nothing was discarded.
  expect(load.repairedEntries).toBe(0);
});

test('migrating version 1 leaves every colour that survived the palette untouched', () => {
  for (const color of labelColors) {
    const load = parseSavedList(version1WithColor(color));
    expect(load._tag).toBe('SavedListLoaded');
    if (load._tag !== 'SavedListLoaded') continue;
    expect(load.state.labels[0]?.color).toBe(color);
  }
});

test('new state never writes the retired colour, and version 2 cannot express it', () => {
  expect(labelColors).not.toContain('blue');
  expect(defaultLabelColor).toBe('sky');
  expect(emptySavedList.version).toBe(savedListSchemaVersion);

  // A stored value that claims to be the current version and still carries the
  // retired colour is corrupt, not silently migrated: version 2 never wrote it.
  const forged = version1WithColor('blue').replace('"version":1', '"version":2');
  expect(parseSavedList(forged)).toMatchObject({ _tag: 'SavedListCorrupt' });
});

test('version 1 shapes the migration cannot understand still reach the schema, not a crash', () => {
  for (const raw of [
    '{"version":1}',
    '{"version":1,"labels":"not an array","savedCourses":[],"memberships":[]}',
    '{"version":1,"labels":[null,7,{"color":"blue"}],"savedCourses":[],"memberships":[]}',
  ]) {
    expect(parseSavedList(raw)).toMatchObject({
      _tag: 'SavedListCorrupt',
      reason: 'invalid-shape',
    });
  }
});

test('decoded state that breaks an invariant is repaired and the repair is reported', () => {
  const damaged = JSON.stringify({
    version: 1,
    savedCourses: [
      {
        id: 'ntnu:TDT4136',
        institutionId: 'ntnu',
        courseCode: 'TDT4136',
        savedAt,
        note: null,
        observedDataRevision: null,
      },
      {
        id: 'ntnu:TDT4136',
        institutionId: 'ntnu',
        courseCode: 'TDT4136',
        savedAt,
        note: null,
        observedDataRevision: null,
      },
      {
        id: 'ntnu:not a code',
        institutionId: 'ntnu',
        courseCode: 'not a code',
        savedAt,
        note: null,
        observedDataRevision: null,
      },
    ],
    labels: [{ id: 'label-1', name: 'Autumn 2027', color: 'sky' }],
    memberships: [
      { savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' },
      { savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' },
      { savedCourseId: 'ntnu:TMA4100', labelId: 'label-1' },
      { savedCourseId: 'ntnu:TDT4136', labelId: 'label-missing' },
    ],
  });

  const load = parseSavedList(damaged);

  expect(load._tag).toBe('SavedListLoaded');
  if (load._tag !== 'SavedListLoaded') return;
  expect(load.repairedEntries).toBe(5);
  expect(load.state.savedCourses).toHaveLength(1);
  expect(load.state.memberships).toEqual([{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' }]);
});

test('note normalization during repair is counted and written back', () => {
  const raw = JSON.stringify({
    version: 1,
    savedCourses: [
      {
        id: 'ntnu:TDT4136',
        institutionId: 'ntnu',
        courseCode: 'TDT4136',
        savedAt,
        note: '  Ask adviser  ',
        observedDataRevision: null,
      },
    ],
    labels: [],
    memberships: [],
  });

  const load = parseSavedList(raw);

  expect(load._tag).toBe('SavedListLoaded');
  if (load._tag !== 'SavedListLoaded') return;
  expect(load.repairedEntries).toBe(1);
  expect(load.state.savedCourses[0]?.note).toBe('Ask adviser');
});

const sky = 'sky' as const;

const withCourses = (...codes: ReadonlyArray<string>): SavedListState =>
  codes.reduce(
    (state, code, index) =>
      saveCourse(state, courseIdentity(code)!, `2026-07-2${index + 1}T10:00:00.000Z`),
    emptySavedList,
  );

const applied = (result: LabelResult): SavedListState => {
  if (result._tag !== 'LabelApplied') throw new Error(`expected LabelApplied, got ${result._tag}`);
  return result.state;
};

test('label names are normalized and compared case- and whitespace-insensitively', () => {
  expect(normalizeLabelName('  Autumn   2027 ')).toBe('Autumn 2027');
  expect(normalizeLabelName('   ')).toBeNull();
  expect(normalizeLabelName('x'.repeat(labelNameMaxLength + 10))).toHaveLength(labelNameMaxLength);
  expect(labelNameKey('Ask  ADVISER')).toBe(labelNameKey('ask adviser'));
});

test('creating a label keeps a stable id and rejects a duplicate name visibly', () => {
  const created = applied(
    createLabel(emptySavedList, { id: 'label-1', name: '  Autumn 2027 ', color: sky }),
  );

  expect(created.labels).toEqual([{ id: 'label-1', name: 'Autumn 2027', color: sky }]);
  expect(createLabel(created, { id: 'label-2', name: 'autumn  2027', color: 'rose' })).toEqual({
    _tag: 'LabelRejected',
    reason: 'duplicate-name',
  });
  expect(createLabel(created, { id: 'label-2', name: '  ', color: 'rose' })).toEqual({
    _tag: 'LabelRejected',
    reason: 'empty-name',
  });
  expect(createLabel(created, { id: 'label-1', name: 'Another', color: 'rose' })).toEqual({
    _tag: 'LabelUnchanged',
  });
});

test('the label set is bounded and the limit is reported rather than silently ignored', () => {
  const full = Array.from({ length: labelsMaxCount }, (_, index) => index).reduce(
    (state, index) =>
      applied(createLabel(state, { id: `label-${index}`, name: `L${index}`, color: sky })),
    emptySavedList,
  );

  expect(full.labels).toHaveLength(labelsMaxCount);
  expect(createLabel(full, { id: 'one-more', name: 'One more', color: sky })).toEqual({
    _tag: 'LabelRejected',
    reason: 'limit-reached',
  });
});

test('renaming and recolouring is one transition and keeps the identity memberships use', () => {
  const state = withCourses('TDT4136');
  const labelled = attachLabel(
    applied(createLabel(state, { id: 'label-1', name: 'Autumn 2027', color: sky })),
    'label-1',
    [tdt4136],
  );

  const edited = applied(editLabel(labelled, 'label-1', { name: 'Spring 2028', color: 'emerald' }));

  expect(edited.labels).toEqual([{ id: 'label-1', name: 'Spring 2028', color: 'emerald' }]);
  expect(edited.memberships).toEqual(labelled.memberships);
  expect(labelsForSavedCourse(edited, tdt4136).map((label) => label.name)).toEqual(['Spring 2028']);
  expect(editLabel(edited, 'label-1', { name: 'Spring 2028', color: 'emerald' })).toEqual({
    _tag: 'LabelUnchanged',
  });
  expect(editLabel(edited, 'missing', { name: 'Any', color: sky })).toEqual({
    _tag: 'LabelRejected',
    reason: 'unknown-label',
  });
});

test('the edit rules are one source of truth: validation and the transition always agree', () => {
  const two = applied(
    createLabel(
      applied(createLabel(emptySavedList, { id: 'a', name: 'Ask adviser', color: sky })),
      { id: 'b', name: 'Autumn 2027', color: 'rose' },
    ),
  );

  for (const [labelId, name, expected] of [
    ['a', 'Ask adviser', null],
    ['a', 'Renamed', null],
    ['a', '   ', 'empty-name'],
    ['a', 'autumn  2027', 'duplicate-name'],
    ['gone', 'Anything', 'unknown-label'],
  ] as const) {
    expect(validateLabelEdit(two, labelId, name)).toBe(expected);
    const applyResult = editLabel(two, labelId, { name, color: sky });
    expect(applyResult._tag === 'LabelRejected' ? applyResult.reason : null).toBe(expected);
  }
});

test('renaming onto another existing name is rejected, renaming onto its own name is allowed', () => {
  const two = applied(
    createLabel(
      applied(createLabel(emptySavedList, { id: 'a', name: 'Ask adviser', color: sky })),
      {
        id: 'b',
        name: 'Remote',
        color: 'rose',
      },
    ),
  );

  expect(editLabel(two, 'b', { name: 'ask adviser', color: 'rose' })).toEqual({
    _tag: 'LabelRejected',
    reason: 'duplicate-name',
  });
  expect(applied(editLabel(two, 'b', { name: 'Remote', color: 'sky' })).labels).toEqual([
    { id: 'a', name: 'Ask adviser', color: sky },
    { id: 'b', name: 'Remote', color: 'sky' },
  ]);
});

test('deleting a label deletes its memberships and leaves courses and other labels intact', () => {
  const state = withCourses('TDT4136', 'TMA4100');
  const withLabels = attachLabel(
    attachLabel(
      applied(
        createLabel(applied(createLabel(state, { id: 'a', name: 'A', color: sky })), {
          id: 'b',
          name: 'B',
          color: 'rose',
        }),
      ),
      'a',
      [tdt4136, tma4100],
    ),
    'b',
    [tdt4136],
  );

  const deleted = applied(deleteLabel(withLabels, 'a'));

  expect(deleted.labels.map((label) => label.id)).toEqual(['b']);
  expect(deleted.savedCourses).toHaveLength(2);
  expect(deleted.memberships).toEqual([{ savedCourseId: 'ntnu:TDT4136', labelId: 'b' }]);
  expect(deleteLabel(deleted, 'a')).toEqual({ _tag: 'LabelRejected', reason: 'unknown-label' });
});

test('attaching one label to many courses never duplicates a course or a membership', () => {
  const state = withCourses('TDT4136', 'TMA4100');
  const withLabel = applied(createLabel(state, { id: 'a', name: 'A', color: sky }));

  const attached = attachLabel(withLabel, 'a', [tdt4136, tma4100, tdt4136]);

  expect(attached.savedCourses).toHaveLength(2);
  expect(attached.memberships).toEqual([
    { savedCourseId: 'ntnu:TDT4136', labelId: 'a' },
    { savedCourseId: 'ntnu:TMA4100', labelId: 'a' },
  ]);
  expect(attachLabel(attached, 'a', [tdt4136, tma4100])).toBe(attached);
  expect(attachLabel(attached, 'missing', [tdt4136])).toBe(attached);
  expect(attachLabel(withLabel, 'a', [courseIdentity('IT1901')!])).toBe(withLabel);
});

test('detaching removes only the requested pairs', () => {
  const state = withCourses('TDT4136', 'TMA4100');
  const attached = attachLabel(
    applied(createLabel(state, { id: 'a', name: 'A', color: sky })),
    'a',
    [tdt4136, tma4100],
  );

  const detached = detachLabel(attached, 'a', [tdt4136]);

  expect(detached.memberships).toEqual([{ savedCourseId: 'ntnu:TMA4100', labelId: 'a' }]);
  expect(hasLabel(detached, 'a', tdt4136)).toBe(false);
  expect(hasLabel(detached, 'a', tma4100)).toBe(true);
  expect(detachLabel(detached, 'a', [tdt4136])).toBe(detached);
});

test('label counts and per-course label lists are derived from memberships', () => {
  const state = withCourses('TDT4136', 'TMA4100');
  const withLabels = attachLabel(
    attachLabel(
      applied(
        createLabel(applied(createLabel(state, { id: 'a', name: 'Zeta', color: sky })), {
          id: 'b',
          name: 'Alpha',
          color: 'rose',
        }),
      ),
      'a',
      [tdt4136, tma4100],
    ),
    'b',
    [tdt4136],
  );

  expect(labelCourseCount(withLabels, 'a')).toBe(2);
  expect(labelCourseCount(withLabels, 'b')).toBe(1);
  expect(labelsByName(withLabels).map((label) => label.name)).toEqual(['Alpha', 'Zeta']);
  expect(labelsForSavedCourse(withLabels, tdt4136).map((label) => label.name)).toEqual([
    'Alpha',
    'Zeta',
  ]);
  expect(labelIdsForSavedCourse(withLabels, tma4100)).toEqual(['a']);
});

const collectionState = (): SavedListState => {
  const base = withCourses('TDT4136', 'TMA4100', 'IT1901');
  const withLabels = ['ai', 'heavy', 'taken'].reduce(
    (state, id) => applied(createLabel(state, { id, name: id.toUpperCase(), color: sky })),
    base,
  );
  const it1901 = courseIdentity('IT1901')!;
  return attachLabel(
    attachLabel(attachLabel(withLabels, 'ai', [tdt4136, it1901]), 'heavy', [tdt4136, tma4100]),
    'taken',
    [it1901],
  );
};

const filter = (patch: Partial<LabelFilter> = {}): LabelFilter => ({
  ...emptyLabelFilter,
  ...patch,
});

test('no included predicates yields the whole canonical List in canonical order', () => {
  const state = collectionState();

  expect(filterSavedCourses(state, emptyLabelFilter).map((course) => course.courseCode)).toEqual(
    savedCoursesNewestFirst(state).map((course) => course.courseCode),
  );
  expect(isLabelFilterActive(emptyLabelFilter)).toBe(false);
});

test('Any is the union, All is the intersection, and Exclude subtracts from either', () => {
  const state = collectionState();
  const codes = (patch: Partial<LabelFilter>) =>
    filterSavedCourses(state, filter(patch)).map((course) => course.courseCode);

  expect(codes({ includeLabelIds: ['ai', 'heavy'], includeMode: 'any' })).toEqual([
    'IT1901',
    'TMA4100',
    'TDT4136',
  ]);
  expect(codes({ includeLabelIds: ['ai', 'heavy'], includeMode: 'all' })).toEqual(['TDT4136']);
  expect(
    codes({ includeLabelIds: ['ai', 'heavy'], includeMode: 'any', excludeLabelIds: ['taken'] }),
  ).toEqual(['TMA4100', 'TDT4136']);
  expect(codes({ excludeLabelIds: ['ai'] })).toEqual(['TMA4100']);
});

const withUnlabeledCourse = (): SavedListState => {
  const state = collectionState();
  return saveCourse(state, courseIdentity('MA1101')!, '2026-07-28T10:00:00.000Z');
};

test('Unlabeled is derived from membership: it is exactly the saved courses with no label', () => {
  const state = withUnlabeledCourse();
  const codes = (patch: Partial<LabelFilter>) =>
    filterSavedCourses(state, filter(patch)).map((course) => course.courseCode);

  expect(unlabeledCourseCount(state)).toBe(1);
  expect(codes({ includeUnlabeled: true })).toEqual(['MA1101']);

  // Including it under Any unions it with the selected label sets.
  expect(codes({ includeLabelIds: ['taken'], includeUnlabeled: true, includeMode: 'any' })).toEqual(
    ['MA1101', 'IT1901'],
  );

  // Excluding it means labelled courses only.
  expect(codes({ excludeUnlabeled: true })).toEqual(['IT1901', 'TMA4100', 'TDT4136']);

  // Attaching a label removes the course from the derived set; no membership of
  // its own was ever created.
  const labelled = attachLabel(state, 'ai', [courseIdentity('MA1101')!]);
  expect(unlabeledCourseCount(labelled)).toBe(0);
  expect(filterSavedCourses(labelled, filter({ includeUnlabeled: true }))).toEqual([]);
});

test('All of Unlabeled and a real label is unsatisfiable, reported rather than silently empty', () => {
  const state = withUnlabeledCourse();
  const requested = filter({
    includeLabelIds: ['ai'],
    includeUnlabeled: true,
    includeMode: 'all',
  });
  const normalized = normalizeLabelFilter(state, requested);

  expect(normalized.isUnsatisfiable).toBe(true);
  // The recipe is kept exactly as asked, so the interface explains it instead of
  // presenting a rewritten filter the student did not choose.
  expect(normalized.filter).toEqual(requested);
  expect(filterSavedCourses(state, requested)).toEqual([]);

  // The same predicates under Any are perfectly satisfiable, and All without a
  // real label is just the derived set.
  expect(normalizeLabelFilter(state, { ...requested, includeMode: 'any' }).isUnsatisfiable).toBe(
    false,
  );
  expect(
    normalizeLabelFilter(state, filter({ includeUnlabeled: true, includeMode: 'all' }))
      .isUnsatisfiable,
  ).toBe(false);
});

test('Unlabeled included and excluded at once resolves with exclude winning and is reported', () => {
  const state = withUnlabeledCourse();
  const normalized = normalizeLabelFilter(
    state,
    filter({ includeUnlabeled: true, excludeUnlabeled: true }),
  );

  expect(normalized.contradictoryUnlabeled).toBe(true);
  expect(normalized.filter).toEqual(filter({ excludeUnlabeled: true }));
  expect(
    filterSavedCourses(state, filter({ includeUnlabeled: true, excludeUnlabeled: true })).map(
      (course) => course.courseCode,
    ),
  ).toEqual(['IT1901', 'TMA4100', 'TDT4136']);
});

test('an included label that is also excluded is resolved with exclude winning and reported', () => {
  const state = collectionState();
  const requested = filter({
    includeLabelIds: ['ai', 'heavy'],
    includeMode: 'all',
    excludeLabelIds: ['heavy'],
  });
  const normalized = normalizeLabelFilter(state, requested);

  expect(normalized.filter).toEqual(
    filter({ includeLabelIds: ['ai'], includeMode: 'all', excludeLabelIds: ['heavy'] }),
  );
  expect(normalized.contradictoryLabelIds).toEqual(['heavy']);
  expect(normalized.unknownLabelIds).toEqual([]);
  expect(filterSavedCourses(state, requested).map((course) => course.courseCode)).toEqual([
    'IT1901',
  ]);
});

test('filter ids that no longer name a label are dropped and disclosed, not treated as empty', () => {
  const state = collectionState();
  const normalized = normalizeLabelFilter(
    state,
    filter({ includeLabelIds: ['ai', 'gone', 'ai'], excludeLabelIds: ['also-gone'] }),
  );

  expect(normalized.filter).toEqual(filter({ includeLabelIds: ['ai'] }));
  expect(normalized.unknownLabelIds).toEqual(['gone', 'also-gone']);
});

test('inclusion is a set, not a relative toggle, so a duplicate message cannot undo it', () => {
  const ai = filterLabel('ai');
  const included = setPredicateIncluded(emptyLabelFilter, ai, true);
  expect(included).toEqual(filter({ includeLabelIds: ['ai'] }));

  // A duplicate identical message — a bubbled click, or a stale history echo
  // arriving after a second chip was pressed — asks for the same state again.
  expect(setPredicateIncluded(included, ai, true)).toBe(included);

  const excluded = setPredicateExcluded(included, ai, true);
  expect(excluded).toEqual(filter({ excludeLabelIds: ['ai'] }));
  expect(setPredicateExcluded(excluded, ai, true)).toBe(excluded);

  // Including moves it back out of Exclude: the last explicit action wins.
  const backToInclude = setPredicateIncluded(excluded, ai, true);
  expect(backToInclude).toEqual(filter({ includeLabelIds: ['ai'] }));

  expect(setPredicateIncluded(backToInclude, ai, false)).toEqual(emptyLabelFilter);
  expect(setPredicateIncluded(emptyLabelFilter, ai, false)).toBe(emptyLabelFilter);
  expect(setPredicateExcluded(emptyLabelFilter, ai, false)).toBe(emptyLabelFilter);
  expect(setLabelFilterMode(backToInclude, 'all').includeMode).toBe('all');
  expect(setLabelFilterMode(backToInclude, 'any')).toBe(backToInclude);
});

test('Unlabeled moves between Include and Exclude under the same rules as a label', () => {
  const included = setPredicateIncluded(emptyLabelFilter, filterUnlabeled, true);
  expect(included).toEqual(filter({ includeUnlabeled: true }));
  expect(setPredicateIncluded(included, filterUnlabeled, true)).toBe(included);

  const excluded = setPredicateExcluded(included, filterUnlabeled, true);
  expect(excluded).toEqual(filter({ excludeUnlabeled: true }));
  expect(setPredicateExcluded(excluded, filterUnlabeled, true)).toBe(excluded);

  const back = setPredicateIncluded(excluded, filterUnlabeled, true);
  expect(back).toEqual(filter({ includeUnlabeled: true }));
  expect(setPredicateIncluded(back, filterUnlabeled, false)).toEqual(emptyLabelFilter);
  expect(isLabelFilterActive(filter({ excludeUnlabeled: true }))).toBe(true);
  expect(isLabelFilterActive(filter({ includeUnlabeled: true }))).toBe(true);
});

test('deleting a label leaves no filter that can reference it', () => {
  const state = collectionState();
  const deleted = applied(deleteLabel(state, 'ai'));
  const normalized = normalizeLabelFilter(deleted, filter({ includeLabelIds: ['ai'] }));

  expect(normalized.filter).toEqual(emptyLabelFilter);
  expect(normalized.unknownLabelIds).toEqual(['ai']);
  expect(filterSavedCourses(deleted, normalized.filter)).toHaveLength(3);
});

/**
 * Exhaustive small-universe coverage for the whole filter algebra.
 *
 * The expectation is an independent reference written straight from the product
 * document's set definitions — empty groups have identity `U`, `anyOf` unions,
 * `allOf` intersects, `noneOf` is unioned and subtracted, and `unlabeled` is the
 * derived zero-membership set. Every membership assignment in the universe is
 * crossed with every filter expressible over it, so a disagreement anywhere is a
 * failure rather than a case nobody thought to write down.
 */
const subsetsOf = <A>(values: ReadonlyArray<A>): ReadonlyArray<ReadonlyArray<A>> =>
  values.reduce<ReadonlyArray<ReadonlyArray<A>>>(
    (accumulated, value) => [...accumulated, ...accumulated.map((subset) => [...subset, value])],
    [[]],
  );

const universeState = (
  courseCodes: ReadonlyArray<string>,
  labelIds: ReadonlyArray<string>,
  membershipMask: number,
): SavedListState => {
  const saved = courseCodes.reduce(
    (state, code, index) =>
      saveCourse(state, courseIdentity(code)!, `2026-07-1${index + 1}T10:00:00.000Z`),
    emptySavedList,
  );
  const labelled = labelIds.reduce(
    (state, id) => applied(createLabel(state, { id, name: id.toUpperCase(), color: sky })),
    saved,
  );
  let state = labelled;
  let bit = 0;
  for (const code of courseCodes) {
    for (const id of labelIds) {
      if ((membershipMask >> bit) % 2 === 1)
        state = attachLabel(state, id, [courseIdentity(code)!]);
      bit += 1;
    }
  }
  return state;
};

/** The product document's algebra, written independently of the implementation. */
const referenceFilter = (state: SavedListState, rule: LabelFilter): ReadonlyArray<string> => {
  const known = new Set(state.labels.map((label) => label.id));
  const noneOf = [...new Set(rule.excludeLabelIds.filter((id) => known.has(id)))];
  const dropped = new Set(noneOf);
  const anyOrAll = [
    ...new Set(rule.includeLabelIds.filter((id) => known.has(id) && !dropped.has(id))),
  ];
  const positiveUnlabeled = rule.includeUnlabeled && !rule.excludeUnlabeled;
  const labelsOf = (courseId: string) =>
    state.memberships
      .filter((membership) => membership.savedCourseId === courseId)
      .map((membership) => membership.labelId);
  return savedCoursesNewestFirst(state)
    .filter((course) => {
      const attached = labelsOf(course.id);
      const unlabeled = attached.length === 0;
      if (noneOf.some((id) => attached.includes(id))) return false;
      if (rule.excludeUnlabeled && unlabeled) return false;
      const predicates = [
        ...anyOrAll.map((id) => attached.includes(id)),
        ...(positiveUnlabeled ? [unlabeled] : []),
      ];
      if (predicates.length === 0) return true;
      return rule.includeMode === 'all'
        ? predicates.every((matched) => matched)
        : predicates.some((matched) => matched);
    })
    .map((course) => course.courseCode);
};

const everyFilterOver = (labelIds: ReadonlyArray<string>): ReadonlyArray<LabelFilter> => {
  const groups = subsetsOf(labelIds);
  const rules: Array<LabelFilter> = [];
  for (const includeLabelIds of groups) {
    for (const excludeLabelIds of groups) {
      for (const includeMode of ['any', 'all'] as const) {
        for (const includeUnlabeled of [false, true]) {
          for (const excludeUnlabeled of [false, true]) {
            rules.push({
              includeLabelIds,
              includeUnlabeled,
              includeMode,
              excludeLabelIds,
              excludeUnlabeled,
            });
          }
        }
      }
    }
  }
  return rules;
};

const sweep = (
  courseCodes: ReadonlyArray<string>,
  labelIds: ReadonlyArray<string>,
): ReadonlyArray<unknown> => {
  // A stale id stands in for a label the recipe outlived, so every filter shape
  // is also exercised against an id the state no longer knows.
  const rules = everyFilterOver([...labelIds, 'label-gone']);
  const disagreements: Array<unknown> = [];
  for (let mask = 0; mask < 2 ** (courseCodes.length * labelIds.length); mask += 1) {
    const state = universeState(courseCodes, labelIds, mask);
    for (const rule of rules) {
      const actual = filterSavedCourses(state, rule).map((course) => course.courseCode);
      const expected = referenceFilter(state, rule);
      if (actual.join(',') !== expected.join(',')) {
        disagreements.push({ mask, rule, actual, expected });
      }
    }
  }
  return disagreements;
};

test('exhaustive: three saved courses and two labels agree with the reference algebra', () => {
  expect(sweep(['TDT4136', 'TMA4100', 'IT1901'], ['ai', 'heavy'])).toEqual([]);
});

test('exhaustive: two saved courses and three labels agree with the reference algebra', () => {
  expect(sweep(['TDT4136', 'TMA4100'], ['ai', 'heavy', 'taken'])).toEqual([]);
});

test('exhaustive: an empty saved set and a single label agree with the reference algebra', () => {
  expect(sweep([], ['ai'])).toEqual([]);
  expect(sweep(['TDT4136'], ['ai'])).toEqual([]);
});

test('exhaustive: duplicates and permutations of the same predicates select the same courses', () => {
  const labelIds = ['ai', 'heavy', 'taken'];
  const permutations = [
    ['ai', 'heavy', 'taken'],
    ['taken', 'ai', 'heavy'],
    ['heavy', 'taken', 'ai'],
    ['ai', 'ai', 'heavy', 'taken'],
    ['taken', 'heavy', 'ai', 'taken'],
  ];
  const disagreements: Array<unknown> = [];
  for (let mask = 0; mask < 2 ** 6; mask += 1) {
    const state = universeState(['TDT4136', 'TMA4100'], labelIds, mask);
    for (const includeMode of ['any', 'all'] as const) {
      for (const excludeLabelIds of [[], ['ai'], ['taken']]) {
        const baseline = filterSavedCourses(
          state,
          filter({ includeLabelIds: labelIds, includeMode, excludeLabelIds }),
        ).map((course) => course.courseCode);
        for (const includeLabelIds of permutations) {
          const got = filterSavedCourses(
            state,
            filter({ includeLabelIds, includeMode, excludeLabelIds }),
          ).map((course) => course.courseCode);
          if (got.join(',') !== baseline.join(',')) {
            disagreements.push({
              mask,
              includeMode,
              includeLabelIds,
              excludeLabelIds,
              got,
              baseline,
            });
          }
        }
      }
    }
  }
  expect(disagreements).toEqual([]);
});

const savedFour = ['TDT4136', 'TDT4109', 'TMA4115', 'IT2805'].reduce(
  (state, code) => saveCourse(state, courseIdentity(code)!, savedAt),
  emptySavedList,
);

test('a comparison is between two, three, or four distinct saved courses', () => {
  expect(compareSelection(savedFour, ['TDT4136', 'TDT4109'])?.length).toBe(2);
  expect(compareSelection(savedFour, ['TDT4136', 'TDT4109', 'TMA4115', 'IT2805'])?.length).toBe(4);

  // One course has nothing to compare against; five stops being a comparison.
  expect(compareSelection(savedFour, [])).toBeNull();
  expect(compareSelection(savedFour, ['TDT4136'])).toBeNull();
  expect(
    compareSelection(savedFour, ['TDT4136', 'TDT4109', 'TMA4115', 'IT2805', 'TDT4290']),
  ).toBeNull();
});

test('a comparison never quietly compares fewer courses than it was asked for', () => {
  // A duplicate would compare a course with itself; an unsaved or unparseable
  // code would drop a column. Both fail the selection instead.
  expect(compareSelection(savedFour, ['TDT4136', 'TDT4136'])).toBeNull();
  expect(compareSelection(savedFour, ['tdt4136', 'TDT4136'])).toBeNull();
  expect(compareSelection(savedFour, ['TDT4136', 'TDT4290'])).toBeNull();
  expect(compareSelection(savedFour, ['TDT4136', 'not a code'])).toBeNull();
});

test('a comparison keeps the order the student chose', () => {
  const selection = compareSelection(savedFour, ['IT2805', 'TDT4136'])!;
  expect(compareCourses(savedFour, selection).map((course) => course.courseCode)).toEqual([
    'IT2805',
    'TDT4136',
  ]);
});

const autumnFilter = {
  ...emptyLabelFilter,
  includeLabelIds: ['label-autumn'],
};

test('a collection stores the recipe, so its membership follows the labels', () => {
  const result = saveCollection(emptySavedList, 'Autumn shortlist', autumnFilter, 'collection-1');
  expect(result._tag).toBe('CollectionSaved');
  if (result._tag !== 'CollectionSaved') return;

  const stored = result.state.collections[0]!;
  expect(stored.name).toBe('Autumn shortlist');
  expect(stored.filter.includeLabelIds).toEqual(['label-autumn']);
  // No course identities: the collection is a question, not a copy of an answer.
  expect(Object.keys(stored.filter)).not.toContain('savedCourses');
});

test('a collection must name something the saved list does not already show', () => {
  // Every saved course is the saved list; naming it would put one set on
  // screen under two names.
  expect(saveCollection(emptySavedList, 'Everything', emptyLabelFilter, 'c1')).toMatchObject({
    _tag: 'CollectionRejected',
    reason: 'inactive-filter',
  });
  expect(saveCollection(emptySavedList, '   ', autumnFilter, 'c1')).toMatchObject({
    reason: 'empty-name',
  });

  const first = saveCollection(emptySavedList, 'Autumn', autumnFilter, 'c1');
  if (first._tag !== 'CollectionSaved') throw new Error('expected a saved collection');
  expect(saveCollection(first.state, '  autumn  ', autumnFilter, 'c2')).toMatchObject({
    reason: 'duplicate-name',
  });
});

test('the active filter recognises the collection it came from', () => {
  const saved = saveCollection(emptySavedList, 'Autumn', autumnFilter, 'c1');
  if (saved._tag !== 'CollectionSaved') throw new Error('expected a saved collection');

  expect(matchingCollection(saved.state, autumnFilter)?.name).toBe('Autumn');
  expect(matchingCollection(saved.state, emptyLabelFilter)).toBeNull();

  const removed = deleteCollection(saved.state, 'c1');
  expect(collectionsByName(removed)).toEqual([]);
  // Deleting a collection deletes a question, never the courses it selected.
  expect(removed.savedCourses).toEqual(saved.state.savedCourses);
});

test('a list saved before collections existed migrates to having none', () => {
  const legacy = JSON.stringify({
    version: 2,
    savedCourses: [
      {
        id: 'ntnu:TDT4136',
        institutionId: 'ntnu',
        courseCode: 'TDT4136',
        savedAt,
        note: null,
        observedDataRevision: null,
      },
    ],
    labels: [],
    memberships: [],
  });

  const load = parseSavedList(legacy);
  expect(load._tag).toBe('SavedListLoaded');
  if (load._tag !== 'SavedListLoaded') return;
  expect(load.state.version).toBe(savedListSchemaVersion);
  expect(load.state.collections).toEqual([]);
  expect(load.state.savedCourses.map((course) => course.courseCode)).toEqual(['TDT4136']);
});
