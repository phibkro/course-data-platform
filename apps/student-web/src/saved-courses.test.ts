import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { courseIdentity } from './course-identity';
import {
  attachLabel,
  compareCourses,
  compareSelection,
  createLabel,
  deleteLabel,
  detachLabel,
  editLabel,
  emptySavedList,
  filterSavedCourses,
  findSavedCourse,
  labelColors,
  labelNameKey,
  membershipsForSavedCourse,
  noteMaxLength,
  parseSavedList,
  removeSavedCourse,
  restoreSavedCourse,
  savedCoursesNewestFirst,
  saveCourse,
  serializeSavedList,
  setSavedCourseNote,
  type LabelFilter,
  type LabelResult,
  type SavedListState,
} from './saved-courses';

const courseCodes = ['TDT4136', 'TMA4100', 'IT1901', 'MA1101'] as const;
type CourseCode = (typeof courseCodes)[number];

const savedAt = '2026-07-24T10:00:00.000Z';

const identity = (courseCode: string) => {
  const parsed = courseIdentity(courseCode);
  if (parsed === null) throw new Error(`Expected a valid course code: ${courseCode}`);
  return parsed;
};

const applied = (result: LabelResult): SavedListState => {
  if (result._tag !== 'LabelApplied') throw new Error(`Expected LabelApplied, got ${result._tag}`);
  return result.state;
};

const labelledCourse = (): SavedListState => {
  const saved = setSavedCourseNote(
    saveCourse(emptySavedList, identity('TDT4136'), savedAt),
    identity('TDT4136'),
    'Ask an adviser',
  );
  const withLabel = applied(
    createLabel(saved, { id: 'label-plan', name: 'Study plan', color: 'sky' }),
  );
  return attachLabel(withLabel, 'label-plan', [identity('TDT4136')]);
};

const assertCanonicalState = (state: SavedListState): void => {
  const savedIds = new Set(state.savedCourses.map((course) => course.id));
  const labelIds = new Set(state.labels.map((label) => label.id));
  const membershipKeys = new Set<string>();

  expect(savedIds.size).toBe(state.savedCourses.length);
  expect(labelIds.size).toBe(state.labels.length);
  expect(new Set(state.labels.map((label) => labelNameKey(label.name))).size).toBe(
    state.labels.length,
  );

  for (const course of state.savedCourses) {
    const parsed = courseIdentity(course.courseCode);
    if (parsed === null) throw new Error(`Saved an invalid course code: ${course.courseCode}`);
    expect(course.id).toBe(parsed.savedCourseId);
    expect(course.institutionId).toBe(parsed.institutionId);
    if (course.note !== null) {
      expect(Array.from(course.note).length).toBeLessThanOrEqual(noteMaxLength);
      expect(course.note).not.toMatch(/[\uD800-\uDBFF]$/);
    }
  }

  for (const membership of state.memberships) {
    const key = `${membership.savedCourseId}\u0000${membership.labelId}`;
    expect(savedIds.has(membership.savedCourseId)).toBe(true);
    expect(labelIds.has(membership.labelId)).toBe(true);
    expect(membershipKeys.has(key)).toBe(false);
    membershipKeys.add(key);
  }

  const reloaded = parseSavedList(serializeSavedList(state));
  expect(reloaded._tag).toBe('SavedListLoaded');
  if (reloaded._tag !== 'SavedListLoaded') throw new Error('A canonical list did not reload');
  expect(reloaded.repairedEntries).toBe(0);
  expect(reloaded.state).toEqual(state);
};

describe('student-owned saved list', () => {
  test('saves a canonical identity once, without copying catalogue facts', () => {
    const saved = saveCourse(emptySavedList, identity(' tdt4136 '), savedAt);
    const course = findSavedCourse(saved, identity('TDT4136'));

    expect(course).toMatchObject({
      id: 'ntnu:TDT4136',
      institutionId: 'ntnu',
      courseCode: 'TDT4136',
      savedAt,
      note: null,
    });
    expect('title' in (course ?? {})).toBe(false);
    expect(saveCourse(saved, identity('TDT4136'), '2027-01-01T00:00:00.000Z')).toBe(saved);
  });

  test('restores an exact removal, but never restores a membership whose label was deleted', () => {
    const original = labelledCourse();
    const course = findSavedCourse(original, identity('TDT4136'))!;
    const memberships = membershipsForSavedCourse(original, identity('TDT4136'));
    const removed = removeSavedCourse(original, identity('TDT4136'));

    expect(restoreSavedCourse(removed, course, memberships)).toEqual(original);

    const labelDeleted = applied(deleteLabel(removed, 'label-plan'));
    const restoredAfterLabelDeletion = restoreSavedCourse(labelDeleted, course, memberships);
    expect(restoredAfterLabelDeletion.savedCourses).toEqual(original.savedCourses);
    expect(restoredAfterLabelDeletion.labels).toEqual([]);
    expect(restoredAfterLabelDeletion.memberships).toEqual([]);
  });

  test('creates, edits, and deletes labels without losing course identity or leaving memberships behind', () => {
    const saved = saveCourse(emptySavedList, identity('TDT4136'), savedAt);
    const created = applied(
      createLabel(saved, { id: 'label-a', name: '  Autumn plan ', color: 'sky' }),
    );
    const attached = attachLabel(created, 'label-a', [identity('TDT4136'), identity('TDT4136')]);
    const edited = applied(
      editLabel(attached, 'label-a', { name: 'Spring plan', color: 'emerald' }),
    );

    expect(
      createLabel(edited, { id: 'label-b', name: 'spring  plan', color: 'rose' }),
    ).toMatchObject({
      _tag: 'LabelRejected',
      reason: 'duplicate-name',
    });
    expect(edited.labels).toEqual([{ id: 'label-a', name: 'Spring plan', color: 'emerald' }]);
    expect(edited.memberships).toEqual([{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-a' }]);

    const deleted = applied(deleteLabel(edited, 'label-a'));
    expect(deleted.savedCourses).toEqual(edited.savedCourses);
    expect(deleted.memberships).toEqual([]);
  });

  test('migrates recoverable storage and leaves corrupt or newer storage recoverable', () => {
    const legacy = JSON.stringify({
      version: 1,
      savedCourses: [
        {
          id: 'ntnu:TDT4136',
          institutionId: 'ntnu',
          courseCode: 'TDT4136',
          savedAt,
          note: '  Ask an adviser  ',
          observedDataRevision: null,
        },
      ],
      labels: [{ id: 'label-plan', name: 'Study plan', color: 'blue' }],
      memberships: [{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-plan' }],
    });

    const migrated = parseSavedList(legacy);
    expect(migrated).toMatchObject({ _tag: 'SavedListLoaded', repairedEntries: 1 });
    if (migrated._tag !== 'SavedListLoaded') throw new Error('Expected a migrated list');
    expect(migrated.state.labels[0]?.color).toBe('sky');
    expect(migrated.state.savedCourses[0]?.note).toBe('Ask an adviser');
    expect(parseSavedList(serializeSavedList(migrated.state))).toMatchObject({
      _tag: 'SavedListLoaded',
      state: migrated.state,
      repairedEntries: 0,
    });

    expect(parseSavedList('{not json')).toMatchObject({
      _tag: 'SavedListCorrupt',
      reason: 'invalid-json',
      raw: '{not json',
    });
    expect(
      parseSavedList(
        JSON.stringify({ version: 99, savedCourses: [], labels: [], memberships: [] }),
      ),
    ).toMatchObject({ _tag: 'SavedListUnsupported', storedVersion: 99 });
  });
});

test('property: Unicode notes stay bounded at code-point boundaries', () => {
  const unicodeTail = fc
    .array(fc.constantFrom('a', '😀', '𝄞', ' ', '\n'), { maxLength: 32 })
    .map((characters) => `😀${characters.join('')}`);

  fc.assert(
    fc.property(unicodeTail, (tail) => {
      const state = setSavedCourseNote(
        saveCourse(emptySavedList, identity('TDT4136'), savedAt),
        identity('TDT4136'),
        `${'x'.repeat(noteMaxLength - 1)}${tail}`,
      );
      const note = findSavedCourse(state, identity('TDT4136'))?.note;

      expect(note).not.toBeNull();
      expect(Array.from(note ?? '').length).toBe(noteMaxLength);
      expect(note).not.toMatch(/[\uD800-\uDBFF]$/);
    }),
    { numRuns: 80, seed: 0x4e4f5445 },
  );
});

type Action =
  | Readonly<{ type: 'save'; courseCode: CourseCode }>
  | Readonly<{ type: 'remove'; courseCode: CourseCode }>
  | Readonly<{ type: 'note'; courseCode: CourseCode; value: string }>
  | Readonly<{
      type: 'create-label';
      labelId: string;
      name: string;
      color: (typeof labelColors)[number];
    }>
  | Readonly<{
      type: 'edit-label';
      labelId: string;
      name: string;
      color: (typeof labelColors)[number];
    }>
  | Readonly<{ type: 'delete-label'; labelId: string }>
  | Readonly<{ type: 'attach'; labelId: string; courseCodes: ReadonlyArray<CourseCode> }>
  | Readonly<{ type: 'detach'; labelId: string; courseCodes: ReadonlyArray<CourseCode> }>
  | Readonly<{ type: 'remove-and-restore'; courseCode: CourseCode }>
  | Readonly<{ type: 'reload' }>;

const labelIds = ['label-a', 'label-b', 'label-c'] as const;
const courseCodeArbitrary = fc.constantFrom(...courseCodes);
const labelIdArbitrary = fc.constantFrom(...labelIds);
const shortNoteArbitrary = fc
  .array(fc.constantFrom('x', ' ', '😀', '𝄞', '\n'), { maxLength: 72 })
  .map((characters) => characters.join(''));
const actionArbitrary: fc.Arbitrary<Action> = fc.oneof(
  fc.record({ type: fc.constant('save' as const), courseCode: courseCodeArbitrary }),
  fc.record({ type: fc.constant('remove' as const), courseCode: courseCodeArbitrary }),
  fc.record({
    type: fc.constant('note' as const),
    courseCode: courseCodeArbitrary,
    value: shortNoteArbitrary,
  }),
  fc.record({
    type: fc.constant('create-label' as const),
    labelId: labelIdArbitrary,
    name: fc.constantFrom('Focus', 'Taken', '  Schedule  ', 'AI'),
    color: fc.constantFrom(...labelColors),
  }),
  fc.record({
    type: fc.constant('edit-label' as const),
    labelId: labelIdArbitrary,
    name: fc.constantFrom('Focus', 'Taken', '  Schedule  ', 'AI', '   '),
    color: fc.constantFrom(...labelColors),
  }),
  fc.record({ type: fc.constant('delete-label' as const), labelId: labelIdArbitrary }),
  fc.record({
    type: fc.constant('attach' as const),
    labelId: labelIdArbitrary,
    courseCodes: fc.array(courseCodeArbitrary, { maxLength: 6 }),
  }),
  fc.record({
    type: fc.constant('detach' as const),
    labelId: labelIdArbitrary,
    courseCodes: fc.array(courseCodeArbitrary, { maxLength: 6 }),
  }),
  fc.record({ type: fc.constant('remove-and-restore' as const), courseCode: courseCodeArbitrary }),
  fc.constant({ type: 'reload' as const }),
);

const stateFromResult = (state: SavedListState, result: LabelResult): SavedListState =>
  result._tag === 'LabelApplied' ? result.state : state;

const applyAction = (state: SavedListState, action: Action): SavedListState => {
  switch (action.type) {
    case 'save':
      return saveCourse(state, identity(action.courseCode), savedAt);
    case 'remove':
      return removeSavedCourse(state, identity(action.courseCode));
    case 'note':
      return setSavedCourseNote(state, identity(action.courseCode), action.value);
    case 'create-label':
      return stateFromResult(
        state,
        createLabel(state, { id: action.labelId, name: action.name, color: action.color }),
      );
    case 'edit-label':
      return stateFromResult(
        state,
        editLabel(state, action.labelId, { name: action.name, color: action.color }),
      );
    case 'delete-label':
      return stateFromResult(state, deleteLabel(state, action.labelId));
    case 'attach':
      return attachLabel(
        state,
        action.labelId,
        action.courseCodes.map((courseCode) => identity(courseCode)),
      );
    case 'detach':
      return detachLabel(
        state,
        action.labelId,
        action.courseCodes.map((courseCode) => identity(courseCode)),
      );
    case 'remove-and-restore': {
      const course = findSavedCourse(state, identity(action.courseCode));
      if (course === null) return state;
      const memberships = membershipsForSavedCourse(state, identity(action.courseCode));
      const restored = restoreSavedCourse(
        removeSavedCourse(state, identity(action.courseCode)),
        course,
        memberships,
      );
      expect(findSavedCourse(restored, identity(action.courseCode))).toEqual(course);
      expect(membershipsForSavedCourse(restored, identity(action.courseCode))).toEqual(memberships);
      return restored;
    }
    case 'reload': {
      const loaded = parseSavedList(serializeSavedList(state));
      if (loaded._tag !== 'SavedListLoaded') throw new Error('Canonical state did not reload');
      return loaded.state;
    }
  }
};

test('property: generated saved-list transition sequences preserve canonical state', () => {
  expect.hasAssertions();
  fc.assert(
    fc.property(fc.array(actionArbitrary, { maxLength: 80 }), (actions) => {
      let state = emptySavedList;
      assertCanonicalState(state);
      for (const action of actions) {
        state = applyAction(state, action);
        assertCanonicalState(state);
      }
    }),
    { numRuns: 100, seed: 0x53415645 },
  );
});

const filterCourseCodes = ['TDT4136', 'TMA4100', 'IT1901'] as const;
const filterLabelIds = ['label-a', 'label-b'] as const;

const stateWithMembershipBits = (bits: ReadonlyArray<boolean>): SavedListState => {
  let state = filterCourseCodes.reduce(
    (current, courseCode) => saveCourse(current, identity(courseCode), savedAt),
    emptySavedList,
  );
  state = applied(createLabel(state, { id: 'label-a', name: 'A', color: 'sky' }));
  state = applied(createLabel(state, { id: 'label-b', name: 'B', color: 'rose' }));

  for (let courseIndex = 0; courseIndex < filterCourseCodes.length; courseIndex += 1) {
    for (let labelIndex = 0; labelIndex < filterLabelIds.length; labelIndex += 1) {
      if (bits[courseIndex * filterLabelIds.length + labelIndex] !== true) continue;
      state = attachLabel(state, filterLabelIds[labelIndex]!, [
        identity(filterCourseCodes[courseIndex]!),
      ]);
    }
  }
  return state;
};

const referenceFilter = (state: SavedListState, filter: LabelFilter): ReadonlyArray<string> => {
  const knownLabels = new Set(state.labels.map((label) => label.id));
  const excluded = new Set(
    filter.excludeLabelIds.filter(
      (labelId, index, ids) => ids.indexOf(labelId) === index && knownLabels.has(labelId),
    ),
  );
  const included = filter.includeLabelIds.filter(
    (labelId, index, ids) =>
      ids.indexOf(labelId) === index && knownLabels.has(labelId) && !excluded.has(labelId),
  );
  const includeUnlabeled = filter.includeUnlabeled && !filter.excludeUnlabeled;

  return savedCoursesNewestFirst(state)
    .filter((course) => {
      const attached = new Set(
        state.memberships
          .filter((membership) => membership.savedCourseId === course.id)
          .map((membership) => membership.labelId),
      );
      const unlabeled = attached.size === 0;
      if (filter.excludeUnlabeled && unlabeled) return false;
      if ([...excluded].some((labelId) => attached.has(labelId))) return false;

      const matches = [
        ...included.map((labelId) => attached.has(labelId)),
        ...(includeUnlabeled ? [unlabeled] : []),
      ];
      return matches.length === 0 || filter.includeMode === 'any'
        ? matches.length === 0 || matches.some(Boolean)
        : matches.every(Boolean);
    })
    .map((course) => course.courseCode);
};

const filterArbitrary: fc.Arbitrary<LabelFilter> = fc.record({
  includeLabelIds: fc.array(fc.constantFrom(...filterLabelIds, 'label-gone'), { maxLength: 5 }),
  includeUnlabeled: fc.boolean(),
  includeMode: fc.constantFrom('any' as const, 'all' as const),
  excludeLabelIds: fc.array(fc.constantFrom(...filterLabelIds, 'label-gone'), { maxLength: 5 }),
  excludeUnlabeled: fc.boolean(),
});

test('property: Any, All, Exclude, and Unlabeled agree with the collection algebra', () => {
  fc.assert(
    fc.property(
      fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
      filterArbitrary,
      (membershipBits, filter) => {
        const state = stateWithMembershipBits(membershipBits);
        expect(filterSavedCourses(state, filter).map((course) => course.courseCode)).toEqual(
          referenceFilter(state, filter),
        );
      },
    ),
    { numRuns: 150, seed: 0x46494c54 },
  );
});

test('property: comparison accepts exactly two to four distinct saved identities in requested order', () => {
  const saved = courseCodes.reduce(
    (state, courseCode) => saveCourse(state, identity(courseCode), savedAt),
    emptySavedList,
  );
  const candidates = fc.array(
    fc.constantFrom(...courseCodes, 'tdt4136', ' TDT4136 ', 'UNKNOWN', 'not a course'),
    { maxLength: 5 },
  );

  fc.assert(
    fc.property(candidates, (requested) => {
      const identities = requested.map(courseIdentity);
      const normalized = identities.map((candidate) => candidate?.courseCode ?? null);
      const valid =
        requested.length >= 2 &&
        requested.length <= 4 &&
        identities.every((candidate) => candidate !== null) &&
        new Set(normalized).size === normalized.length &&
        identities.every(
          (candidate) => candidate !== null && findSavedCourse(saved, candidate) !== null,
        );
      const selection = compareSelection(saved, requested);

      const compared =
        selection === null
          ? null
          : compareCourses(saved, selection).map((course) => course.courseCode);
      expect(compared).toEqual(valid ? normalized : null);
    }),
    { numRuns: 120, seed: 0x434f4d50 },
  );
});
