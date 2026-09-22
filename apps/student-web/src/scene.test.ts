/* oxlint-disable vitest/expect-expect -- Foldkit Scene.expect performs the assertions. */
import { Scene } from 'foldkit';
import { test } from 'vitest';

import { fixtureSearchResponse } from './course-client';
import { partialCourseInsightFixture } from './course-insight.fixture';
import {
  CatalogueEmpty,
  CatalogueFailure,
  CataloguePartial,
  DetailFailure,
  DetailPartial,
  initForHref,
  update,
  view,
} from './app';

const baseModel = () => initForHref('http://course-lens.local/').model;

test('Scene: catalogue loading is announced as a live semantic state', () => {
  Scene.scene(
    { update, view },
    Scene.given(baseModel()),
    Scene.expect(Scene.role('status')).toExist(),
    Scene.expect(Scene.text('Loading the NTNU catalogue')).toExist(),
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
    Scene.expect(Scene.text('Sources and freshness')).toExist(),
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
