import { Dialog } from '@foldkit/ui';
import { Story } from 'foldkit';
import { expect, test } from 'vitest';

import { fixtureCourses } from './catalogue.fixture';

const fixtureCourseCodes = fixtureCourses.map((course) => course.code);
import {
  fixtureDecisionSignalsResponse,
  fixtureGradeSummariesResponse,
  fixtureSearchResponse,
} from './course-client';
import {
  ChangedColorMode,
  ChangedCampus,
  ChangedLabelDraftColor,
  ChangedLabelFilterMode,
  ChangedListDensity,
  ChangedLocale,
  ChangedThemePreset,
  ChangedUrl,
  CancelledLabelDelete,
  CancelledLabelEdit,
  CatalogueEmpty,
  ClearedSavedCourseSelection,
  CompletedNavigation,
  ConfirmedDeleteLabel,
  DismissedSavedListAction,
  FailedCourseSearch,
  FetchCourseSearch,
  FetchDecisionSignals,
  FetchGradeSignals,
  GotLabelDialogMessage,
  GradeSignalsSuccess,
  LoadedSavedCourses,
  Navigate,
  NextPageFailure,
  PersistSavedCourses,
  PersistedSavedCourses,
  RequestedDeleteLabel,
  RequestedEditLabel,
  RequestedLabelDialog,
  RequestedMoreCourses,
  RequestedRemoveSavedCourse,
  RequestedSaveCourse,
  RequestedSavedCoursesReset,
  RequestedUndoSavedListAction,
  SavedActionSaved,
  SavedCoursesReady,
  StampSavedCourse,
  StampedLabel,
  StampedSavedCourse,
  SubmittedLabelForm,
  SubmittedSavedNote,
  SubmittedSearch,
  SucceededCourseSearch,
  SucceededDecisionSignals,
  SucceededGradeSignals,
  ChangedLabelExclusion,
  ChangedLabelInclusion,
  ToggledLabelOnTarget,
  ToggledSavedCourseSelection,
  ToggledSidebar,
  UpdatedLabelDraftName,
  UpdatedQuery,
  UpdatedSavedNoteDraft,
  initForHref,
  parseExternalHttpsUrl,
  update,
  type Model,
} from './main';
import {
  SavedListCorrupt,
  SavedListEmpty,
  SavedListLoaded,
  SavedListUnsupported,
  attachLabel,
  courseIdentity,
  createLabel,
  defaultLabelColor,
  emptyLabelFilter,
  emptySavedList,
  filterLabel,
  filterUnlabeled,
  findSavedCourse,
  saveCourse,
  savedListSchemaVersion,
  type SavedListState,
} from './saved-courses';

const initialModel = () => initForHref('http://course-lens.local/')[0];

const savedAt = '2026-07-24T12:00:00.000Z';

const tdt4136 = courseIdentity('TDT4136')!;

const readyModel = (state = emptySavedList): Model => ({
  ...initialModel(),
  savedCourses: SavedCoursesReady({ state, repairedEntries: 0 }),
});

test('external product links accept only absolute HTTPS destinations', () => {
  expect(parseExternalHttpsUrl('https://example.com/support')).toBe('https://example.com/support');
  expect(parseExternalHttpsUrl('http://example.com/support')).toBeNull();
  expect(parseExternalHttpsUrl('/relative')).toBeNull();
  expect(parseExternalHttpsUrl('not a url')).toBeNull();
  expect(parseExternalHttpsUrl(undefined)).toBeNull();
});

test('locale is explicit URL-backed state and changes do not refetch the catalogue', () => {
  const initial = initialModel();
  const [localized, commands] = update(initial, ChangedLocale({ value: 'nb' }));

  expect(localized.locale).toBe('nb');
  expect(commands.map((command) => command.name)).toEqual(['PersistLocale', 'Navigate']);
  expect(commands.some((command) => command.name === 'FetchCourseSearch')).toBe(false);
  expect(initForHref('http://course-lens.local/?lang=nb')[0].locale).toBe('nb');
  expect(initForHref('http://course-lens.local/?lang=unsupported')[0].locale).toBe('en');
});

test('sidebar density is a local preference and does not alter catalogue state', () => {
  const initial = initialModel();
  const [collapsed, commands] = update(initial, ToggledSidebar());

  expect(collapsed.sidebarCollapsed).toBe(true);
  expect(commands.map((command) => command.name)).toEqual(['PersistSidebarPreference']);
  expect(collapsed.query).toBe(initial.query);
  expect(collapsed.activeRequestKey).toBe(initial.activeRequestKey);
  expect(initForHref('http://course-lens.local/', 'en', true)[0].sidebarCollapsed).toBe(true);
});

test('Nordic palettes and appearance are local preferences and do not refetch data', () => {
  const initial = initialModel();
  const [pine, presetCommands] = update(initial, ChangedThemePreset({ value: 'pine' }));
  const [dark, modeCommands] = update(pine, ChangedColorMode({ value: 'dark' }));

  expect(pine.themePreference).toMatchObject({
    baseColor: 'olive',
    themeColor: 'emerald',
    chartColor: 'indigo',
    mode: 'system',
  });
  expect(dark.themePreference.mode).toBe('dark');
  expect(presetCommands.map((command) => command.name)).toEqual(['PersistThemePreference']);
  expect(modeCommands.map((command) => command.name)).toEqual(['PersistThemePreference']);
  expect(
    [...presetCommands, ...modeCommands].some(({ name }) => name === 'FetchCourseSearch'),
  ).toBe(false);
});

test('Appearance is a destination, reached and left through the URL', () => {
  const initial = initialModel();
  expect(initial.route).toBe('explore');

  const [open] = update(
    initial,
    ChangedUrl({ href: 'http://course-lens.local/appearance?lang=en' }),
  );
  expect(open.route).toBe('appearance');

  const [back] = update(open, ChangedUrl({ href: 'http://course-lens.local/?lang=en' }));
  expect(back.route).toBe('explore');

  // Appearance used to be an overlay over whichever page you were on, so it
  // had a path per host route. That link still resolves to the destination.
  const [legacy] = update(
    initial,
    ChangedUrl({ href: 'http://course-lens.local/list/appearance?lang=en' }),
  );
  expect(legacy.route).toBe('appearance');
});

test('a catalogue response makes official courses available without opening detail', () => {
  const model = initialModel();
  Story.story(
    update,
    Story.with(model),
    Story.message(
      SucceededCourseSearch({
        requestKey: model.activeRequestKey,
        append: false,
        response: fixtureSearchResponse(1),
      }),
    ),
    Story.model((next) => {
      expect(next.catalogue._tag).toBe('CataloguePartial');
      expect(next.gradeSignals._tag).toBe('GradeSignalsLoading');
      expect(next.decisionSignals._tag).toBe('DecisionSignalsLoading');
      expect(next.selectedCode).toBeNull();
      expect(next.visibleCount).toBe(fixtureCourses.length);
    }),
    Story.Command.resolve(
      FetchGradeSignals,
      SucceededGradeSignals({
        requestKey: model.activeRequestKey,
        courseCodes: fixtureCourseCodes,
        response: fixtureGradeSummariesResponse(fixtureCourseCodes),
      }),
    ),
    Story.Command.resolve(
      FetchDecisionSignals,
      SucceededDecisionSignals({
        requestKey: model.activeRequestKey,
        courseCodes: fixtureCourseCodes,
        response: fixtureDecisionSignalsResponse(fixtureCourseCodes),
      }),
    ),
  );
});

test('grade responses enrich cards independently of the catalogue response', () => {
  const model = initialModel();
  const [loaded] = update(
    model,
    SucceededCourseSearch({
      requestKey: model.activeRequestKey,
      append: false,
      response: fixtureSearchResponse(1),
    }),
  );

  const [enriched] = update(
    loaded,
    SucceededGradeSignals({
      requestKey: model.activeRequestKey,
      courseCodes: fixtureCourseCodes,
      response: fixtureGradeSummariesResponse(fixtureCourseCodes),
    }),
  );

  expect(enriched.gradeSignals).toEqual(
    GradeSignalsSuccess({ response: fixtureGradeSummariesResponse(fixtureCourseCodes) }),
  );
});

test('stale decision enrichment is ignored after filters change', () => {
  const initial = initialModel();
  const [filtered] = update(initial, ChangedCampus({ value: 'trondheim' }));
  const [afterStaleResponse, commands] = update(
    filtered,
    SucceededDecisionSignals({
      requestKey: initial.activeRequestKey,
      courseCodes: fixtureCourseCodes,
      response: fixtureDecisionSignalsResponse(fixtureCourseCodes),
    }),
  );

  expect(afterStaleResponse).toBe(filtered);
  expect(afterStaleResponse.decisionSignals._tag).toBe('DecisionSignalsIdle');
  expect(commands).toEqual([]);
});

test('submitting a title or course-code query starts a fresh URL-backed search', () => {
  Story.story(
    update,
    Story.with(initialModel()),
    Story.message(UpdatedQuery({ value: '  algoritmer  ' })),
    Story.message(SubmittedSearch()),
    Story.Command.expectHas(Navigate),
    Story.Command.expectHas(FetchCourseSearch),
    Story.model((model) => {
      expect(model.query).toBe('algoritmer');
      expect(model.sort).toBe('relevance');
      expect(model.catalogue._tag).toBe('CatalogueInitialLoading');
      expect(model.activeRequestKey).toContain('algoritmer');
    }),
    Story.Command.resolve(Navigate, CompletedNavigation()),
    Story.Command.resolve(
      FetchCourseSearch,
      SucceededCourseSearch({
        requestKey: 'algoritmer|2026-autumn|relevance|all|all|true|false|false',
        append: false,
        response: fixtureSearchResponse(1),
      }),
    ),
    Story.Command.resolve(
      FetchGradeSignals,
      SucceededGradeSignals({
        requestKey: 'algoritmer|2026-autumn|relevance|all|all|true|false|false',
        courseCodes: fixtureCourseCodes,
        response: fixtureGradeSummariesResponse(fixtureCourseCodes),
      }),
    ),
    Story.Command.resolve(
      FetchDecisionSignals,
      SucceededDecisionSignals({
        requestKey: 'algoritmer|2026-autumn|relevance|all|all|true|false|false',
        courseCodes: fixtureCourseCodes,
        response: fixtureDecisionSignalsResponse(fixtureCourseCodes),
      }),
    ),
  );
});

test('an initial search failure is distinct from an empty result', () => {
  const model = initialModel();
  Story.story(
    update,
    Story.with(model),
    Story.message(
      FailedCourseSearch({
        requestKey: model.activeRequestKey,
        append: false,
        error: 'NTNU unavailable',
      }),
    ),
    Story.model((next) => {
      expect(next.catalogue).toMatchObject({
        _tag: 'CatalogueFailure',
        error: 'NTNU unavailable',
      });
      expect(next.catalogue).not.toEqual(CatalogueEmpty());
    }),
  );
});

test('a later-page failure preserves already loaded catalogue rows', () => {
  const model = initialModel();
  const response = {
    ...fixtureSearchResponse(1),
    meta: { ...fixtureSearchResponse(1).meta, hasMore: true },
  };
  Story.story(
    update,
    Story.with(model),
    Story.message(
      SucceededCourseSearch({
        requestKey: model.activeRequestKey,
        append: false,
        response,
      }),
    ),
    Story.Command.resolve(
      FetchGradeSignals,
      SucceededGradeSignals({
        requestKey: model.activeRequestKey,
        courseCodes: fixtureCourseCodes,
        response: fixtureGradeSummariesResponse(fixtureCourseCodes),
      }),
    ),
    Story.Command.resolve(
      FetchDecisionSignals,
      SucceededDecisionSignals({
        requestKey: model.activeRequestKey,
        courseCodes: fixtureCourseCodes,
        response: fixtureDecisionSignalsResponse(fixtureCourseCodes),
      }),
    ),
    Story.message(RequestedMoreCourses()),
    Story.Command.resolve(
      FetchCourseSearch,
      FailedCourseSearch({
        requestKey: model.activeRequestKey,
        append: true,
        error: 'Next page failed',
      }),
    ),
    Story.model((next) => {
      expect(next.catalogue._tag).toBe('CataloguePartial');
      expect(next.nextPage).toEqual(NextPageFailure({ error: 'Next page failed' }));
    }),
  );
});

test('show more reveals already loaded rows before requesting another provider page', () => {
  const model = initialModel();
  const fixture = fixtureSearchResponse(1);
  const items = Array.from({ length: 21 }, (_, index) => {
    const item = fixture.items[0]!;
    const code = `TEST${String(index + 1).padStart(3, '0')}`;
    return { ...item, courseKey: `NTNU:${code}`, code };
  });
  const [loaded] = update(
    model,
    SucceededCourseSearch({
      requestKey: model.activeRequestKey,
      append: false,
      response: {
        ...fixture,
        items,
        meta: { ...fixture.meta, count: items.length, total: items.length },
      },
    }),
  );

  const [revealed, commands] = update(loaded, RequestedMoreCourses());

  expect(revealed.visibleCount).toBe(21);
  expect(revealed.gradeSignals).toMatchObject({
    _tag: 'GradeSignalsLoading',
    pendingCodes: expect.arrayContaining(['TEST021']),
  });
  expect(revealed.decisionSignals).toMatchObject({
    _tag: 'DecisionSignalsLoading',
    pendingCodes: expect.arrayContaining(['TEST021']),
  });
  expect(commands).toHaveLength(2);
});

test('saved courses are loaded through a command rather than read while updating', () => {
  const [model, commands] = initForHref('http://course-lens.local/');

  expect(model.savedCourses._tag).toBe('SavedCoursesLoading');
  expect(commands.map(({ name }) => name)).toContain('LoadSavedCourses');

  const [loaded, loadCommands] = update(model, LoadedSavedCourses({ load: SavedListEmpty() }));

  expect(loaded.savedCourses).toEqual(
    SavedCoursesReady({ state: emptySavedList, repairedEntries: 0 }),
  );
  expect(loadCommands).toEqual([]);
});

test('saving a course stamps an observed time and persists the resulting state', () => {
  const model = readyModel();
  Story.story(
    update,
    Story.with(model),
    Story.message(RequestedSaveCourse({ courseCode: 'TDT4136' })),
    Story.Command.expectHas(StampSavedCourse),
    Story.Command.resolve(StampSavedCourse, StampedSavedCourse({ courseCode: 'TDT4136', savedAt })),
    Story.Command.expectHas(PersistSavedCourses),
    Story.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
    Story.model((next) => {
      const state = next.savedCourses._tag === 'SavedCoursesReady' ? next.savedCourses.state : null;
      expect(state?.savedCourses).toEqual([
        {
          id: 'ntnu:TDT4136',
          institutionId: 'ntnu',
          courseCode: 'TDT4136',
          savedAt,
          note: null,
          observedDataRevision: null,
        },
      ]);
    }),
  );
});

test('saving an already saved course is idempotent and writes nothing', () => {
  const model = readyModel(saveCourse(emptySavedList, tdt4136, savedAt));
  const [next, commands] = update(model, RequestedSaveCourse({ courseCode: 'tdt4136' }));

  expect(next).toBe(model);
  expect(commands).toEqual([]);
});

test('removing a saved course clears its note draft and persists in one transition', () => {
  const saved = readyModel(saveCourse(emptySavedList, tdt4136, savedAt));
  const [drafted] = update(saved, UpdatedSavedNoteDraft({ courseCode: 'TDT4136', value: 'Ask' }));
  const [removed, commands] = update(
    drafted,
    RequestedRemoveSavedCourse({ courseCode: 'TDT4136' }),
  );

  const state =
    removed.savedCourses._tag === 'SavedCoursesReady' ? removed.savedCourses.state : null;
  expect(state?.savedCourses).toEqual([]);
  expect(state?.memberships).toEqual([]);
  expect(removed.noteDrafts).toEqual([]);
  expect(commands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(commands[0]?.args).toMatchObject({ state: emptySavedList });
});

test('a note is committed from an explicit draft and stored with the identity', () => {
  const saved = readyModel(saveCourse(emptySavedList, tdt4136, savedAt));
  const [drafted, draftCommands] = update(
    saved,
    UpdatedSavedNoteDraft({ courseCode: 'TDT4136', value: '  Clashes with TMA4100  ' }),
  );

  expect(draftCommands).toEqual([]);

  const [noted, commands] = update(drafted, SubmittedSavedNote({ courseCode: 'TDT4136' }));
  const state = noted.savedCourses._tag === 'SavedCoursesReady' ? noted.savedCourses.state : null;

  expect(state === null ? null : findSavedCourse(state, tdt4136)?.note).toBe(
    'Clashes with TMA4100',
  );
  expect(noted.noteDrafts).toEqual([]);
  expect(commands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
});

test('a save carries an explicit confirmation that Undo removes, persisting the removal', () => {
  const model = readyModel();
  const [saved, saveCommands] = update(
    model,
    StampedSavedCourse({ courseCode: 'TDT4136', savedAt }),
  );

  expect(saved.savedListActions[0]).toMatchObject({
    _tag: 'SavedActionSaved',
    courseCode: 'TDT4136',
  });
  expect(saveCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);

  const [undone, undoCommands] = update(
    saved,
    RequestedUndoSavedListAction({ key: 'saved:TDT4136' }),
  );
  const state = undone.savedCourses._tag === 'SavedCoursesReady' ? undone.savedCourses.state : null;

  expect(state?.savedCourses).toEqual([]);
  expect(undone.savedListActions).toEqual([]);
  expect(undoCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(undoCommands[0]?.args).toMatchObject({ state: emptySavedList });
});

test('undoing a removal restores the exact saved course, its note, and its label memberships', () => {
  const savedWithLabel: SavedListState = {
    version: savedListSchemaVersion,
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

  const [removed, removeCommands] = update(
    readyModel(savedWithLabel),
    RequestedRemoveSavedCourse({ courseCode: 'TDT4136' }),
  );
  const removedState =
    removed.savedCourses._tag === 'SavedCoursesReady' ? removed.savedCourses.state : null;

  expect(removedState).toEqual({ ...emptySavedList, labels: savedWithLabel.labels });
  expect(removed.savedListActions[0]).toMatchObject({
    _tag: 'SavedActionRemoved',
    // Removing one course and removing several are the same act on sets of
    // different size, so the action always carries a set.
    courses: [savedWithLabel.savedCourses[0]],
    memberships: savedWithLabel.memberships,
  });
  expect(removeCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);

  const [restored, undoCommands] = update(
    removed,
    // A removal's notice is keyed by the removal, not by the earlier save.
    RequestedUndoSavedListAction({ key: 'removed:TDT4136' }),
  );
  const restoredState =
    restored.savedCourses._tag === 'SavedCoursesReady' ? restored.savedCourses.state : null;

  expect(restoredState).toEqual(savedWithLabel);
  expect(restored.savedListActions).toEqual([]);
  expect(undoCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(undoCommands[0]?.args).toMatchObject({ state: savedWithLabel });
});

test('a repeated Undo is inert once the ephemeral snapshot has already been consumed', () => {
  const model = readyModel();
  const [saved] = update(model, StampedSavedCourse({ courseCode: 'TDT4136', savedAt }));
  const [firstUndo, firstCommands] = update(
    saved,
    RequestedUndoSavedListAction({ key: 'saved:TDT4136' }),
  );

  expect(firstCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(firstUndo.savedListActions).toEqual([]);

  const [secondUndo, secondCommands] = update(
    firstUndo,
    RequestedUndoSavedListAction({ key: 'saved:TDT4136' }),
  );

  expect(secondUndo).toBe(firstUndo);
  expect(secondCommands).toEqual([]);
});

test('dismissing the saved-list status clears the snapshot without persisting anything', () => {
  const model = readyModel();
  const [saved] = update(model, StampedSavedCourse({ courseCode: 'TDT4136', savedAt }));
  const [dismissed, commands] = update(saved, DismissedSavedListAction({ key: 'saved:TDT4136' }));

  expect(dismissed.savedListActions).toEqual([]);
  expect(commands).toEqual([]);
});

test('unreadable stored state becomes a recovery state and never overwrites itself', () => {
  const [recovering, commands] = update(
    initialModel(),
    LoadedSavedCourses({ load: SavedListCorrupt({ reason: 'invalid-json', raw: '{oops' }) }),
  );

  expect(recovering.savedCourses).toMatchObject({
    _tag: 'SavedCoursesRecovery',
    reason: 'invalid-json',
    raw: '{oops',
  });
  expect(commands).toEqual([]);

  const [afterSave, saveCommands] = update(
    recovering,
    RequestedSaveCourse({ courseCode: 'TDT4136' }),
  );
  expect(afterSave).toBe(recovering);
  expect(saveCommands).toEqual([]);

  const [reset, resetCommands] = update(recovering, RequestedSavedCoursesReset());
  expect(reset.savedCourses).toEqual(
    SavedCoursesReady({ state: emptySavedList, repairedEntries: 0 }),
  );
  expect(resetCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
});

test('a newer stored schema version is reported rather than reinterpreted', () => {
  const raw = JSON.stringify({ version: 2 });
  const [recovering, commands] = update(
    initialModel(),
    LoadedSavedCourses({ load: SavedListUnsupported({ storedVersion: 2, raw }) }),
  );

  expect(recovering.savedCourses).toMatchObject({
    _tag: 'SavedCoursesRecovery',
    reason: 'unsupported-version',
    storedVersion: 2,
  });
  expect(commands).toEqual([]);
});

test('repaired stored state is written back so storage matches what is shown', () => {
  const state = saveCourse(emptySavedList, tdt4136, savedAt);
  const [model, commands] = update(
    initialModel(),
    LoadedSavedCourses({ load: SavedListLoaded({ state, repairedEntries: 2 }) }),
  );

  expect(model.savedCourses).toMatchObject({ _tag: 'SavedCoursesReady', repairedEntries: 2 });
  expect(commands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
});

test('List is a canonical route that keeps Explore state without refetching the catalogue', () => {
  const [searched] = update(initialModel(), ChangedCampus({ value: 'trondheim' }));
  const [listed, commands] = update(
    searched,
    ChangedUrl({ href: 'http://course-lens.local/list?lang=en&campus=trondheim' }),
  );

  expect(listed.route).toBe('list');
  expect(listed.campus).toBe('trondheim');
  expect(listed.selectedCode).toBeNull();
  expect(commands.some(({ name }) => name === 'FetchCourseSearch')).toBe(false);

  const [languageChanged, languageCommands] = update(listed, ChangedLocale({ value: 'nb' }));
  expect(languageChanged.route).toBe('list');
  expect(languageCommands.find(({ name }) => name === 'Navigate')?.args).toMatchObject({
    href: '/list?lang=nb&campus=trondheim',
  });
});

test('a direct List visit loads saved courses and keeps course detail out of the route', () => {
  const [model, commands] = initForHref('http://course-lens.local/list?course=TDT4136');

  expect(model.route).toBe('list');
  expect(model.selectedCode).toBeNull();
  expect(commands.map(({ name }) => name)).toContain('LoadSavedCourses');
  expect(commands.some(({ name }) => name === 'FetchCourseInsight')).toBe(false);
});

const listModel = (state: SavedListState, href = 'http://course-lens.local/list'): Model => ({
  ...initForHref(href)[0],
  savedCourses: SavedCoursesReady({ state, repairedEntries: 0 }),
});

const twoSavedCourses = (): SavedListState =>
  saveCourse(
    saveCourse(emptySavedList, tdt4136, '2026-07-24T10:00:00.000Z'),
    courseIdentity('TMA4100')!,
    '2026-07-25T10:00:00.000Z',
  );

const labelledState = (): SavedListState => {
  const state = twoSavedCourses();
  const created = createLabel(state, { id: 'label-ai', name: 'AI', color: 'sky' });
  if (created._tag !== 'LabelApplied') throw new Error('fixture label must be created');
  return attachLabel(created.state, 'label-ai', [tdt4136]);
};

const readyStateOf = (model: Model): SavedListState => {
  if (model.savedCourses._tag !== 'SavedCoursesReady') {
    throw new Error(`expected ready saved courses, got ${model.savedCourses._tag}`);
  }
  return model.savedCourses.state;
};

test('a label id comes from a boundary command, never from the pure update', () => {
  const model = listModel(twoSavedCourses());
  const [targeted] = update(model, RequestedLabelDialog({ courseCodes: ['TDT4136'] }));
  const [named, nameCommands] = update(targeted, UpdatedLabelDraftName({ value: ' Autumn 2027 ' }));

  expect(nameCommands).toEqual([]);

  const [submitted, submitCommands] = update(named, SubmittedLabelForm());

  expect(readyStateOf(submitted).labels).toEqual([]);
  expect(submitCommands.map(({ name }) => name)).toEqual(['StampLabel']);

  const [created, createCommands] = update(submitted, StampedLabel({ labelId: 'label-1' }));
  const state = readyStateOf(created);

  expect(state.labels).toEqual([{ id: 'label-1', name: 'Autumn 2027', color: 'sky' }]);
  // A label created from a course target is attached in the same transition.
  expect(state.memberships).toEqual([{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-1' }]);
  expect(created.labelDraftName).toBe('');
  expect(createCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
});

test('a duplicate label name is rejected before an id is minted and keeps the draft', () => {
  const model = { ...listModel(labelledState()), labelDraftName: 'ai' };
  const [rejected, commands] = update(model, SubmittedLabelForm());

  expect(commands).toEqual([]);
  expect(rejected.labelError).toBe('duplicate-name');
  expect(rejected.labelDraftName).toBe('ai');
  expect(readyStateOf(rejected).labels).toHaveLength(1);
});

test('renaming and recolouring a label is one persisted transition that keeps memberships', () => {
  const model = listModel(labelledState());
  const [editing] = update(model, RequestedEditLabel({ labelId: 'label-ai' }));

  expect(editing.labelDraftName).toBe('AI');
  expect(editing.labelDraftColor).toBe('sky');

  const [renamed] = update(editing, UpdatedLabelDraftName({ value: 'Artificial intelligence' }));
  const [recoloured] = update(renamed, ChangedLabelDraftColor({ value: 'emerald' }));
  const [saved, commands] = update(recoloured, SubmittedLabelForm());
  const state = readyStateOf(saved);

  expect(state.labels).toEqual([
    { id: 'label-ai', name: 'Artificial intelligence', color: 'emerald' },
  ]);
  expect(state.memberships).toEqual([{ savedCourseId: 'ntnu:TDT4136', labelId: 'label-ai' }]);
  expect(saved.labelEditing).toBeNull();
  expect(commands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
});

test('attaching and detaching a label across a selection is one transition each way', () => {
  const model = {
    ...listModel(labelledState()),
    selectedCourseCodes: ['TDT4136', 'TMA4100'],
    labelDialogTarget: ['TDT4136', 'TMA4100'],
  };

  const [attached, attachCommands] = update(
    model,
    ToggledLabelOnTarget({ labelId: 'label-ai', isAttached: true }),
  );

  expect(readyStateOf(attached).memberships).toEqual([
    { savedCourseId: 'ntnu:TDT4136', labelId: 'label-ai' },
    { savedCourseId: 'ntnu:TMA4100', labelId: 'label-ai' },
  ]);
  expect(attachCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(readyStateOf(attached).savedCourses).toHaveLength(2);

  const [detached] = update(
    attached,
    ToggledLabelOnTarget({ labelId: 'label-ai', isAttached: false }),
  );
  expect(readyStateOf(detached).memberships).toEqual([]);
});

test('requesting a label delete only arms an in-dialog confirmation; nothing is removed yet', () => {
  const model = listModel(labelledState());
  const [armed, commands] = update(model, RequestedDeleteLabel({ labelId: 'label-ai' }));
  const state = readyStateOf(armed);

  expect(armed.labelPendingDelete).toBe('label-ai');
  expect(state.labels).toEqual(labelledState().labels);
  expect(state.memberships).toEqual(labelledState().memberships);
  expect(commands).toEqual([]);
});

test('cancelling an armed label delete preserves the label and its memberships exactly', () => {
  const model = listModel(labelledState());
  const [armed] = update(model, RequestedDeleteLabel({ labelId: 'label-ai' }));
  const [cancelled, commands] = update(armed, CancelledLabelDelete());

  expect(cancelled.labelPendingDelete).toBeNull();
  expect(readyStateOf(cancelled)).toEqual(labelledState());
  expect(commands).toEqual([]);
});

test('confirming an armed label delete clears its memberships and rewrites the filter to the canonical recipe', () => {
  const model = {
    ...listModel(labelledState()),
    labelFilter: { ...emptyLabelFilter, includeLabelIds: ['label-ai'] },
  };

  const [armed] = update(model, RequestedDeleteLabel({ labelId: 'label-ai' }));
  const [deleted, commands] = update(armed, ConfirmedDeleteLabel({ labelId: 'label-ai' }));
  const state = readyStateOf(deleted);

  expect(deleted.labelPendingDelete).toBeNull();
  expect(state.labels).toEqual([]);
  expect(state.memberships).toEqual([]);
  expect(state.savedCourses).toHaveLength(2);
  expect(deleted.labelFilter).toEqual(emptyLabelFilter);
  expect(commands.map(({ name }) => name)).toEqual(['PersistSavedCourses', 'Navigate']);
  expect(commands.find(({ name }) => name === 'Navigate')?.args).toMatchObject({
    href: '/list?lang=en',
    mode: 'replace',
  });
});

test('a label filter change is a history entry that never refetches the catalogue', () => {
  const model = listModel(labelledState());
  const [filtered, commands] = update(
    model,
    ChangedLabelInclusion({ predicate: filterLabel('label-ai'), isIncluded: true }),
  );

  expect(filtered.labelFilter.includeLabelIds).toEqual(['label-ai']);
  expect(commands.map(({ name }) => name)).toEqual(['Navigate']);
  expect(commands[0]?.args).toMatchObject({
    href: '/list?lang=en&labels=label-ai',
    mode: 'push',
  });
  expect(commands.some(({ name }) => name === 'FetchCourseSearch')).toBe(false);

  const [back, backCommands] = update(
    filtered,
    ChangedUrl({ href: 'http://course-lens.local/list?lang=en' }),
  );

  expect(back.labelFilter).toEqual(emptyLabelFilter);
  expect(backCommands.some(({ name }) => name === 'FetchCourseSearch')).toBe(false);
});

test('All and Exclude are URL-backed and Explore URLs never carry the recipe', () => {
  const model = listModel(labelledState());
  const [included] = update(
    model,
    ChangedLabelInclusion({ predicate: filterLabel('label-ai'), isIncluded: true }),
  );
  const [strict, strictCommands] = update(included, ChangedLabelFilterMode({ mode: 'all' }));

  expect(strictCommands[0]?.args).toMatchObject({
    href: '/list?lang=en&labels=label-ai&labelMode=all',
  });

  const [excluded, excludeCommands] = update(
    strict,
    ChangedLabelExclusion({ predicate: filterLabel('label-ai'), isExcluded: true }),
  );

  // Last explicit action wins: moving a label to Exclude removes it from Include.
  expect(excluded.labelFilter).toEqual({
    ...emptyLabelFilter,
    includeMode: 'all',
    excludeLabelIds: ['label-ai'],
  });
  expect(excludeCommands[0]?.args).toMatchObject({
    href: '/list?lang=en&labelMode=all&notLabels=label-ai',
  });

  // A duplicate identical message — e.g. a Checkbox click that bubbles from
  // the control to its wrapping label and dispatches twice — sets the same
  // desired state again rather than toggling back off.
  const [excludedAgain, excludeAgainCommands] = update(
    excluded,
    ChangedLabelExclusion({ predicate: filterLabel('label-ai'), isExcluded: true }),
  );
  expect(excludedAgain.labelFilter).toEqual(excluded.labelFilter);
  expect(excludeAgainCommands).toEqual([]);

  const [explore] = update(
    excluded,
    ChangedUrl({ href: 'http://course-lens.local/?lang=en&labels=label-ai' }),
  );
  expect(explore.route).toBe('explore');
  expect(explore.labelFilter).toEqual(emptyLabelFilter);
});

test('a shared recipe is normalized against the loaded label set and restated, not failed', () => {
  const [model] = initForHref(
    'http://course-lens.local/list?labels=label-ai,label-gone&labelMode=all&notLabels=label-ai',
  );

  expect(model.labelFilter).toEqual({
    ...emptyLabelFilter,
    includeLabelIds: ['label-ai', 'label-gone'],
    includeMode: 'all',
    excludeLabelIds: ['label-ai'],
  });

  const [loaded, commands] = update(
    model,
    LoadedSavedCourses({ load: SavedListLoaded({ state: labelledState(), repairedEntries: 0 }) }),
  );

  // Exclude wins for a URL with no action order, unknown ids are dropped, and
  // both facts are kept for the interface to restate.
  expect(loaded.labelFilter).toEqual({
    ...emptyLabelFilter,
    includeMode: 'all',
    excludeLabelIds: ['label-ai'],
  });
  expect(loaded.labelFilterNotice).toEqual({
    unknownCount: 1,
    contradictoryLabelIds: ['label-ai'],
    contradictoryUnlabeled: false,
  });
  expect(commands.map(({ name }) => name)).toEqual(['Navigate']);
  expect(commands[0]?.args).toMatchObject({
    href: '/list?lang=en&labelMode=all&notLabels=label-ai',
    mode: 'replace',
  });
  expect(commands.some(({ name }) => name === 'FetchCourseSearch')).toBe(false);
});

test('selection is ephemeral: it stays out of the URL and cannot outlive its course', () => {
  const model = listModel(labelledState());
  const [selected, selectCommands] = update(
    model,
    ToggledSavedCourseSelection({ courseCode: 'TDT4136', isSelected: true }),
  );

  expect(selected.selectedCourseCodes).toEqual(['TDT4136']);
  expect(selectCommands).toEqual([]);

  const [removed] = update(selected, RequestedRemoveSavedCourse({ courseCode: 'TDT4136' }));
  expect(removed.selectedCourseCodes).toEqual([]);
  expect(removed.labelDialogTarget).toEqual([]);

  const [cleared] = update(selected, ClearedSavedCourseSelection());
  expect(cleared.selectedCourseCodes).toEqual([]);
});

test('label actions are inert while saved state is unreadable', () => {
  const [recovering] = update(
    initForHref('http://course-lens.local/list')[0],
    LoadedSavedCourses({ load: SavedListCorrupt({ reason: 'invalid-json', raw: '{oops' }) }),
  );
  const drafted = { ...recovering, labelDraftName: 'Autumn 2027' };

  expect(update(drafted, SubmittedLabelForm())).toEqual([drafted, []]);
  expect(update(drafted, StampedLabel({ labelId: 'label-1' }))).toEqual([drafted, []]);
  expect(update(drafted, RequestedDeleteLabel({ labelId: 'label-ai' }))).toEqual([drafted, []]);
  expect(update(drafted, ConfirmedDeleteLabel({ labelId: 'label-ai' }))).toEqual([drafted, []]);
  expect(update(drafted, ToggledLabelOnTarget({ labelId: 'label-ai', isAttached: true }))).toEqual([
    drafted,
    [],
  ]);
});

test('undoing a save also drops the course from selection and label targets', () => {
  const model = {
    ...listModel(labelledState()),
    savedListActions: [SavedActionSaved({ courseCode: 'TDT4136' })],
    selectedCourseCodes: ['TDT4136', 'TMA4100'],
    labelDialogTarget: ['TDT4136'],
  };

  const [undone] = update(model, RequestedUndoSavedListAction({ key: 'saved:TDT4136' }));

  expect(readyStateOf(undone).savedCourses.map((course) => course.courseCode)).toEqual(['TMA4100']);
  expect(undone.selectedCourseCodes).toEqual(['TMA4100']);
  expect(undone.labelDialogTarget).toEqual([]);
});

test('choosing a colour is draft state: it never creates, updates, or attaches a label', () => {
  const [open] = update(
    listModel(labelledState()),
    RequestedLabelDialog({ courseCodes: ['TDT4136'] }),
  );
  const named = update(open, UpdatedLabelDraftName({ value: 'Autumn 2027' }))[0];
  const before = readyStateOf(named);

  const [recoloured, commands] = update(named, ChangedLabelDraftColor({ value: 'emerald' }));

  expect(recoloured.labelDraftColor).toBe('emerald');
  expect(commands).toEqual([]);
  expect(readyStateOf(recoloured)).toBe(before);

  // The same holds while editing an existing label: the colour moves in the
  // draft only, and the stored label is untouched until Apply.
  const [editing] = update(named, RequestedEditLabel({ labelId: 'label-ai' }));
  const [editRecoloured, editCommands] = update(editing, ChangedLabelDraftColor({ value: 'rose' }));

  expect(editCommands).toEqual([]);
  expect(readyStateOf(editRecoloured).labels).toEqual(labelledState().labels);
});

test('closing the dialog by any route discards the draft, including the chosen colour', () => {
  const [open] = update(
    listModel(labelledState()),
    RequestedLabelDialog({ courseCodes: ['TDT4136'] }),
  );
  const drafted = {
    ...update(open, UpdatedLabelDraftName({ value: 'Autumn 2027' }))[0],
    labelDraftColor: 'rose' as const,
    labelError: 'empty-name' as const,
  };

  // Cancel, the backdrop, and Escape all reach update as one close request.
  const [closed] = update(drafted, GotLabelDialogMessage({ message: Dialog.RequestedClose() }));

  expect(closed.labelDraftName).toBe('');
  expect(closed.labelDraftColor).toBe(defaultLabelColor);
  expect(closed.labelError).toBeNull();
  expect(closed.labelEditing).toBeNull();
  expect(closed.labelDialogTarget).toEqual([]);
  expect(readyStateOf(closed)).toEqual(labelledState());

  // Cancelling an edit discards the same draft without closing the dialog.
  const [editing] = update(drafted, RequestedEditLabel({ labelId: 'label-ai' }));
  const [cancelled] = update(editing, CancelledLabelEdit());
  expect(cancelled.labelDraftName).toBe('');
  expect(cancelled.labelDraftColor).toBe(defaultLabelColor);
  expect(cancelled.labelEditing).toBeNull();
});

test('name feedback is absent until an Apply attempt, then follows the draft being corrected', () => {
  const [open] = update(
    listModel(labelledState()),
    RequestedLabelDialog({ courseCodes: ['TDT4136'] }),
  );

  // Typing an empty, then duplicate, name says nothing before Apply is pressed.
  const typed = update(open, UpdatedLabelDraftName({ value: 'ai' }))[0];
  expect(typed.labelError).toBeNull();

  const [rejected] = update(typed, SubmittedLabelForm());
  expect(rejected.labelError).toBe('duplicate-name');

  // While correcting, the message tracks the draft rather than disappearing on
  // the first keystroke or describing a name that is no longer on screen.
  const [emptied] = update(rejected, UpdatedLabelDraftName({ value: '   ' }));
  expect(emptied.labelError).toBe('empty-name');

  const [stillDuplicate] = update(emptied, UpdatedLabelDraftName({ value: 'AI' }));
  expect(stillDuplicate.labelError).toBe('duplicate-name');

  const [corrected] = update(stillDuplicate, UpdatedLabelDraftName({ value: 'Autumn 2027' }));
  expect(corrected.labelError).toBeNull();
});

test('a refused create attaches nothing and leaves the draft exactly as it was', () => {
  const model = {
    ...listModel(labelledState()),
    labelDialogTarget: ['TDT4136'],
    labelDraftName: 'ai',
    labelDraftColor: 'rose' as const,
  };

  // The id arrives from the boundary, but the rules are checked again with it in
  // hand, so a slow round trip cannot smuggle a duplicate past them.
  const [refused, commands] = update(model, StampedLabel({ labelId: 'label-late' }));

  expect(commands).toEqual([]);
  expect(refused.labelError).toBe('duplicate-name');
  expect(refused.labelDraftName).toBe('ai');
  expect(refused.labelDraftColor).toBe('rose');
  expect(readyStateOf(refused)).toEqual(labelledState());
});

test('Unlabeled is URL-backed like any other predicate and stays canonical', () => {
  const model = listModel(labelledState());
  const [included, includeCommands] = update(
    model,
    ChangedLabelInclusion({ predicate: filterUnlabeled, isIncluded: true }),
  );

  expect(included.labelFilter).toEqual({ ...emptyLabelFilter, includeUnlabeled: true });
  expect(includeCommands[0]?.args).toMatchObject({
    href: '/list?lang=en&unlabeled=1',
    mode: 'push',
  });

  // A duplicate identical message asks for the same state again rather than
  // toggling it back off.
  const [again, againCommands] = update(
    included,
    ChangedLabelInclusion({ predicate: filterUnlabeled, isIncluded: true }),
  );
  expect(again.labelFilter).toEqual(included.labelFilter);
  expect(againCommands).toEqual([]);

  const [excluded, excludeCommands] = update(
    included,
    ChangedLabelExclusion({ predicate: filterUnlabeled, isExcluded: true }),
  );
  expect(excluded.labelFilter).toEqual({ ...emptyLabelFilter, excludeUnlabeled: true });
  expect(excludeCommands[0]?.args).toMatchObject({ href: '/list?lang=en&notUnlabeled=1' });

  // History restores the recipe from the URL without refetching the catalogue.
  const [restored, restoredCommands] = update(
    excluded,
    ChangedUrl({ href: 'http://course-lens.local/list?lang=en&unlabeled=1&labelMode=all' }),
  );
  expect(restored.labelFilter).toEqual({
    ...emptyLabelFilter,
    includeUnlabeled: true,
    includeMode: 'all',
  });
  expect(restoredCommands.some(({ name }) => name === 'FetchCourseSearch')).toBe(false);
});

test('including a label is a set, so a stale history echo cannot drop the second one', () => {
  const model = listModel(labelledState());
  const ai = ChangedLabelInclusion({ predicate: filterLabel('label-ai'), isIncluded: true });
  const heavy = ChangedLabelInclusion({ predicate: filterLabel('label-heavy'), isIncluded: true });

  const [first] = update(model, ai);
  const [second] = update(first, heavy);
  expect(second.labelFilter.includeLabelIds).toEqual(['label-ai', 'label-heavy']);

  // The first navigation's echo can land after the second chip was pressed.
  const [echoed] = update(
    second,
    ChangedUrl({ href: 'http://course-lens.local/list?lang=en&labels=label-ai' }),
  );
  // The echo is the URL's own claim about the recipe, so it wins — but pressing
  // the chip again asks for the same state rather than flipping it back off.
  const [repaired] = update(echoed, heavy);
  expect(repaired.labelFilter.includeLabelIds).toEqual(['label-ai', 'label-heavy']);
  expect(update(repaired, heavy)[1]).toEqual([]);
});

test('the display density is a local preference: it persists and never touches the saved set', () => {
  const model = listModel(labelledState());
  expect(model.listDensity).toBe('card');

  const [compact, commands] = update(model, ChangedListDensity({ value: 'compact' }));

  expect(compact.listDensity).toBe('compact');
  expect(commands.map(({ name }) => name)).toEqual(['PersistListDensity']);
  expect(commands[0]?.args).toMatchObject({ density: 'compact' });
  // Density is a display choice: no navigation, no fetch, and the same courses,
  // labels, and memberships as before.
  expect(commands.some(({ name }) => name === 'Navigate')).toBe(false);
  expect(readyStateOf(compact)).toBe(readyStateOf(model));
  expect(compact.labelFilter).toEqual(model.labelFilter);

  // Choosing the density that is already active is a no-op, not a rewrite.
  expect(update(compact, ChangedListDensity({ value: 'compact' }))).toEqual([compact, []]);

  // A stored preference is honoured on the next visit.
  expect(
    initForHref('http://course-lens.local/list', 'en', false, undefined, 'compact')[0].listDensity,
  ).toBe('compact');
});

test('a shared recipe that includes and excludes Unlabeled is restated, not silently emptied', () => {
  const [model] = initForHref('http://course-lens.local/list?unlabeled=1&notUnlabeled=1');

  expect(model.labelFilter).toEqual({
    ...emptyLabelFilter,
    includeUnlabeled: true,
    excludeUnlabeled: true,
  });

  const [loaded, commands] = update(
    model,
    LoadedSavedCourses({ load: SavedListLoaded({ state: labelledState(), repairedEntries: 0 }) }),
  );

  // Exclude wins for a URL with no action order, and the rewrite is disclosed.
  expect(loaded.labelFilter).toEqual({ ...emptyLabelFilter, excludeUnlabeled: true });
  expect(loaded.labelFilterNotice).toEqual({
    unknownCount: 0,
    contradictoryLabelIds: [],
    contradictoryUnlabeled: true,
  });
  expect(commands[0]?.args).toMatchObject({
    href: '/list?lang=en&notUnlabeled=1',
    mode: 'replace',
  });
});
