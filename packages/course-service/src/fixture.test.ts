import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { fixtureCourseDecisionService } from './fixture';

describe('fixtureCourseDecisionService', () => {
  it('returns an exact TDT4136 search result', async () => {
    const result = await Effect.runPromise(
      fixtureCourseDecisionService.search({ query: 'tdt4136' }),
    );

    expect(result.exactMatchCode).toBe('TDT4136');
    expect(result.items).toHaveLength(1);
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 500,
      hasMore: false,
    });
    expect(result.items[0]?.title).toMatchObject({
      state: 'known',
      value: 'Introduction to Artificial Intelligence',
    });
  });

  it('returns the first catalogue page for a blank query', async () => {
    const result = await Effect.runPromise(fixtureCourseDecisionService.search({}));

    expect(result.items).toHaveLength(1);
    expect(result.exactMatchCode).toBeNull();
  });

  it('returns a partial evidence-backed course insight', async () => {
    const result = await Effect.runPromise(
      fixtureCourseDecisionService.getInsight({ courseCode: 'TDT4136' }),
    );

    expect(result.partial).toBe(true);
    expect(result.item.gradeOutcomes.sampleSize).toMatchObject({
      state: 'known',
      value: 1951,
    });
    expect(result.item.gradeOutcomes.distribution).toMatchObject({
      state: 'unavailable',
    });
  });

  it('fails explicitly for an absent course', async () => {
    const result = await Effect.runPromise(
      Effect.either(fixtureCourseDecisionService.getInsight({ courseCode: 'NOT101' })),
    );

    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'CourseNotFoundError', courseCode: 'NOT101' },
    });
  });
});
