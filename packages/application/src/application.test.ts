import { fixtureCourses } from './fixtures';
import { createMemoryCourseRepository } from './index';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';

const repository = createMemoryCourseRepository(fixtureCourses);

describe('memory course repository', () => {
  it('filters by code or title without hidden global state', async () => {
    const result = await Effect.runPromise(repository.list({ search: 'security' }));
    expect(result.map((course) => course.code)).toEqual(['TTM4215']);
  });
});
