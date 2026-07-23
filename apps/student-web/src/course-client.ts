import {
  CourseInsightResponseDto,
  ProblemDto,
  type CourseInsightResponseDtoType,
} from '@course-data/contracts';
import { Value } from '@sinclair/typebox/value';
import { Effect } from 'effect';

import { partialCourseInsightFixture } from './course-insight.fixture';

export interface CourseClient {
  readonly getInsight: (courseCode: string) => Effect.Effect<CourseInsightResponseDtoType, Error>;
}

const parseCourseInsight = (input: unknown): CourseInsightResponseDtoType => {
  if (!Value.Check(CourseInsightResponseDto, input)) {
    throw new Error('The course API returned an invalid CourseInsight response.');
  }
  return input;
};

export const makeCourseClient = (apiBaseUrl?: string, useFixture = false): CourseClient => ({
  getInsight: (courseCode) => {
    const normalizedCode = courseCode.trim().toUpperCase();

    if (useFixture) {
      if (normalizedCode !== 'TDT4136') {
        return Effect.fail(
          new Error('The local walking skeleton currently contains only TDT4136.'),
        );
      }

      return Effect.sleep('250 millis').pipe(Effect.as(partialCourseInsightFixture));
    }

    if (apiBaseUrl === undefined || apiBaseUrl.length === 0) {
      return Effect.fail(
        new Error(
          'Course API URL is not configured. Set VITE_API_URL or explicitly enable the local fixture.',
        ),
      );
    }

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(
          `${apiBaseUrl.replace(/\/$/, '')}/v1/courses/${encodeURIComponent(normalizedCode)}/insight`,
          {
            headers: { accept: 'application/json' },
          },
        );
        if (!response.ok) {
          const problem: unknown = await response.json().catch(() => null);
          if (Value.Check(ProblemDto, problem)) {
            throw new Error(problem.detail);
          }
          throw new Error(`Course API request failed with status ${response.status}.`);
        }
        return parseCourseInsight(await response.json());
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error('The course API request failed unexpectedly.'),
    });
  },
});

const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

export const courseClient = makeCourseClient(
  apiBaseUrl,
  import.meta.env.VITE_USE_FIXTURE === 'true',
);
