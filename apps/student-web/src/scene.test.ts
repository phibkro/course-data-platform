/* oxlint-disable vitest/expect-expect -- Foldkit Scene.expect performs the assertions. */
import { Scene } from 'foldkit';
import { describe, test } from 'vitest';

import { fixtureSearchResponse } from './course-client';
import { partialCourseInsightFixture } from './course-insight.fixture';
import {
  CatalogueEmpty,
  CatalogueInitialLoading,
  CataloguePartial,
  DetailClosed,
  DetailPartial,
  NextPageIdle,
  type Model,
  initForHref,
  update,
  view,
} from './main';

const baseModel = (): Model => initForHref('http://course-lens.local/')[0];

describe('browse-first catalogue scene', () => {
  test('fresh visitors see an accessible browse and filter experience', () => {
    Scene.scene(
      { update, view },
      Scene.with(baseModel()),
      Scene.expect(Scene.role('heading', { name: 'Browse courses before you choose.' })).toExist(),
      Scene.expect(Scene.label('Search courses')).toExist(),
      Scene.expect(Scene.label('Campus')).toExist(),
      Scene.expect(Scene.label('Study level')).toExist(),
      Scene.expect(Scene.text('Loading the NTNU catalogue')).toExist(),
    );
  });

  test('official results are semantic links into existing course detail', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        ...baseModel(),
        catalogue: CataloguePartial({ response: fixtureSearchResponse(1) }),
        visibleCount: 1,
      }),
      Scene.expect(Scene.role('region', { name: 'Course results' })).toExist(),
      Scene.expect(
        Scene.role('link', {
          name: 'Open TDT4136: Introduction to Artificial Intelligence',
        }),
      ).toExist(),
      Scene.expect(Scene.text('Showing 1 of 1 courses')).toExist(),
      Scene.expect(Scene.text('Campus', { exact: true })).toExist(),
      Scene.expect(Scene.text('Load when opened')).toBeAbsent(),
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

  test('closed detail remains a valid explicit state', () => {
    Scene.scene(
      { update, view },
      Scene.with({ ...baseModel(), selectedCode: null, detail: DetailClosed() }),
      Scene.expect(Scene.role('button', { name: '← Back to course results' })).toBeAbsent(),
    );
  });
});
