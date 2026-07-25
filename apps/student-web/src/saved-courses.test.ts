import { expect, test } from 'vitest';

import {
  attachLabel,
  courseIdentity,
  createLabel,
  deleteLabel,
  detachLabel,
  editLabel,
  emptyLabelFilter,
  emptySavedList,
  filterSavedCourses,
  findSavedCourse,
  hasLabel,
  isLabelFilterActive,
  isSaved,
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
  setLabelExcluded,
  setLabelFilterMode,
  setSavedCourseNote,
  toggleIncludeLabel,
  type LabelResult,
  type SavedListState,
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
    version: 1,
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
    labels: [{ id: 'label-1', name: 'Autumn 2027', color: 'blue' }],
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
    version: 1,
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
    labels: [{ id: 'label-1', name: 'Autumn 2027', color: 'blue' }],
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
  const future = JSON.stringify({ version: 2, savedCourses: [], labels: [], memberships: [] });
  expect(parseSavedList(future)).toMatchObject({
    _tag: 'SavedListUnsupported',
    storedVersion: 2,
    raw: future,
  });

  const older = JSON.stringify({ version: 0.5 });
  expect(parseSavedList(older)).toMatchObject({ _tag: 'SavedListCorrupt' });
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
    labels: [{ id: 'label-1', name: 'Autumn 2027', color: 'blue' }],
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

const blue = 'blue' as const;

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
    createLabel(emptySavedList, { id: 'label-1', name: '  Autumn 2027 ', color: blue }),
  );

  expect(created.labels).toEqual([{ id: 'label-1', name: 'Autumn 2027', color: blue }]);
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
      applied(createLabel(state, { id: `label-${index}`, name: `L${index}`, color: blue })),
    emptySavedList,
  );

  expect(full.labels).toHaveLength(labelsMaxCount);
  expect(createLabel(full, { id: 'one-more', name: 'One more', color: blue })).toEqual({
    _tag: 'LabelRejected',
    reason: 'limit-reached',
  });
});

test('renaming and recolouring is one transition and keeps the identity memberships use', () => {
  const state = withCourses('TDT4136');
  const labelled = attachLabel(
    applied(createLabel(state, { id: 'label-1', name: 'Autumn 2027', color: blue })),
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
  expect(editLabel(edited, 'missing', { name: 'Any', color: blue })).toEqual({
    _tag: 'LabelRejected',
    reason: 'unknown-label',
  });
});

test('renaming onto another existing name is rejected, renaming onto its own name is allowed', () => {
  const two = applied(
    createLabel(
      applied(createLabel(emptySavedList, { id: 'a', name: 'Ask adviser', color: blue })),
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
    { id: 'a', name: 'Ask adviser', color: blue },
    { id: 'b', name: 'Remote', color: 'sky' },
  ]);
});

test('deleting a label deletes its memberships and leaves courses and other labels intact', () => {
  const state = withCourses('TDT4136', 'TMA4100');
  const withLabels = attachLabel(
    attachLabel(
      applied(
        createLabel(applied(createLabel(state, { id: 'a', name: 'A', color: blue })), {
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
  const withLabel = applied(createLabel(state, { id: 'a', name: 'A', color: blue }));

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
    applied(createLabel(state, { id: 'a', name: 'A', color: blue })),
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
        createLabel(applied(createLabel(state, { id: 'a', name: 'Zeta', color: blue })), {
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
    (state, id) => applied(createLabel(state, { id, name: id.toUpperCase(), color: blue })),
    base,
  );
  const it1901 = courseIdentity('IT1901')!;
  return attachLabel(
    attachLabel(attachLabel(withLabels, 'ai', [tdt4136, it1901]), 'heavy', [tdt4136, tma4100]),
    'taken',
    [it1901],
  );
};

test('no included labels yields the whole canonical List in canonical order', () => {
  const state = collectionState();

  expect(filterSavedCourses(state, emptyLabelFilter).map((course) => course.courseCode)).toEqual(
    savedCoursesNewestFirst(state).map((course) => course.courseCode),
  );
  expect(isLabelFilterActive(emptyLabelFilter)).toBe(false);
});

test('Any is the union, All is the intersection, and Exclude subtracts from either', () => {
  const state = collectionState();
  const codes = (filter: Parameters<typeof filterSavedCourses>[1]) =>
    filterSavedCourses(state, filter).map((course) => course.courseCode);

  expect(
    codes({ includeLabelIds: ['ai', 'heavy'], includeMode: 'any', excludeLabelIds: [] }),
  ).toEqual(['IT1901', 'TMA4100', 'TDT4136']);
  expect(
    codes({ includeLabelIds: ['ai', 'heavy'], includeMode: 'all', excludeLabelIds: [] }),
  ).toEqual(['TDT4136']);
  expect(
    codes({ includeLabelIds: ['ai', 'heavy'], includeMode: 'any', excludeLabelIds: ['taken'] }),
  ).toEqual(['TMA4100', 'TDT4136']);
  expect(codes({ includeLabelIds: [], includeMode: 'any', excludeLabelIds: ['ai'] })).toEqual([
    'TMA4100',
  ]);
});

test('an included label that is also excluded is resolved with exclude winning and reported', () => {
  const state = collectionState();
  const normalized = normalizeLabelFilter(state, {
    includeLabelIds: ['ai', 'heavy'],
    includeMode: 'all',
    excludeLabelIds: ['heavy'],
  });

  expect(normalized.filter).toEqual({
    includeLabelIds: ['ai'],
    includeMode: 'all',
    excludeLabelIds: ['heavy'],
  });
  expect(normalized.contradictoryLabelIds).toEqual(['heavy']);
  expect(normalized.unknownLabelIds).toEqual([]);
  expect(
    filterSavedCourses(state, {
      includeLabelIds: ['ai', 'heavy'],
      includeMode: 'all',
      excludeLabelIds: ['heavy'],
    }).map((course) => course.courseCode),
  ).toEqual(['IT1901']);
});

test('filter ids that no longer name a label are dropped and disclosed, not treated as empty', () => {
  const state = collectionState();
  const normalized = normalizeLabelFilter(state, {
    includeLabelIds: ['ai', 'gone', 'ai'],
    includeMode: 'any',
    excludeLabelIds: ['also-gone'],
  });

  expect(normalized.filter).toEqual({
    includeLabelIds: ['ai'],
    includeMode: 'any',
    excludeLabelIds: [],
  });
  expect(normalized.unknownLabelIds).toEqual(['gone', 'also-gone']);
});

test('toggling moves a label between Include and Exclude so the UI cannot build a contradiction', () => {
  const included = toggleIncludeLabel(emptyLabelFilter, 'ai');
  expect(included).toEqual({ includeLabelIds: ['ai'], includeMode: 'any', excludeLabelIds: [] });

  const excluded = setLabelExcluded(included, 'ai', true);
  expect(excluded).toEqual({ includeLabelIds: [], includeMode: 'any', excludeLabelIds: ['ai'] });

  const backToInclude = toggleIncludeLabel(excluded, 'ai');
  expect(backToInclude).toEqual({
    includeLabelIds: ['ai'],
    includeMode: 'any',
    excludeLabelIds: [],
  });

  expect(toggleIncludeLabel(backToInclude, 'ai')).toEqual(emptyLabelFilter);
  expect(setLabelFilterMode(backToInclude, 'all').includeMode).toBe('all');
  expect(setLabelFilterMode(backToInclude, 'any')).toBe(backToInclude);
});

test('excluding a label is a set, not a relative toggle, so a duplicate message cannot undo it', () => {
  const included = toggleIncludeLabel(emptyLabelFilter, 'ai');

  // Setting excluded=true twice in a row — as a bubbled Checkbox click would
  // dispatch — lands on the same state instead of flipping back to included.
  const excludedOnce = setLabelExcluded(included, 'ai', true);
  const excludedTwice = setLabelExcluded(excludedOnce, 'ai', true);
  expect(excludedTwice).toEqual({
    includeLabelIds: [],
    includeMode: 'any',
    excludeLabelIds: ['ai'],
  });
  expect(excludedTwice).toBe(excludedOnce);

  // Setting excluded=false twice in a row is equally a no-op the second time.
  const includedAgain = setLabelExcluded(excludedTwice, 'ai', false);
  expect(includedAgain).toEqual(emptyLabelFilter);
  expect(setLabelExcluded(includedAgain, 'ai', false)).toBe(includedAgain);
});

test('deleting a label leaves no filter that can reference it', () => {
  const state = collectionState();
  const deleted = applied(deleteLabel(state, 'ai'));
  const normalized = normalizeLabelFilter(deleted, {
    includeLabelIds: ['ai'],
    includeMode: 'any',
    excludeLabelIds: [],
  });

  expect(normalized.filter).toEqual(emptyLabelFilter);
  expect(normalized.unknownLabelIds).toEqual(['ai']);
  expect(filterSavedCourses(deleted, normalized.filter)).toHaveLength(3);
});
