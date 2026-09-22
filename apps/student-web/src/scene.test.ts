/* oxlint-disable vitest/expect-expect -- Foldkit Scene.expect performs the assertions. */
import { Scene } from 'foldkit';
import { test } from 'vitest';

import { fixtureScheduleResponse, fixtureSearchResponse } from './course-client.fixture';
import { partialCourseInsightFixture } from './course-insight.fixture';
import { courseIdentity } from './course-identity';
import {
  CatalogueEmpty,
  CatalogueFailure,
  CataloguePartial,
  DetailFailure,
  LoadedNorwegianMessages,
  DetailPartial,
  SavedCoursesReady,
  initForHref,
  update,
  view,
} from './app';
import { norwegianIndexedMessages, norwegianTokenCatalogue } from './i18n.nb';
import { ScheduleSuccess } from './features/schedule';

import { emptySavedList, saveCourse } from './saved-courses';
const baseModel = () => initForHref('http://course-lens.local/').model;

const scheduleState = (
  courseCode: string,
  response = fixtureScheduleResponse([courseCode], '2026-autumn', 45),
  locale: 'en' | 'nb' = 'en',
) => {
  const identity = courseIdentity(courseCode);
  if (identity === null) throw new Error(`Expected valid fixture course code: ${courseCode}`);
  const model = initForHref(
    `http://course-lens.local/schedule?lang=${locale}&term=2026-autumn&week=45&courses=${courseCode}`,
  ).model;
  return {
    ...model,
    savedCourses: SavedCoursesReady({
      state: saveCourse(emptySavedList, identity, '2026-07-24T12:00:00.000Z'),
      repairedEntries: 0,
    }),
    schedule: {
      ...model.schedule,
      activeRequestKey: '2026-autumn|45|' + courseCode,
      result: ScheduleSuccess({ response }),
    },
  };
};

test('Scene: catalogue loading is announced as a live semantic state', () => {
  Scene.scene(
    { update, view },
    Scene.given(baseModel()),
    Scene.expect(Scene.role('status')).toExist(),
    Scene.expect(Scene.text('Loading the NTNU catalogue')).toExist(),
  );
});

test('Scene: a loaded locale replaces the English fallback without losing app state', () => {
  const model = update(
    initForHref('http://course-lens.local/?lang=nb').model,
    LoadedNorwegianMessages({
      messages: norwegianIndexedMessages,
      tokens: norwegianTokenCatalogue,
    }),
  ).model;

  Scene.scene(
    { update, view },
    Scene.given(model),
    Scene.expect(Scene.text('Utforsk emner før du velger.')).toExist(),
    Scene.expect(Scene.text('Browse courses before you choose.')).toBeAbsent(),
  );
});

test('Scene: schedule activity controls use the loaded Bokmål catalogue', () => {
  const model = update(
    scheduleState('TDT4136', fixtureScheduleResponse(['TDT4136'], '2026-autumn', 45), 'nb'),
    LoadedNorwegianMessages({
      messages: norwegianIndexedMessages,
      tokens: norwegianTokenCatalogue,
    }),
  ).model;

  Scene.scene(
    { update, view },
    Scene.given(model),
    Scene.expect(Scene.role('group', { name: 'Aktiviteter for TDT4136' })).toExist(),
    Scene.expect(Scene.text('Alle publiserte aktiviteter er skjult')).toBeAbsent(),
    Scene.expect(Scene.text('Activities for TDT4136')).toBeAbsent(),
  );
});

test('Scene: activity controls prefer title, then summary, then their published code', () => {
  const response = fixtureScheduleResponse(['TDT4136'], '2026-autumn', 45);
  const labelledResponse = {
    ...response,
    items: response.items.map((item) => ({
      ...item,
      activityStreams: [
        { activityCode: 'title', title: 'Provider title', summary: 'Ignored summary' },
        { activityCode: 'summary', title: null, summary: 'Provider summary' },
        { activityCode: 'code-only', title: null, summary: null },
      ],
    })),
  };

  Scene.scene(
    { update, view },
    Scene.given(scheduleState('TDT4136', labelledResponse)),
    Scene.expect(Scene.role('checkbox', { name: 'Provider title' })).toExist(),
    Scene.expect(Scene.role('checkbox', { name: 'Provider summary' })).toExist(),
    Scene.expect(Scene.role('checkbox', { name: 'Activity code-only' })).toExist(),
  );
});

test('Scene: an empty catalogue is a non-failure outcome with guidance', () => {
  Scene.scene(
    { update, view },
    Scene.given({ ...baseModel(), catalogue: CatalogueEmpty() }),
    Scene.expect(Scene.role('status')).toExist(),
    Scene.expect(Scene.text('No courses match these filters')).toExist(),
    Scene.expect(Scene.role('alert')).toBeAbsent(),
  );
});

test('Scene: a catalogue failure exposes the cause without pretending the result is empty', () => {
  Scene.scene(
    { update, view },
    Scene.given({ ...baseModel(), catalogue: CatalogueFailure({ error: 'NTNU is unavailable' }) }),
    Scene.expect(Scene.role('alert')).toExist(),
    Scene.expect(Scene.text('We could not load courses')).toExist(),
    Scene.expect(Scene.text('NTNU is unavailable')).toExist(),
  );
});

test('Scene: partial catalogue data keeps validated official courses visible with attribution', () => {
  Scene.scene(
    { update, view },
    Scene.given({
      ...baseModel(),
      catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
      visibleCount: 1,
    }),
    Scene.expect(Scene.role('region', { name: 'Course results' })).toExist(),
    Scene.expect(Scene.role('status')).toExist(),
    Scene.expect(
      Scene.text(
        'Some catalogue data could not be used. Official results that were validated remain visible.',
      ),
    ).toExist(),
    Scene.expect(
      Scene.role('link', { name: 'Open TDT4136: Introduction to Artificial Intelligence' }),
    ).toExist(),
  );
});

test('Scene: partial Inspect facts retain evidence and named uncertainty', () => {
  const response = {
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
    Scene.given({
      ...baseModel(),
      selectedCode: 'TDT4136',
      detail: DetailPartial({ response }),
    }),
    Scene.expect(Scene.role('article', { name: 'TDT4136 course details' })).toExist(),
    Scene.expect(Scene.text('Partial result')).toExist(),
    Scene.expect(Scene.text('Inferred')).toExist(),
  );
});

test('Scene: Inspect failure remains distinct from partial evidence', () => {
  Scene.scene(
    { update, view },
    Scene.given({
      ...baseModel(),
      selectedCode: 'TDT4136',
      detail: DetailFailure({ error: 'The detail provider timed out' }),
    }),
    Scene.expect(Scene.role('alert')).toExist(),
    Scene.expect(Scene.text('We could not load this course')).toExist(),
    Scene.expect(Scene.text('The detail provider timed out')).toExist(),
  );
});

test('Scene: Schedule exposes keyboard-operable week and saved-course controls with event evidence', () => {
  Scene.scene(
    { update, view },
    Scene.given(scheduleState('TDT4136')),
    Scene.expect(Scene.role('spinbutton', { name: 'Week number' })).toExist(),
    Scene.expect(Scene.role('button', { name: 'Previous week' })).toExist(),
    Scene.expect(Scene.role('button', { name: 'Next week' })).toExist(),
    Scene.expect(Scene.role('group', { name: 'Choose saved courses' })).toExist(),
    Scene.expect(Scene.role('checkbox', { name: 'TDT4136' })).toExist(),
    Scene.expect(Scene.role('group', { name: 'Activities for TDT4136' })).toExist(),
    Scene.expect(Scene.role('checkbox', { name: 'Search and planning' })).toExist(),
    Scene.expect(Scene.role('checkbox', { name: 'Constraint satisfaction exercise' })).toExist(),
    Scene.expect(Scene.text('Search and planning')).toExist(),
    Scene.expect(
      Scene.text(
        'Provider-published activities are shown by default. Alternative-session assignment and exception semantics are unavailable.',
      ),
    ).toExist(),
  );
});

test('Scene: hiding every activity is distinct from an empty published week', () => {
  const base = scheduleState('TDT4136');
  Scene.scene(
    { update, view },
    Scene.given({
      ...base,
      schedule: {
        ...base.schedule,
        hiddenActivityKeys: ['TDT4136:lecture', 'TDT4136:exercise'],
      },
    }),
    Scene.expect(Scene.text('All published activities are hidden')).toExist(),
    Scene.expect(Scene.text('No published activities this week')).toBeAbsent(),
    Scene.expect(Scene.text('Weekly timetable')).toBeAbsent(),
  );
});

test('Scene: a known empty schedule week is not presented as a source failure', () => {
  Scene.scene(
    { update, view },
    Scene.given(scheduleState('TDT4109')),
    Scene.expect(Scene.role('status')).toExist(),
    Scene.expect(Scene.text('No published activities this week')).toExist(),
    Scene.expect(Scene.role('alert')).toBeAbsent(),
  );
});

test('Scene: a failed source stays distinct while successful neighbouring events remain visible', () => {
  const response = fixtureScheduleResponse(['TDT4136', 'TDT4109'], '2026-autumn', 45);
  const failedResponse = {
    ...response,
    items: response.items.map((item) =>
      item.courseCode === 'TDT4109'
        ? {
            ...item,
            sourceStatus: {
              ...item.sourceStatus,
              status: 'failed' as const,
              warning: 'The fixture source timed out.',
            },
          }
        : item,
    ),
  };
  const base = scheduleState('TDT4136', failedResponse);
  const secondIdentity = courseIdentity('TDT4109');
  if (secondIdentity === null) throw new Error('Expected a valid fixture course code.');
  const saved =
    base.savedCourses._tag === 'SavedCoursesReady'
      ? saveCourse(base.savedCourses.state, secondIdentity, '2026-07-24T12:01:00.000Z')
      : emptySavedList;

  Scene.scene(
    { update, view },
    Scene.given({
      ...base,
      savedCourses: SavedCoursesReady({ state: saved, repairedEntries: 0 }),
      schedule: { ...base.schedule, selectedCodes: ['TDT4136', 'TDT4109'] },
    }),
    Scene.expect(Scene.role('alert')).toExist(),
    Scene.expect(Scene.text('Schedule source failed for TDT4109')).toExist(),
    Scene.expect(Scene.text('Search and planning')).toExist(),
    Scene.expect(Scene.text('No published activities this week')).toBeAbsent(),
  );
});
