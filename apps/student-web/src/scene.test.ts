/* oxlint-disable vitest/expect-expect -- Foldkit Scene.expect performs the assertions. */
import { Scene } from 'foldkit';
import { describe, test } from 'vitest';

import {
  fixtureDecisionSignalsResponse,
  fixtureGradeSummariesResponse,
  fixtureSearchResponse,
} from './course-client';
import { partialCourseInsightFixture } from './course-insight.fixture';
import {
  CatalogueEmpty,
  CatalogueInitialLoading,
  CataloguePartial,
  DetailClosed,
  DetailPartial,
  DecisionSignalsSuccess,
  GradeSignalsSuccess,
  CompletedNavigation,
  Navigate,
  NextPageIdle,
  PersistSavedCourses,
  PersistedSavedCourses,
  SavedActionSaved,
  SavedCoursesReady,
  RequestedLabelDialog,
  SavedCoursesRecovery,
  StampLabel,
  StampSavedCourse,
  StampedLabel,
  StampedSavedCourse,
  type Model,
  initForHref,
  update,
  view,
} from './main';
import {
  attachLabel,
  courseIdentity,
  createLabel,
  emptySavedList,
  saveCourse,
  type LabelResult,
  type SavedListState,
} from './saved-courses';

const baseModel = (): Model => initForHref('http://course-lens.local/')[0];

describe('browse-first catalogue scene', () => {
  test('fresh visitors see an accessible browse and filter experience', () => {
    Scene.scene(
      { update, view },
      Scene.with(baseModel()),
      Scene.expect(Scene.role('heading', { name: 'Browse courses before you choose.' })).toExist(),
      Scene.expect(Scene.label('Search courses')).toExist(),
      Scene.expect(Scene.label('Campus')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Refine' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Open appearance settings' })).toExist(),
      Scene.expect(Scene.label('Study level')).toBeAbsent(),
      Scene.expect(Scene.label('Sort')).toBeAbsent(),
      Scene.expect(Scene.role('link', { name: 'Explore' })).toExist(),
      Scene.expect(Scene.text('List')).toExist(),
      Scene.expect(Scene.text('Schedule')).toExist(),
      Scene.expect(Scene.text('Degree')).toExist(),
      Scene.expect(Scene.text('Loading the NTNU catalogue')).toExist(),
    );
  });

  test('appearance settings expose Nordic palettes and explicit light modes', () => {
    const open = initForHref('http://course-lens.local/appearance')[0];
    Scene.scene(
      { update, view },
      Scene.with(open),
      Scene.expect(Scene.role('dialog')).toExist(),
      Scene.expect(Scene.role('heading', { name: 'Theme lab' })).toExist(),
      Scene.expect(Scene.role('button', { name: /Fjord/ })).toExist(),
      Scene.expect(Scene.role('button', { name: /Pine/ })).toExist(),
      Scene.expect(Scene.role('button', { name: 'System' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Light' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Dark' })).toExist(),
    );
  });

  test('Norwegian Bokmål localizes interface chrome while retaining the same catalogue state', () => {
    const norwegian = initForHref('http://course-lens.local/?lang=nb')[0];
    Scene.scene(
      { update, view },
      Scene.with(norwegian),
      Scene.expect(Scene.role('heading', { name: 'Utforsk emner før du velger.' })).toExist(),
      Scene.expect(Scene.label('Søk i emner')).toExist(),
      Scene.expect(Scene.label('Studiested')).toExist(),
      Scene.expect(Scene.role('link', { name: 'Utforsk' })).toExist(),
      Scene.expect(Scene.text('Laster NTNUs emnekatalog')).toExist(),
      Scene.expect(Scene.label('Språk')).toExist(),
    );
  });

  test('official results are semantic links into existing course detail', () => {
    const searchResponse = fixtureSearchResponse(1);
    const responseWithSearchCreditsUnknown = {
      ...searchResponse,
      items: searchResponse.items.map((item) => ({
        ...item,
        credits: {
          state: 'unknown' as const,
          reason: 'Course credits require the NTNU detail page.',
          evidenceIds: [],
        },
      })),
    };
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: responseWithSearchCreditsUnknown }),
        decisionSignals: DecisionSignalsSuccess({
          response: fixtureDecisionSignalsResponse(['TDT4136']),
        }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.role('region', { name: 'Course results' })).toExist(),
      Scene.expect(
        Scene.role('link', {
          name: 'Open TDT4136: Introduction to Artificial Intelligence',
        }),
      ).toExist(),
      Scene.expect(Scene.text('Showing 1 of 1 courses')).toExist(),
      Scene.expect(Scene.text('Credits', { exact: true })).toExist(),
      Scene.expect(Scene.text('7.5 credits', { exact: true })).toExist(),
      Scene.expect(Scene.text('Level', { exact: true })).toBeAbsent(),
      Scene.expect(Scene.text('Campus', { exact: true })).toExist(),
      Scene.expect(Scene.text('Load when opened')).toBeAbsent(),
    );
  });

  test('mixed historical populations can switch without combining unlike grading scales', () => {
    const response = fixtureGradeSummariesResponse(['TDT4136']);
    const summary = response.items[0]!;
    const mixed = {
      ...response,
      items: [
        {
          ...summary,
          gradingScale: {
            state: 'known' as const,
            value: 'mixed' as const,
            evidenceIds: summary.gradingScale.evidenceIds,
          },
          distribution: {
            state: 'known' as const,
            value: [
              { grade: 'A', count: 30, percentage: 18.75 },
              { grade: 'B', count: 20, percentage: 12.5 },
              { grade: 'F', count: 10, percentage: 6.25 },
              { grade: 'G', count: 80, percentage: 50 },
              { grade: 'H', count: 20, percentage: 12.5 },
            ],
            evidenceIds: summary.distribution.evidenceIds,
          },
        },
      ],
    };

    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        gradeSignals: GradeSignalsSuccess({ response: mixed }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.role('group', { name: 'Choose historical outcome scale' })).toExist(),
      Scene.expect(Scene.text('16.7% failed · n=60 · 2022–2025')).toExist(),
      Scene.click(Scene.role('button', { name: 'Pass/fail' })),
      Scene.expect(
        Scene.role('img', {
          name: /Pass\/fail\. Pass 80 percent, Fail 20 percent/,
        }),
      ).toExist(),
      Scene.expect(Scene.text('20% failed · n=100 · 2022–2025')).toExist(),
    );
  });

  test('official grade signals are scannable without opening course detail', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        gradeSignals: GradeSignalsSuccess({
          response: fixtureGradeSummariesResponse(['TDT4136']),
        }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.text('Historical outcomes')).toExist(),
      Scene.expect(
        Scene.role('img', {
          name: /HK-dir DBH historical outcomes\. Letter grades\./,
        }),
      ).toExist(),
      Scene.expect(Scene.text('Letter grades')).toExist(),
      Scene.expect(Scene.text('10.7% failed · n=1,951 · 2022–2025')).toExist(),
    );
  });

  test('pass/fail outcomes use a ratio summary instead of letter-grade columns', () => {
    const response = fixtureGradeSummariesResponse(['TDT4136']);
    const summary = response.items[0]!;
    const passFail = {
      ...response,
      items: [
        {
          ...summary,
          gradingScale: {
            state: 'known' as const,
            value: 'pass-fail' as const,
            evidenceIds: summary.gradingScale.evidenceIds,
          },
          distribution: {
            state: 'known' as const,
            value: [
              { grade: 'G', count: 80, percentage: 80 },
              { grade: 'H', count: 20, percentage: 20 },
            ],
            evidenceIds: summary.distribution.evidenceIds,
          },
          failureRatePercent: {
            state: 'known' as const,
            value: 20,
            evidenceIds: summary.failureRatePercent.evidenceIds,
          },
        },
      ],
    };

    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        gradeSignals: GradeSignalsSuccess({ response: passFail }),
        visibleCount: 1,
      }),
      Scene.expect(
        Scene.role('img', {
          name: /Pass\/fail\. Pass 80 percent, Fail 20 percent/,
        }),
      ).toExist(),
      Scene.expect(Scene.text('Pass')).toExist(),
      Scene.expect(Scene.text('Fail')).toExist(),
    );
  });

  test('assessment and work signals are scannable without opening course detail', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        decisionSignals: DecisionSignalsSuccess({
          response: fixtureDecisionSignalsResponse(['TDT4136']),
        }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.text('Assessment & work')).toExist(),
      Scene.expect(Scene.text('Graded assessment')).toExist(),
      Scene.expect(Scene.text('Written exam')).toExist(),
      Scene.expect(Scene.text('100%')).toExist(),
      Scene.expect(Scene.text('Obligatory work')).toExist(),
      Scene.expect(Scene.text('Required')).toExist(),
      Scene.expect(Scene.text('Ungraded')).toExist(),
      Scene.expect(Scene.text('Collaboration')).toExist(),
      Scene.expect(Scene.text('Unknown', { exact: true })).toExist(),
    );
  });

  test('multiple weighted assessments remain one scannable segmented group', () => {
    const response = fixtureDecisionSignalsResponse(['TDT4136']);
    const item = response.items[0]!;
    const assessment = item.assessment;
    const written = assessment.state === 'known' ? assessment.value[0]! : undefined;
    if (assessment.state !== 'known' || written === undefined) {
      throw new Error('The decision fixture must contain one known assessment.');
    }
    const combined = {
      ...response,
      items: [
        {
          ...item,
          assessment: {
            ...assessment,
            value: [
              {
                ...written,
                weightPercent: { ...written.weightPercent, value: 100 / 3 },
              },
              {
                ...written,
                form: 'project' as const,
                description: 'Individual project',
                weightPercent: { ...written.weightPercent, value: 200 / 3 },
              },
            ],
          },
        },
      ],
    };

    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        decisionSignals: DecisionSignalsSuccess({ response: combined }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.text('Written exam')).toExist(),
      Scene.expect(Scene.text('33.33%')).toExist(),
      Scene.expect(Scene.text('Project')).toExist(),
      Scene.expect(Scene.text('66.67%')).toExist(),
    );
  });

  test('an empty response is not rendered as a source failure', () => {
    Scene.scene(
      { update, view },
      Scene.with({ ...baseModel(), catalogue: CatalogueEmpty() }),
      Scene.expect(Scene.text('No courses match these filters')).toExist(),
      Scene.expect(Scene.role('alert')).toBeAbsent(),
    );
  });

  test('selected partial detail reuses the evidence-backed course view', () => {
    const responseWithInference = {
      ...partialCourseInsightFixture,
      item: {
        ...partialCourseInsightFixture.item,
        evidence: partialCourseInsightFixture.item.evidence.map((evidence) =>
          evidence.id === 'ntnu-teaching'
            ? { ...evidence, kind: 'inference' as const, inferenceRule: 'Keyword classification.' }
            : evidence,
        ),
      },
    };
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CatalogueInitialLoading(),
        nextPage: NextPageIdle(),
        selectedCode: 'TDT4136',
        detail: DetailPartial({ response: responseWithInference }),
      }),
      Scene.expect(Scene.role('button', { name: '← Back to course results' })).toExist(),
      Scene.expect(Scene.role('article', { name: 'TDT4136 course details' })).toExist(),
      Scene.expect(Scene.text('Partial result')).toExist(),
      Scene.expect(Scene.text('Inferred')).toExist(),
    );
  });

  test('selected course detail uses the active Norwegian interface locale', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...initForHref('http://course-lens.local/?lang=nb')[0],
        catalogue: CatalogueInitialLoading(),
        nextPage: NextPageIdle(),
        selectedCode: 'TDT4136',
        detail: DetailPartial({ response: partialCourseInsightFixture }),
      }),
      Scene.expect(Scene.role('article', { name: 'Emnedetaljer for TDT4136' })).toExist(),
      Scene.expect(Scene.text('Delvis resultat')).toExist(),
      Scene.expect(Scene.text('Vurdering og obligatorisk arbeid')).toExist(),
      Scene.expect(Scene.text('Kilder og ferskhet')).toExist(),
    );
  });

  test('closed detail remains a valid explicit state', () => {
    Scene.scene(
      { update, view },
      Scene.with({ ...baseModel(), selectedCode: null, detail: DetailClosed() }),
      Scene.expect(Scene.role('button', { name: '← Back to course results' })).toBeAbsent(),
    );
  });
});

describe('local List scene', () => {
  const savedAt = '2026-07-24T12:00:00.000Z';
  const tdt4136 = courseIdentity('TDT4136')!;
  const savedList = saveCourse(emptySavedList, tdt4136, savedAt);

  const listModel = (state = savedList): Model => ({
    ...initForHref('http://course-lens.local/list')[0],
    savedCourses: SavedCoursesReady({ state, repairedEntries: 0 }),
  });

  test('a course is kept from the catalogue without opening detail or waiting for enrichment', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        savedCourses: SavedCoursesReady({ state: emptySavedList, repairedEntries: 0 }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.role('button', { name: 'Save TDT4136 to List' })).toExist(),
      Scene.expect(Scene.role('link', { name: /Open TDT4136/ })).toExist(),
      Scene.click(Scene.role('button', { name: 'Save TDT4136 to List' })),
      Scene.Command.resolve(
        StampSavedCourse,
        StampedSavedCourse({ courseCode: 'TDT4136', savedAt }),
      ),
      Scene.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
      Scene.expect(Scene.role('button', { name: 'Remove TDT4136 from List' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Save TDT4136 to List' })).toBeAbsent(),
    );
  });

  test('saving a course shows an explicit confirmation that Undo reverses', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        savedCourses: SavedCoursesReady({ state: emptySavedList, repairedEntries: 0 }),
        visibleCount: 1,
      }),
      Scene.click(Scene.role('button', { name: 'Save TDT4136 to List' })),
      Scene.Command.resolve(
        StampSavedCourse,
        StampedSavedCourse({ courseCode: 'TDT4136', savedAt }),
      ),
      Scene.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
      Scene.expect(Scene.text('TDT4136 saved to List.')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Undo saving TDT4136' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Dismiss' })).toExist(),
      Scene.click(Scene.role('button', { name: 'Undo saving TDT4136' })),
      Scene.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
      Scene.expect(Scene.role('button', { name: 'Save TDT4136 to List' })).toExist(),
      Scene.expect(Scene.text('TDT4136 saved to List.')).toBeAbsent(),
      Scene.expect(Scene.role('button', { name: 'Undo saving TDT4136' })).toBeAbsent(),
    );
  });

  test('removing a saved course shows an explicit confirmation that Undo reverses', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      Scene.click(Scene.role('button', { name: 'Remove TDT4136 from List' })),
      Scene.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
      Scene.expect(Scene.text('You have not saved a course yet')).toExist(),
      Scene.expect(Scene.text('TDT4136 removed from List.')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Undo removing TDT4136' })).toExist(),
      Scene.click(Scene.role('button', { name: 'Undo removing TDT4136' })),
      Scene.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
      Scene.expect(Scene.role('button', { name: 'Remove TDT4136 from List' })).toExist(),
      Scene.expect(Scene.text('TDT4136 removed from List.')).toBeAbsent(),
      Scene.expect(Scene.role('button', { name: 'Undo removing TDT4136' })).toBeAbsent(),
    );
  });

  test('dismissing the saved-list status removes the confirmation without changing saved state', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...listModel(emptySavedList),
        savedListAction: SavedActionSaved({ courseCode: 'TDT4136' }),
      }),
      Scene.expect(Scene.text('TDT4136 saved to List.')).toExist(),
      Scene.click(Scene.role('button', { name: 'Dismiss' })),
      Scene.expect(Scene.text('TDT4136 saved to List.')).toBeAbsent(),
      Scene.expect(Scene.role('button', { name: 'Dismiss' })).toBeAbsent(),
      Scene.expect(Scene.text('You have not saved a course yet')).toExist(),
    );
  });

  test('an empty List explains how to fill it instead of showing a failure', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel(emptySavedList)),
      Scene.expect(Scene.role('heading', { name: 'Your saved courses' })).toExist(),
      Scene.expect(Scene.text('You have not saved a course yet')).toExist(),
      Scene.expect(Scene.role('link', { name: 'Browse more courses' })).toExist(),
      Scene.expect(Scene.role('alert')).toBeAbsent(),
    );
  });

  test('a saved course keeps its identity, note, and removal action when no facts were loaded', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      Scene.expect(Scene.text('1 saved course')).toExist(),
      Scene.expect(Scene.text('TDT4136')).toExist(),
      Scene.expect(Scene.text('Course details were not loaded in this session.')).toExist(),
      Scene.expect(Scene.label('Your note')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Save note' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Remove TDT4136 from List' })).toExist(),
      Scene.expect(Scene.text('Unknown', { exact: true })).toBeAbsent(),
    );
  });

  test('the per-row Edit labels action meets the established 44px touch target', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      Scene.expect(Scene.role('button', { name: 'Edit labels for TDT4136' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Edit labels for TDT4136' })).toHaveClass(
        'min-h-11',
      ),
    );
  });

  test('a saved course reuses evidence already loaded in this session', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...listModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        decisionSignals: DecisionSignalsSuccess({
          response: fixtureDecisionSignalsResponse(['TDT4136']),
        }),
        gradeSignals: GradeSignalsSuccess({
          response: fixtureGradeSummariesResponse(['TDT4136']),
        }),
      }),
      Scene.expect(
        Scene.role('link', { name: 'Open TDT4136: Introduction to Artificial Intelligence' }),
      ).toExist(),
      Scene.expect(Scene.text('Credits', { exact: true })).toExist(),
      Scene.expect(Scene.text('Assessment & work')).toExist(),
      Scene.expect(Scene.text('Historical outcomes')).toExist(),
      Scene.expect(Scene.text('Course details were not loaded in this session.')).toBeAbsent(),
    );
  });

  test('unreadable saved state is reported and recovered explicitly, never silently reset', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...initForHref('http://course-lens.local/list')[0],
        savedCourses: SavedCoursesRecovery({
          reason: 'unsupported-version',
          storedVersion: 2,
          raw: '{"version":2}',
        }),
      }),
      Scene.expect(Scene.role('alert')).toExist(),
      Scene.expect(Scene.text('Saved courses could not be loaded')).toExist(),
      Scene.expect(
        Scene.text('This browser stored a newer version of the saved list (version 2).', {
          exact: false,
        }),
      ).toExist(),
      Scene.expect(
        Scene.text('Saving is paused until the stored list is recovered or reset.'),
      ).toExist(),
      Scene.expect(Scene.role('button', { name: 'Reset saved courses' })).toExist(),
      Scene.expect(Scene.text('Show the stored value')).toExist(),
    );
  });

  test('Explore keeps the Save control disabled but names it "paused" rather than "still loading" during recovery', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        savedCourses: SavedCoursesRecovery({
          reason: 'invalid-json',
          storedVersion: null,
          raw: '{oops',
        }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.role('button', { name: 'Save TDT4136 to List' })).toBeDisabled(),
      Scene.expect(Scene.title('Saved courses are still loading')).toBeAbsent(),
      Scene.expect(
        Scene.title('Saving is paused until the stored list is recovered or reset.'),
      ).toExist(),
      Scene.expect(Scene.role('link', { name: 'Open List to recover saved courses' })).toExist(),
      // The title anchor's whole-card overlay (`after:absolute after:inset-0`)
      // would otherwise intercept clicks meant for this link: the cluster
      // wrapping the paused toggle and the recovery link must carry its own
      // stacking context to stay above it.
      Scene.expect(Scene.selector('span.items-end')).toHaveClass('z-[2]'),
    );
  });

  test('Explore names the Save control as still loading, not paused, while saved courses are loading', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.role('button', { name: 'Save TDT4136 to List' })).toBeDisabled(),
      Scene.expect(Scene.title('Saved courses are still loading')).toExist(),
      Scene.expect(
        Scene.title('Saving is paused until the stored list is recovered or reset.'),
      ).toBeAbsent(),
      Scene.expect(Scene.role('link', { name: 'Open List to recover saved courses' })).toBeAbsent(),
    );
  });

  test('the List route is reachable in the primary navigation and localized', () => {
    Scene.scene(
      { update, view },
      Scene.with({ ...listModel(), locale: 'nb' }),
      Scene.expect(Scene.role('heading', { name: 'Dine lagrede emner' })).toExist(),
      Scene.expect(Scene.label('Notatet ditt')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Fjern TDT4136 fra listen' })).toExist(),
      Scene.expect(Scene.role('link', { name: 'Utforsk' })).toExist(),
    );
  });
});

describe('label collections scene', () => {
  const savedAt = '2026-07-24T12:00:00.000Z';
  const tdt4136 = courseIdentity('TDT4136')!;
  const tma4100 = courseIdentity('TMA4100')!;

  const applied = (result: LabelResult): SavedListState => {
    if (result._tag !== 'LabelApplied') throw new Error(`expected LabelApplied: ${result._tag}`);
    return result.state;
  };

  const twoCourses = saveCourse(
    saveCourse(emptySavedList, tdt4136, savedAt),
    tma4100,
    '2026-07-25T12:00:00.000Z',
  );

  const labelled = attachLabel(
    applied(
      createLabel(applied(createLabel(twoCourses, { id: 'label-ai', name: 'AI', color: 'blue' })), {
        id: 'label-heavy',
        name: 'Group heavy',
        color: 'rose',
      }),
    ),
    'label-ai',
    [tdt4136],
  );

  const listModel = (state = labelled, href = 'http://course-lens.local/list'): Model => ({
    ...initForHref(href)[0],
    savedCourses: SavedCoursesReady({ state, repairedEntries: 0 }),
  });

  test('label chips carry a name, a count, and a pressed state rather than colour alone', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      Scene.expect(Scene.role('group', { name: 'Filter by label' })).toExist(),
      // The chip names itself from its own content: label name, count, and the
      // counted unit, so no digit stands alone and no colour carries meaning.
      Scene.expect(Scene.role('button', { name: /AI.*1.*saved course/ })).toExist(),
      Scene.expect(Scene.role('button', { name: /Group heavy.*0.*saved courses/ })).toExist(),
      Scene.expect(Scene.text('Showing every saved course.')).toExist(),
      Scene.expect(Scene.role('group', { name: 'Labels on TDT4136' })).toExist(),
      Scene.expect(Scene.text('No labels yet')).toExist(),
    );
  });

  test('including a label narrows the canonical List and restates the recipe', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      Scene.expect(Scene.text('2 saved courses')).toExist(),
      Scene.click(Scene.role('button', { name: /^AI/ })),
      Scene.Command.resolve(Navigate, CompletedNavigation()),
      Scene.expect(Scene.text('Showing 1 of 2 saved courses')).toExist(),
      Scene.expect(Scene.text('Showing saved courses in AI.')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Clear label filter' })).toExist(),
    );
  });

  test('All and Exclude live behind one progressive disclosure', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      Scene.expect(Scene.role('button', { name: 'Combine labels' })).toExist(),
      Scene.expect(Scene.role('radiogroup', { name: 'Match included labels' })).toExist(),
      Scene.expect(Scene.label('Exclude AI')).toExist(),
      Scene.expect(Scene.label('Exclude Group heavy')).toExist(),
    );
  });

  test('the collapsed "Combine labels" panel is inert so its Any/All and Exclude controls cannot be focused', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      // The Disclosure primitive keeps the panel mounted and marks it
      // aria-hidden while collapsed (needed for the height transition), but
      // leaves removing focusability of its own descendants to the app —
      // otherwise a focusable RadioGroup/Checkbox inside an aria-hidden
      // ancestor is an aria-hidden-focus violation.
      Scene.expect(Scene.selector('#label-filter-combine-panel')).toHaveAttr('inert', 'true'),
      Scene.click(Scene.role('button', { name: 'Combine labels' })),
      Scene.expect(Scene.selector('#label-filter-combine-panel')).toHaveAttr('inert', 'false'),
      Scene.expect(Scene.role('radiogroup', { name: 'Match included labels' })).toExist(),
    );
  });

  test('excluding a label subtracts it and says so in plain language', () => {
    Scene.scene(
      { update, view },
      Scene.with({ ...listModel(), labelFilterCombineOpen: true }),
      Scene.click(Scene.label('Exclude AI')),
      Scene.Command.resolve(Navigate, CompletedNavigation()),
      Scene.expect(Scene.text('Showing saved courses, excluding AI.')).toExist(),
      Scene.expect(Scene.text('Showing 1 of 2 saved courses')).toExist(),
    );
  });

  test('a combination that matches nothing is a filter outcome, not a failure', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...listModel(),
        labelFilter: {
          includeLabelIds: ['label-ai', 'label-heavy'],
          includeMode: 'all',
          excludeLabelIds: [],
        },
      }),
      Scene.expect(Scene.text('No saved courses match this label combination')).toExist(),
      Scene.expect(Scene.role('alert')).toBeAbsent(),
      Scene.expect(Scene.text('Showing 0 of 2 saved courses')).toExist(),
      Scene.expect(Scene.text('Showing saved courses in AI and Group heavy.')).toExist(),
    );
  });

  test('a normalized shared recipe is restated instead of silently shrinking', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...listModel(),
        labelFilter: { includeLabelIds: [], includeMode: 'any', excludeLabelIds: ['label-ai'] },
        labelFilterNotice: { unknownCount: 1, contradictoryLabelIds: ['label-ai'] },
      }),
      Scene.expect(
        Scene.text('AI stays excluded, so it was removed from the included labels.'),
      ).toExist(),
      Scene.expect(
        Scene.text('The filter referred to labels that no longer exist. They were removed: 1.'),
      ).toExist(),
    );
  });

  test('selecting saved courses reveals a persistent tray with the one bulk action', () => {
    Scene.scene(
      { update, view },
      Scene.with(listModel()),
      Scene.expect(Scene.role('region', { name: 'Selected saved courses' })).toBeAbsent(),
      Scene.click(Scene.label('Select TDT4136')),
      Scene.expect(Scene.role('region', { name: 'Selected saved courses' })).toExist(),
      Scene.expect(Scene.text('1 selected')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Add labels' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Clear selection' })).toExist(),
      Scene.click(Scene.role('button', { name: 'Clear selection' })),
      Scene.expect(Scene.role('region', { name: 'Selected saved courses' })).toBeAbsent(),
    );
  });

  test('the label dialog creates a label with a named colour and attaches it to the target', () => {
    const [open] = update(listModel(), RequestedLabelDialog({ courseCodes: ['TDT4136'] }));
    Scene.scene(
      { update, view },
      // The colour choice is a radio group: it owns its own roving focus, so a
      // real pointer or key press on it belongs to the browser journey. Here the
      // chosen colour is the model state that group reports.
      Scene.with({ ...open, labelDraftName: 'Autumn 2027', labelDraftColor: 'emerald' }),
      Scene.expect(Scene.role('dialog')).toExist(),
      Scene.expect(Scene.role('heading', { name: 'Labels for TDT4136' })).toExist(),
      Scene.expect(Scene.label('Label name')).toExist(),
      Scene.expect(Scene.role('radiogroup', { name: 'Label colour' })).toExist(),
      Scene.expect(Scene.role('radio', { name: 'Emerald' })).toBeChecked(),
      Scene.expect(Scene.role('button', { name: 'Delete AI' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Edit AI' })).toExist(),
      Scene.click(Scene.role('button', { name: 'Add label' })),
      Scene.Command.resolve(StampLabel, StampedLabel({ labelId: 'label-autumn' })),
      Scene.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
      // The new label exists and is attached to the target course, so the dialog
      // offers it as a checkbox and states the attachment in words.
      Scene.expect(Scene.role('checkbox', { name: /Autumn 2027/ })).toExist(),
      Scene.expect(Scene.text('On TDT4136')).toExist(),
      Scene.expect(Scene.label('Label name')).toHaveValue(''),
    );
  });

  test('a misclick on Delete cannot delete a label: it arms an in-dialog confirmation that Cancel reverses', () => {
    const [open] = update(listModel(), RequestedLabelDialog({ courseCodes: ['TDT4136'] }));
    Scene.scene(
      { update, view },
      Scene.with(open),
      Scene.click(Scene.role('button', { name: 'Delete AI' })),
      // The row's own actions swap for an explicit confirm/cancel pair rather
      // than deleting on the first click; nothing new opens or steals focus.
      Scene.expect(Scene.role('dialog')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Edit AI' })).toBeAbsent(),
      Scene.expect(
        Scene.text('Delete "AI"? Saved courses keep their identity; only the label is removed.'),
      ).toExist(),
      Scene.expect(Scene.role('button', { name: 'Cancel deleting' })).toExist(),
      Scene.click(Scene.role('button', { name: 'Cancel deleting' })),
      // Cancel restores the row exactly: the label, its membership, and its
      // normal actions are all still there.
      Scene.expect(Scene.role('button', { name: 'Edit AI' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Delete AI' })).toExist(),
      // Excludes "Exclude AI": the page's own label-filter checkbox stays in
      // the DOM behind the open dialog and would otherwise also match "AI".
      Scene.expect(Scene.role('checkbox', { name: /(?<!Exclude )AI/ })).toBeChecked(),
      Scene.expect(Scene.text('On TDT4136')).toExist(),
    );
  });

  test('confirming an armed label delete removes it and its membership', () => {
    const [open] = update(listModel(), RequestedLabelDialog({ courseCodes: ['TDT4136'] }));
    Scene.scene(
      { update, view },
      Scene.with(open),
      Scene.click(Scene.role('button', { name: 'Delete AI' })),
      // The confirm control reuses the same accessible name as the trigger
      // that armed it; it now performs the actual, explicit deletion.
      Scene.click(Scene.role('button', { name: 'Delete AI' })),
      Scene.Command.resolve(PersistSavedCourses, PersistedSavedCourses()),
      Scene.expect(Scene.role('checkbox', { name: /^AI/ })).toBeAbsent(),
      Scene.expect(Scene.role('button', { name: 'Delete AI' })).toBeAbsent(),
      Scene.expect(Scene.role('checkbox', { name: /Group heavy/ })).toExist(),
    );
  });

  test('a label on some of a selection reads as a partial state, not as attached', () => {
    const [open] = update(
      { ...listModel(), selectedCourseCodes: ['TDT4136', 'TMA4100'] },
      RequestedLabelDialog({ courseCodes: ['TDT4136', 'TMA4100'] }),
    );
    Scene.scene(
      { update, view },
      Scene.with(open),
      Scene.expect(
        Scene.role('heading', { name: 'Labels for 2 selected saved courses' }),
      ).toExist(),
      Scene.expect(Scene.text('On 1 of 2 selected')).toExist(),
      Scene.expect(Scene.role('checkbox', { name: /AI/ })).toExist(),
    );
  });

  test('a duplicate label name is reported in the dialog and keeps the draft', () => {
    const [open] = update(listModel(), RequestedLabelDialog({ courseCodes: [] }));
    Scene.scene(
      { update, view },
      Scene.with({ ...open, labelDraftName: 'ai' }),
      Scene.click(Scene.role('button', { name: 'Add label' })),
      Scene.expect(Scene.role('alert')).toHaveText('A label with that name already exists.'),
      Scene.expect(Scene.label('Label name')).toHaveValue('ai'),
    );
  });

  test('the label filter and dialog are localized in Norwegian Bokmål', () => {
    const [open] = update(
      { ...listModel(), locale: 'nb' as const },
      RequestedLabelDialog({ courseCodes: ['TDT4136'] }),
    );
    Scene.scene(
      { update, view },
      Scene.with(open),
      Scene.expect(Scene.role('heading', { name: 'Etiketter for TDT4136' })).toExist(),
      Scene.expect(Scene.label('Etikettnavn')).toExist(),
      Scene.expect(Scene.role('radiogroup', { name: 'Etikettfarge' })).toExist(),
      Scene.expect(Scene.role('radio', { name: 'Smaragd' })).toExist(),
      Scene.expect(Scene.role('button', { name: 'Legg til etikett' })).toExist(),
    );
  });
});
