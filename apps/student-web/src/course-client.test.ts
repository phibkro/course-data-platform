import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeCourseClient } from './course-client';

describe('makeCourseClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces the API problem detail for a course that was not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            type: 'course-not-found',
            title: 'Course not found',
            status: 404,
            detail: 'No NTNU course matched NOT101.',
            requestId: 'test-request',
          },
          { status: 404 },
        ),
      ),
    );

    await expect(
      Effect.runPromise(makeCourseClient('http://course-api.test').getInsight('not101')),
    ).rejects.toThrow('No NTNU course matched NOT101.');
  });

  it('requires fixture mode to be enabled explicitly when no API URL is configured', async () => {
    await expect(
      Effect.runPromise(makeCourseClient(undefined).getInsight('TDT4136')),
    ).rejects.toThrow(
      'Course API URL is not configured. Set VITE_API_URL or explicitly enable the local fixture.',
    );
  });
});
