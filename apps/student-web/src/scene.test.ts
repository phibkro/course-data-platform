import { Scene } from 'foldkit';
import { describe, test } from 'vitest';

import {
  FailedCourseInsight,
  FetchCourseInsight,
  SearchIdle,
  SearchSuccess,
  SucceededCourseInsight,
  type Model,
  update,
  view,
} from './main';
import { fullCourseInsightFixture, partialCourseInsightFixture } from './course-insight.fixture';

const emptyModel: Model = {
  query: '',
  result: SearchIdle(),
};

describe('exact course search scene', () => {
  test('fresh visitor sees an accessible course-code search', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.expect(Scene.label('Course code')).toExist(),
      Scene.expect(Scene.role('button', { name: 'Find course' })).toExist(),
      Scene.expect(Scene.text('Start with one course')).toExist(),
      Scene.expect(Scene.role('article')).toBeAbsent(),
    );
  });

  test('TDT4136 flows through loading to a useful partial detail page', () => {
    Scene.scene(
      { update, view },
      Scene.with(emptyModel),
      Scene.type(Scene.label('Course code'), 'tdt4136'),
      Scene.click(Scene.role('button', { name: 'Find course' })),
      Scene.expect(Scene.role('button', { name: 'Looking up course…' })).toBeDisabled(),
      Scene.expect(Scene.text('Gathering course evidence')).toExist(),
      Scene.Command.expectExact(FetchCourseInsight({ courseCode: 'TDT4136' })),
      Scene.Command.resolve(
        FetchCourseInsight,
        SucceededCourseInsight({ response: partialCourseInsightFixture }),
      ),
      Scene.inside(
        Scene.role('article', { name: 'TDT4136 course details' }),
        Scene.expect(
          Scene.role('heading', {
            name: 'Introduction to Artificial Intelligence',
          }),
        ).toExist(),
        Scene.expect(Scene.text('Partial result')).toExist(),
        Scene.expect(Scene.text('7.5')).toExist(),
        Scene.expect(Scene.text('Individual written school exam', { exact: false })).toExist(),
        Scene.expect(Scene.text('The grade source did not respond.', { exact: false })).toExist(),
        Scene.expect(Scene.text('No explicit attendance requirement', { exact: false })).toExist(),
        Scene.expect(Scene.first(Scene.all.role('link', { name: 'Open source ↗' }))).toExist(),
      ),
    );
  });

  test('complete data renders a distinct success state', () => {
    Scene.scene(
      { update, view },
      Scene.with({
        query: 'TDT4136',
        result: SearchSuccess({ response: fullCourseInsightFixture }),
      }),
      Scene.expect(Scene.text('All configured sources responded.')).toExist(),
      Scene.expect(Scene.text('640 results')).toExist(),
      Scene.expect(Scene.text('8.3%')).toExist(),
      Scene.expect(Scene.text('Partial result')).toBeAbsent(),
    );
  });

  test('failed request preserves the query and offers a retryable form', () => {
    Scene.scene(
      { update, view },
      Scene.with({ query: 'TDT4136', result: SearchIdle() }),
      Scene.submit(Scene.role('form')),
      Scene.Command.resolve(
        FetchCourseInsight,
        FailedCourseInsight({ error: 'Course API unavailable' }),
      ),
      Scene.expect(Scene.role('alert')).toExist(),
      Scene.expect(Scene.text('Course API unavailable')).toExist(),
      Scene.expect(Scene.label('Course code')).toHaveValue('TDT4136'),
      Scene.expect(Scene.role('button', { name: 'Find course' })).toBeEnabled(),
    );
  });
});
