import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureSearchResponse, makeCourseClient } from './course-client';

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

  it('builds a browse request with explicit official filters', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (_input) =>
      Response.json(fixtureSearchResponse(1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await Effect.runPromise(
      makeCourseClient('http://course-api.test').search({
        query: 'algoritmer',
        term: '2026-autumn',
        page: 2,
        sort: 'title-asc',
        campus: 'trondheim',
        level: 'master',
        continuingEducation: false,
        open: true,
        english: true,
      }),
    );

    expect(result.meta.total).toBe(1);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe('/v1/course-search');
    expect(Object.fromEntries(requestedUrl.searchParams)).toMatchObject({
      query: 'algoritmer',
      term: '2026-autumn',
      page: '2',
      sort: 'title-asc',
      campuses: 'trondheim',
      levels: 'master',
      continuingEducation: 'false',
      open: 'true',
      english: 'true',
    });
  });

  it('rejects search responses without pagination metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...fixtureSearchResponse(1),
          meta: { count: 1, exactMatchCode: null },
        }),
      ),
    );

    await expect(
      Effect.runPromise(
        makeCourseClient('http://course-api.test').search({
          query: '',
          term: '2026-autumn',
          page: 1,
          sort: 'relevance',
          continuingEducation: true,
          open: false,
          english: false,
        }),
      ),
    ).rejects.toThrow('The course API returned an invalid CourseSearch response.');
  });
});
