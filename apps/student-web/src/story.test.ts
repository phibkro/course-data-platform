import { Schema as S } from 'effect';
import fc from 'fast-check';
import { expect, test } from 'vitest';

import { fixtureScheduleResponse, fixtureSearchResponse } from './course-client.fixture';
import { parseCourseSearch } from './course-client';
import { courseIdentity } from './course-identity';
import {
  ChangedCampus,
  ChangedLabelInclusion,
  GotScheduleMessage,
  LoadedSavedCourses,
  RequestedRemoveSavedCourse,
  RequestedSaveCourse,
  RequestedToggleSavedListAction,
  SavedCoursesReady,
  StampedSavedCourse,
  savedListNoticeKey,
  SubmittedSavedNote,
  SucceededCourseSearch,
  UpdatedSavedNoteDraft,
  initForHref,
  normalizedUrl,
  update,
  Model,
} from './app';
import {
  attachLabel,
  createLabel,
  emptyLabelFilter,
  emptySavedList,
  filterLabel,
  findSavedCourse,
  saveCourse,
  type LabelFilter,
  type SavedListState,
} from './saved-courses';
import { Message as ScheduleMessage } from './features/schedule';

const savedAt = '2026-07-24T12:00:00.000Z';

const identity = (courseCode: string) => {
  const parsed = courseIdentity(courseCode);
  if (parsed === null) throw new Error(`Expected a valid course code: ${courseCode}`);
  return parsed;
};

const readyModel = (state: SavedListState = emptySavedList): Model => ({
  ...initForHref('http://course-lens.local/list').model,
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
  const initial = initForHref('http://course-lens.local/').model;
  const filtered = update(initial, ChangedCampus({ value: 'trondheim' })).model;
  const staleResponse = update(
    filtered,
    SucceededCourseSearch({
      requestKey: initial.activeRequestKey,
      append: false,
      response: fixtureSearchResponse(1),
    }),
  );

  expect(staleResponse.model).toBe(filtered);
  expect(staleResponse.commands ?? []).toEqual([]);
});

test('appended response pages remain valid application state', () => {
  const firstResponse = fixtureSearchResponse(1);
  const secondResponse = parseCourseSearch({
    ...firstResponse,
    items: firstResponse.items.map((item) => ({
      ...item,
      courseKey: `${item.courseKey}:next`,
      code: `N${item.code}`,
    })),
    meta: {
      ...firstResponse.meta,
      count: firstResponse.items.length,
      total: firstResponse.items.length * 2,
      page: 2,
      pageSize: 20,
      hasMore: false,
    },
  });
  const initial = initForHref('http://course-lens.local/').model;
  const first = update(
    initial,
    SucceededCourseSearch({
      requestKey: initial.activeRequestKey,
      append: false,
      response: firstResponse,
    }),
  ).model;
  const second = update(
    first,
    SucceededCourseSearch({
      requestKey: initial.activeRequestKey,
      append: true,
      response: secondResponse,
    }),
  ).model;

  const decoded = S.decodeUnknownSync(Model)(second);
  if (
    decoded.catalogue._tag !== 'CatalogueSuccess' &&
    decoded.catalogue._tag !== 'CataloguePartial'
  ) {
    throw new Error(`Expected an accumulated catalogue, got ${decoded.catalogue._tag}`);
  }
  expect(decoded.catalogue.response.items).toHaveLength(firstResponse.items.length * 2);
});
test('Schedule URL state round-trips through saved-course canonicalization and ignores stale responses', () => {
  const saved = saveCourse(emptySavedList, identity('TDT4136'), savedAt);
  const initial = initForHref(
    'http://course-lens.local/schedule?lang=en&term=2026-autumn&week=45&courses=TDT4136,UNKNOWN&hideActivity=TDT4136%3Aexercise&hideActivity=TDT4136%3Aexercise&hideActivity=TDT4136%3Apractice%3Aoptional&hideActivity=NOTSELECTED%3Aignored&hideActivity=UNKNOWN%3Aseminar',
  ).model;
  expect(initial.schedule.hiddenActivityKeys).toEqual([
    'TDT4136:exercise',
    'TDT4136:practice:optional',
    'UNKNOWN:seminar',
  ]);
  const loaded = update(
    initial,
    LoadedSavedCourses({
      load: { _tag: 'SavedListLoaded', state: saved, repairedEntries: 0 },
    }),
  );

  expect(loaded.model.route).toBe('schedule');
  expect(loaded.model.schedule.selectedCodes).toEqual(['TDT4136']);
  expect(loaded.model.schedule.hiddenActivityKeys).toEqual([
    'TDT4136:exercise',
    'TDT4136:practice:optional',
  ]);
  expect(commandNames(loaded.commands ?? [])).toEqual(['FetchSchedule', 'Navigate']);
  expect(normalizedUrl(loaded.model, null, '/schedule')).toBe(
    '/schedule?lang=en&term=2026-autumn&week=45&courses=TDT4136&hideActivity=TDT4136%3Aexercise&hideActivity=TDT4136%3Apractice%3Aoptional',
  );

  const canonical = update(
    loaded.model,
    GotScheduleMessage({
      message: ScheduleMessage.SucceededSchedule({
        requestKey: loaded.model.schedule.activeRequestKey,
        response: fixtureScheduleResponse(['TDT4136'], '2026-autumn', 45),
      }),
    }),
  );
  expect(canonical.model.schedule.hiddenActivityKeys).toEqual(['TDT4136:exercise']);
  expect(commandNames(canonical.commands ?? [])).toEqual(['Navigate']);
  expect(canonical.commands?.[0]?.args).toMatchObject({ mode: 'replace' });

  const toggled = update(
    canonical.model,
    GotScheduleMessage({
      message: ScheduleMessage.ToggledActivityVisibility({
        courseCode: 'TDT4136',
        activityCode: 'lecture',
        isVisible: false,
      }),
    }),
  );
  expect(commandNames(toggled.commands ?? [])).toEqual(['Navigate']);
  expect(normalizedUrl(toggled.model, null, '/schedule')).toBe(
    '/schedule?lang=en&term=2026-autumn&week=45&courses=TDT4136&hideActivity=TDT4136%3Aexercise&hideActivity=TDT4136%3Alecture',
  );

  const moved = update(
    toggled.model,
    GotScheduleMessage({
      message: ScheduleMessage.ChangedWeek({ value: '46' }),
    }),
  );
  const stale = update(
    moved.model,
    GotScheduleMessage({
      message: ScheduleMessage.SucceededSchedule({
        requestKey: canonical.model.schedule.activeRequestKey,
        response: fixtureScheduleResponse(['TDT4136'], '2026-autumn', 45),
      }),
    }),
  );

  expect(stale.model).toBe(moved.model);
  expect(stale.commands ?? []).toEqual([]);
});

test('saved-list persistence follows explicit save and note commits, never drafts', () => {
  const saveRequest = update(readyModel(), RequestedSaveCourse({ courseCode: 'TDT4136' }));
  expect(commandNames(saveRequest.commands ?? [])).toEqual(['StampSavedCourse']);

  const savedResult = update(
    saveRequest.model,
    StampedSavedCourse({ courseCode: 'TDT4136', savedAt }),
  );
  expect(commandNames(savedResult.commands ?? [])).toEqual(['PersistSavedCourses']);

  const draftedResult = update(
    savedResult.model,
    UpdatedSavedNoteDraft({ courseCode: 'TDT4136', value: 'Ask an adviser' }),
  );
  expect(draftedResult.commands ?? []).toEqual([]);
  expect(findSavedCourse(savedState(draftedResult.model), identity('TDT4136'))?.note).toBeNull();

  const committedResult = update(
    draftedResult.model,
    SubmittedSavedNote({ courseCode: 'TDT4136' }),
  );
  expect(commandNames(committedResult.commands ?? [])).toEqual(['PersistSavedCourses']);
  expect(findSavedCourse(savedState(committedResult.model), identity('TDT4136'))?.note).toBe(
    'Ask an adviser',
  );
});

test('saved-list undo and redo round-trip notes and label memberships', () => {
  const savedResult = update(readyModel(), StampedSavedCourse({ courseCode: 'TDT4136', savedAt }));
  const savedNotice = savedResult.model.savedListActions[0];
  if (savedNotice === undefined) throw new Error('Expected a reversible save action');
  const savedActionKey = savedListNoticeKey(savedNotice);

  const undoneSave = update(
    savedResult.model,
    RequestedToggleSavedListAction({ key: savedActionKey }),
  );
  expect(findSavedCourse(savedState(undoneSave.model), identity('TDT4136'))).toBeNull();
  expect(undoneSave.model.savedListActions[0]).toMatchObject({ isUndone: true });
  expect(commandNames(undoneSave.commands ?? [])).toEqual([
    'PersistSavedCourses',
    'RestoreSavedListFocus',
  ]);

  const redoneSave = update(
    undoneSave.model,
    RequestedToggleSavedListAction({ key: savedActionKey }),
  );
  expect(savedState(redoneSave.model)).toEqual(savedState(savedResult.model));
  expect(redoneSave.model.savedListActions[0]).toMatchObject({ isUndone: false });

  const labelled = createLabel(savedState(savedResult.model), {
    id: 'label-plan',
    name: 'Plan',
    color: 'sky',
  });
  if (labelled._tag !== 'LabelApplied') throw new Error('Expected a label');
  const attached = attachLabel(labelled.state, 'label-plan', [identity('TDT4136')]);
  const withNote: SavedListState = {
    ...attached,
    savedCourses: attached.savedCourses.map((course) => ({
      ...course,
      note: course.courseCode === 'TDT4136' ? 'Ask an adviser' : course.note,
    })),
  };

  const removed = update(
    readyModel(withNote),
    RequestedRemoveSavedCourse({ courseCode: 'TDT4136' }),
  );
  expect(findSavedCourse(savedState(removed.model), identity('TDT4136'))).toBeNull();
  const removedNotice = removed.model.savedListActions[0];
  if (removedNotice === undefined) throw new Error('Expected a reversible remove action');
  const removedActionKey = savedListNoticeKey(removedNotice);

  const restored = update(removed.model, RequestedToggleSavedListAction({ key: removedActionKey }));
  expect(savedState(restored.model)).toEqual(withNote);
  expect(restored.model.savedListActions[0]).toMatchObject({ isUndone: true });

  const removedAgain = update(
    restored.model,
    RequestedToggleSavedListAction({ key: removedActionKey }),
  );
  expect(findSavedCourse(savedState(removedAgain.model), identity('TDT4136'))).toBeNull();
  expect(removedAgain.model.savedListActions[0]).toMatchObject({ isUndone: false });

  const restoredAgain = update(
    removedAgain.model,
    RequestedToggleSavedListAction({ key: removedActionKey }),
  );
  expect(savedState(restoredAgain.model)).toEqual(withNote);
});

test('label-filter changes are URL-backed List transitions without catalogue refetches', () => {
  const saved = saveCourse(emptySavedList, identity('TDT4136'), savedAt);
  const labelled = createLabel(saved, { id: 'label-plan', name: 'Plan', color: 'sky' });
  if (labelled._tag !== 'LabelApplied') throw new Error('Expected a label');
  const filteredResult = update(
    readyModel(labelled.state),
    ChangedLabelInclusion({ predicate: filterLabel('label-plan'), isIncluded: true }),
  );
  const commands = filteredResult.commands ?? [];

  expect(filteredResult.model.labelFilter).toEqual({
    ...emptyLabelFilter,
    includeLabelIds: ['label-plan'],
  });
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
      const base = initForHref('http://course-lens.local/list').model;
      const url = normalizedUrl({ ...base, labelFilter }, null, '/list');
      const restored = initForHref(`http://course-lens.local${url}`).model;

      expect(restored.route).toBe('list');
      expect(restored.labelFilter).toEqual(labelFilter);
      expect(normalizedUrl(restored, null, '/list')).toBe(url);
    }),
    { numRuns: 100, seed: 0x55524c53 },
  );
});
