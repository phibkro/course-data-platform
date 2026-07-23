import { Story } from 'foldkit';
import { expect, test } from 'vitest';

import {
  FailedCourseInsight,
  FetchCourseInsight,
  SearchIdle,
  SubmittedSearch,
  SyncedCourseUrl,
  SyncCourseUrl,
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
    Story.Command.expectExact(
      FetchCourseInsight({ courseCode: 'TDT4136' }),
      SyncCourseUrl({ courseCode: 'TDT4136' }),
    ),
    Story.Command.resolve(SyncCourseUrl, SyncedCourseUrl()),
    Story.Command.resolve(
      FetchCourseInsight,
      SucceededCourseInsight({ response: partialCourseInsightFixture }),
    ),
    Story.model((model) => {
      expect(model.result).toMatchObject({
        _tag: 'SearchPartial',
        response: {
          item: {
            code: 'TDT4136',
            gradeOutcomes: { sampleSize: { state: 'unavailable' } },
          },
        },
      });
    }),
  );
});

test('a complete response is represented separately from partial data', () => {
  Story.story(
    update,
    Story.with(initialModel),
    Story.message(SubmittedSearch()),
    Story.Command.resolve(SyncCourseUrl, SyncedCourseUrl()),
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
    Story.Command.resolve(SyncCourseUrl, SyncedCourseUrl()),
    Story.Command.resolve(
      FetchCourseInsight,
      FailedCourseInsight({ error: 'Course API unavailable' }),
    ),
    Story.model((model) => {
      expect(model.result).toMatchObject({
        _tag: 'SearchFailure',
        error: 'Course API unavailable',
      });
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
