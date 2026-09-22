import fc from 'fast-check';
import { expect, test } from 'vitest';

import { fixtureSearchResponse } from './course-client';
import {
  ChangedCampus,
  ChangedLabelInclusion,
  RequestedRemoveSavedCourse,
  RequestedSaveCourse,
  RequestedUndoSavedListAction,
  SavedCoursesReady,
  StampedSavedCourse,
  SubmittedSavedNote,
  SucceededCourseSearch,
  UpdatedSavedNoteDraft,
  initForHref,
  normalizedUrl,
  update,
  type Model,
} from './app';
import {
  attachLabel,
  courseIdentity,
  createLabel,
  emptyLabelFilter,
  emptySavedList,
  filterLabel,
  findSavedCourse,
  saveCourse,
  setSavedCourseNote,
  type LabelFilter,
  type SavedListState,
} from './saved-courses';

const savedAt = '2026-07-24T12:00:00.000Z';

const identity = (courseCode: string) => {
  const parsed = courseIdentity(courseCode);
  if (parsed === null) throw new Error(`Expected a valid course code: ${courseCode}`);
  return parsed;
};

const readyModel = (state: SavedListState = emptySavedList): Model => ({
  ...initForHref('http://course-lens.local/list')[0],
  savedCourses: SavedCoursesReady({ state, repairedEntries: 0 }),
});

const savedState = (model: Model): SavedListState => {
  if (model.savedCourses._tag !== 'SavedCoursesReady') {
    throw new Error(`Expected ready saved courses, got ${model.savedCourses._tag}`);
  }
  return model.savedCourses.state;
};

const commandNames = (commands: ReadonlyArray<{ readonly name: string }>): ReadonlyArray<string> =>
  commands.map((command) => command.name);

test('stale catalogue responses cannot overwrite a newer Explore transition', () => {
  const initial = initForHref('http://course-lens.local/')[0];
  const [filtered] = update(initial, ChangedCampus({ value: 'trondheim' }));
  const [afterStaleResponse, commands] = update(
    filtered,
    SucceededCourseSearch({
      requestKey: initial.activeRequestKey,
      append: false,
      response: fixtureSearchResponse(1),
    }),
  );

  expect(afterStaleResponse).toBe(filtered);
  expect(commands).toEqual([]);
});

test('saved-list persistence follows explicit save and note commits, never drafts', () => {
  const [saveRequested, saveRequestCommands] = update(
    readyModel(),
    RequestedSaveCourse({ courseCode: 'TDT4136' }),
  );
  expect(commandNames(saveRequestCommands)).toEqual(['StampSavedCourse']);

  const [saved, saveCommands] = update(
    saveRequested,
    StampedSavedCourse({ courseCode: 'TDT4136', savedAt }),
  );
  expect(commandNames(saveCommands)).toEqual(['PersistSavedCourses']);

  const [drafted, draftCommands] = update(
    saved,
    UpdatedSavedNoteDraft({ courseCode: 'TDT4136', value: 'Ask an adviser' }),
  );
  expect(draftCommands).toEqual([]);
  expect(findSavedCourse(savedState(drafted), identity('TDT4136'))?.note).toBeNull();

  const [committed, commitCommands] = update(
    drafted,
    SubmittedSavedNote({ courseCode: 'TDT4136' }),
  );
  expect(commandNames(commitCommands)).toEqual(['PersistSavedCourses']);
  expect(findSavedCourse(savedState(committed), identity('TDT4136'))?.note).toBe('Ask an adviser');
});

test('the Foldkit undo transition restores the exact removed course and memberships', () => {
  const saved = setSavedCourseNote(
    saveCourse(emptySavedList, identity('TDT4136'), savedAt),
    identity('TDT4136'),
    'Keep this course',
  );
  const labelled = createLabel(saved, { id: 'label-plan', name: 'Plan', color: 'sky' });
  if (labelled._tag !== 'LabelApplied') throw new Error('Expected a label');
  const original = attachLabel(labelled.state, 'label-plan', [identity('TDT4136')]);

  const [removed, removeCommands] = update(
    readyModel(original),
    RequestedRemoveSavedCourse({ courseCode: 'TDT4136' }),
  );
  expect(commandNames(removeCommands)).toEqual(['PersistSavedCourses']);

  const [restored, undoCommands] = update(
    removed,
    RequestedUndoSavedListAction({ key: 'removed:TDT4136' }),
  );
  expect(commandNames(undoCommands)).toEqual(['PersistSavedCourses']);
  expect(savedState(restored)).toEqual(original);
});

test('label-filter changes are URL-backed List transitions without catalogue refetches', () => {
  const saved = saveCourse(emptySavedList, identity('TDT4136'), savedAt);
  const labelled = createLabel(saved, { id: 'label-plan', name: 'Plan', color: 'sky' });
  if (labelled._tag !== 'LabelApplied') throw new Error('Expected a label');
  const [filtered, commands] = update(
    readyModel(labelled.state),
    ChangedLabelInclusion({ predicate: filterLabel('label-plan'), isIncluded: true }),
  );

  expect(filtered.labelFilter).toEqual({ ...emptyLabelFilter, includeLabelIds: ['label-plan'] });
  expect(commandNames(commands)).toEqual(['Navigate']);
  expect(commands[0]?.args).toMatchObject({
    href: '/list?lang=en&labels=label-plan',
    mode: 'push',
  });
});

const urlFilterArbitrary: fc.Arbitrary<LabelFilter> = fc
  .record({
    includeA: fc.boolean(),
    includeB: fc.boolean(),
    includeUnlabeled: fc.boolean(),
    includeMode: fc.constantFrom('any' as const, 'all' as const),
    excludeA: fc.boolean(),
    excludeB: fc.boolean(),
    excludeUnlabeled: fc.boolean(),
  })
  .map(
    ({
      includeA,
      includeB,
      includeUnlabeled,
      includeMode,
      excludeA,
      excludeB,
      excludeUnlabeled,
    }) => ({
      includeLabelIds: ['label-a', 'label-b'].filter((_, index) =>
        index === 0 ? includeA : includeB,
      ),
      includeUnlabeled,
      includeMode,
      excludeLabelIds: ['label-a', 'label-b'].filter((_, index) =>
        index === 0 ? excludeA : excludeB,
      ),
      excludeUnlabeled,
    }),
  );

test('property: canonical List filter URLs round-trip through the public route seam', () => {
  fc.assert(
    fc.property(urlFilterArbitrary, (labelFilter) => {
      const [base] = initForHref('http://course-lens.local/list');
      const url = normalizedUrl({ ...base, labelFilter }, null, '/list');
      const [restored] = initForHref(`http://course-lens.local${url}`);

      expect(restored.route).toBe('list');
      expect(restored.labelFilter).toEqual(labelFilter);
      expect(normalizedUrl(restored, null, '/list')).toBe(url);
    }),
    { numRuns: 100, seed: 0x55524c53 },
  );
});
