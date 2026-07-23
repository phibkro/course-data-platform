import { Story } from 'foldkit';
import { expect, test } from 'vitest';

import {
  FailedCourseInsight,
  FetchCourseInsight,
  SearchIdle,
  SubmittedSearch,
  SucceededCourseInsight,
  type Model,
  update,
} from './main';
import { fullCourseInsightFixture, partialCourseInsightFixture } from './course-insight.fixture';

const initialModel: Model = {
  query: 'TDT4136',
  result: SearchIdle(),
};

test('exact search moves through loading to partial data without losing course facts', () => {
  Story.story(
    update,
    Story.with(initialModel),
    Story.message(SubmittedSearch()),
    Story.model((model) => {
      expect(model.query).toBe('TDT4136');
      expect(model.result._tag).toBe('SearchLoading');
    }),
    Story.Command.expectExact(FetchCourseInsight({ courseCode: 'TDT4136' })),
    Story.Command.resolve(
      FetchCourseInsight,
      SucceededCourseInsight({ response: partialCourseInsightFixture }),
    ),
    Story.model((model) => {
      expect(model.result._tag).toBe('SearchPartial');
      if (model.result._tag === 'SearchPartial') {
        expect(model.result.response.item.code).toBe('TDT4136');
        expect(model.result.response.item.gradeOutcomes.sampleSize.state).toBe('unavailable');
      }
    }),
  );
});

test('a complete response is represented separately from partial data', () => {
  Story.story(
    update,
    Story.with(initialModel),
    Story.message(SubmittedSearch()),
    Story.Command.resolve(
      FetchCourseInsight,
      SucceededCourseInsight({ response: fullCourseInsightFixture }),
    ),
    Story.model((model) => {
      expect(model.result._tag).toBe('SearchSuccess');
    }),
  );
});

test('source failure becomes an explicit failure state', () => {
  Story.story(
    update,
    Story.with(initialModel),
    Story.message(SubmittedSearch()),
    Story.Command.resolve(
      FetchCourseInsight,
      FailedCourseInsight({ error: 'Course API unavailable' }),
    ),
    Story.model((model) => {
      expect(model.result._tag).toBe('SearchFailure');
      if (model.result._tag === 'SearchFailure') {
        expect(model.result.error).toBe('Course API unavailable');
      }
    }),
  );
});

test('blank search fails locally and does not create a command', () => {
  Story.story(
    update,
    Story.with({ query: '   ', result: SearchIdle() }),
    Story.message(SubmittedSearch()),
    Story.Command.expectNone(),
    Story.model((model) => {
      expect(model.result._tag).toBe('SearchFailure');
    }),
  );
});
