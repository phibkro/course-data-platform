import { expect, test } from 'vitest';

import {
  courseIdentity,
  emptySavedList,
  findSavedCourse,
  isSaved,
  membershipsForSavedCourse,
  noteMaxLength,
  parseSavedList,
  removeSavedCourse,
  restoreSavedCourse,
  savedCoursesNewestFirst,
  saveCourse,
  serializeSavedList,
  setSavedCourseNote,
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
