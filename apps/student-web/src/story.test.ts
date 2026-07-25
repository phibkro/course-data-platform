import { Story } from 'foldkit';
import { expect, test } from 'vitest';

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
  ChangedLocale,
  ChangedThemePreset,
  ChangedUrl,
  CancelledLabelDelete,
  CatalogueEmpty,
  ClearedSavedCourseSelection,
  CompletedNavigation,
  ConfirmedDeleteLabel,
  DismissedSavedListAction,
  FailedCourseSearch,
  FetchCourseSearch,
  FetchDecisionSignals,
  FetchGradeSignals,
  GradeSignalsSuccess,
  LoadedSavedCourses,
  Navigate,
  NextPageFailure,
  PersistSavedCourses,
  PersistedSavedCourses,
  RequestedAppearance,
  RequestedDeleteLabel,
  RequestedEditLabel,
  RequestedLabelDialog,
  RequestedMoreCourses,
  RequestedRemoveSavedCourse,
  RequestedSaveCourse,
  RequestedSavedCoursesReset,
  RequestedUndoSavedListAction,
  SavedActionIdle,
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
  ToggledLabelExclude,
  ToggledLabelInclude,
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
  emptyLabelFilter,
  emptySavedList,
  findSavedCourse,
  saveCourse,
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

test('the Appearance modal is URL-backed and follows browser history changes', () => {
  const initial = initialModel();
  const [requested, requestCommands] = update(initial, RequestedAppearance());

  expect(requested.appearanceDialog.isOpen).toBe(false);
  expect(requestCommands.map(({ name }) => name)).toEqual(['Navigate']);
  expect(requestCommands[0]?.args).toMatchObject({ href: '/appearance?lang=en', mode: 'push' });

  const [open, openCommands] = update(
    requested,
    ChangedUrl({ href: 'http://course-lens.local/appearance?lang=en' }),
  );
  expect(open.appearanceDialog.isOpen).toBe(true);
  expect(openCommands.map(({ name }) => name)).toContain('ShowDialog');

  const [closed, closeCommands] = update(
    open,
    ChangedUrl({ href: 'http://course-lens.local/?lang=en' }),
  );
  expect(closed.appearanceDialog.isOpen).toBe(false);
  expect(closeCommands.map(({ name }) => name)).toContain('RequestFrame');
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
      expect(next.visibleCount).toBe(1);
    }),
    Story.Command.resolve(
      FetchGradeSignals,
      SucceededGradeSignals({
        requestKey: model.activeRequestKey,
        courseCodes: ['TDT4136'],
        response: fixtureGradeSummariesResponse(['TDT4136']),
      }),
    ),
    Story.Command.resolve(
      FetchDecisionSignals,
      SucceededDecisionSignals({
        requestKey: model.activeRequestKey,
        courseCodes: ['TDT4136'],
        response: fixtureDecisionSignalsResponse(['TDT4136']),
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
      courseCodes: ['TDT4136'],
      response: fixtureGradeSummariesResponse(['TDT4136']),
    }),
  );

  expect(enriched.gradeSignals).toEqual(
    GradeSignalsSuccess({ response: fixtureGradeSummariesResponse(['TDT4136']) }),
  );
});

test('stale decision enrichment is ignored after filters change', () => {
  const initial = initialModel();
  const [filtered] = update(initial, ChangedCampus({ value: 'trondheim' }));
  const [afterStaleResponse, commands] = update(
    filtered,
    SucceededDecisionSignals({
      requestKey: initial.activeRequestKey,
      courseCodes: ['TDT4136'],
      response: fixtureDecisionSignalsResponse(['TDT4136']),
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
        courseCodes: ['TDT4136'],
        response: fixtureGradeSummariesResponse(['TDT4136']),
      }),
    ),
    Story.Command.resolve(
      FetchDecisionSignals,
      SucceededDecisionSignals({
        requestKey: 'algoritmer|2026-autumn|relevance|all|all|true|false|false',
        courseCodes: ['TDT4136'],
        response: fixtureDecisionSignalsResponse(['TDT4136']),
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
        courseCodes: ['TDT4136'],
        response: fixtureGradeSummariesResponse(['TDT4136']),
      }),
    ),
    Story.Command.resolve(
      FetchDecisionSignals,
      SucceededDecisionSignals({
        requestKey: model.activeRequestKey,
        courseCodes: ['TDT4136'],
        response: fixtureDecisionSignalsResponse(['TDT4136']),
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

  expect(saved.savedListAction).toMatchObject({
    _tag: 'SavedActionSaved',
    courseCode: 'TDT4136',
  });
  expect(saveCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);

  const [undone, undoCommands] = update(saved, RequestedUndoSavedListAction());
  const state = undone.savedCourses._tag === 'SavedCoursesReady' ? undone.savedCourses.state : null;

  expect(state?.savedCourses).toEqual([]);
  expect(undone.savedListAction).toEqual(SavedActionIdle());
  expect(undoCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(undoCommands[0]?.args).toMatchObject({ state: emptySavedList });
});

test('undoing a removal restores the exact saved course, its note, and its label memberships', () => {
  const savedWithLabel: SavedListState = {
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

  const [removed, removeCommands] = update(
    readyModel(savedWithLabel),
    RequestedRemoveSavedCourse({ courseCode: 'TDT4136' }),
  );
  const removedState =
    removed.savedCourses._tag === 'SavedCoursesReady' ? removed.savedCourses.state : null;

  expect(removedState).toEqual({ ...emptySavedList, labels: savedWithLabel.labels });
  expect(removed.savedListAction).toMatchObject({
    _tag: 'SavedActionRemoved',
    course: savedWithLabel.savedCourses[0],
    memberships: savedWithLabel.memberships,
  });
  expect(removeCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);

  const [restored, undoCommands] = update(removed, RequestedUndoSavedListAction());
  const restoredState =
    restored.savedCourses._tag === 'SavedCoursesReady' ? restored.savedCourses.state : null;

  expect(restoredState).toEqual(savedWithLabel);
  expect(restored.savedListAction).toEqual(SavedActionIdle());
  expect(undoCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(undoCommands[0]?.args).toMatchObject({ state: savedWithLabel });
});

test('a repeated Undo is inert once the ephemeral snapshot has already been consumed', () => {
  const model = readyModel();
  const [saved] = update(model, StampedSavedCourse({ courseCode: 'TDT4136', savedAt }));
  const [firstUndo, firstCommands] = update(saved, RequestedUndoSavedListAction());

  expect(firstCommands.map(({ name }) => name)).toEqual(['PersistSavedCourses']);
  expect(firstUndo.savedListAction).toEqual(SavedActionIdle());

  const [secondUndo, secondCommands] = update(firstUndo, RequestedUndoSavedListAction());

  expect(secondUndo).toBe(firstUndo);
  expect(secondCommands).toEqual([]);
});

test('dismissing the saved-list status clears the snapshot without persisting anything', () => {
  const model = readyModel();
  const [saved] = update(model, StampedSavedCourse({ courseCode: 'TDT4136', savedAt }));
  const [dismissed, commands] = update(saved, DismissedSavedListAction());

  expect(dismissed.savedListAction).toEqual(SavedActionIdle());
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
  const created = createLabel(state, { id: 'label-ai', name: 'AI', color: 'blue' });
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

  expect(state.labels).toEqual([{ id: 'label-1', name: 'Autumn 2027', color: 'blue' }]);
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
  expect(editing.labelDraftColor).toBe('blue');

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
    labelFilter: {
      includeLabelIds: ['label-ai'],
      includeMode: 'any' as const,
      excludeLabelIds: [],
    },
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
  const [filtered, commands] = update(model, ToggledLabelInclude({ labelId: 'label-ai' }));

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
  const [included] = update(model, ToggledLabelInclude({ labelId: 'label-ai' }));
  const [strict, strictCommands] = update(included, ChangedLabelFilterMode({ mode: 'all' }));

  expect(strictCommands[0]?.args).toMatchObject({
    href: '/list?lang=en&labels=label-ai&labelMode=all',
  });

  const [excluded, excludeCommands] = update(
    strict,
    ToggledLabelExclude({ labelId: 'label-ai', isExcluded: true }),
  );

  // Last explicit action wins: moving a label to Exclude removes it from Include.
  expect(excluded.labelFilter).toEqual({
    includeLabelIds: [],
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
    ToggledLabelExclude({ labelId: 'label-ai', isExcluded: true }),
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
    includeLabelIds: [],
    includeMode: 'all',
    excludeLabelIds: ['label-ai'],
  });
  expect(loaded.labelFilterNotice).toEqual({
    unknownCount: 1,
    contradictoryLabelIds: ['label-ai'],
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
    savedListAction: SavedActionSaved({ courseCode: 'TDT4136' }),
    selectedCourseCodes: ['TDT4136', 'TMA4100'],
    labelDialogTarget: ['TDT4136'],
  };

  const [undone] = update(model, RequestedUndoSavedListAction());

  expect(readyStateOf(undone).savedCourses.map((course) => course.courseCode)).toEqual(['TMA4100']);
  expect(undone.selectedCourseCodes).toEqual(['TMA4100']);
  expect(undone.labelDialogTarget).toEqual([]);
});
