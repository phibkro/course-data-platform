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

  it('requests grade summaries for visible course codes in one call', async () => {
    const client = makeCourseClient('http://course-api.test', true);

    const result = await Effect.runPromise(client.getGradeSummaries(['TDT4136', 'NORESULT']));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.failureRatePercent).toMatchObject({
      state: 'known',
      value: 10.7,
    });
    expect(result.items[1]?.sampleSize.state).toBe('unavailable');
  });

  it('posts visible course codes to the grade-summary endpoint', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (_input, init) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          courseCodes: ['TDT4136', 'TDT4100'],
        });
        return Response.json({
          items: [],
          sourceStatuses: [],
          meta: { count: 0, fromYear: 2022, toYear: 2025 },
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    await Effect.runPromise(
      makeCourseClient('http://course-api.test').getGradeSummaries(['TDT4136', 'TDT4100']),
    );

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
      '/v1/course-grade-summaries',
    );
  });

  it('returns fixture decision signals for every visible course code', async () => {
    const result = await Effect.runPromise(
      makeCourseClient('http://course-api.test', true).getDecisionSignals(['TDT4136', 'NORESULT']),
    );

    expect(result.items[0]?.assessment).toMatchObject({
      state: 'known',
      value: [{ form: 'written-exam', weightPercent: { state: 'known', value: 100 } }],
    });
    expect(result.items[1]?.assessment.state).toBe('unavailable');
  });

  it('posts visible course codes and the selected term to the decision-signal endpoint', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (_input, init) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          courseCodes: ['TDT4136', 'TDT4100'],
          term: '2026-autumn',
        });
        return Response.json({ items: [], meta: { count: 0 } });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    await Effect.runPromise(
      makeCourseClient('http://course-api.test').getDecisionSignals(
        ['TDT4136', 'TDT4100'],
        '2026-autumn',
      ),
    );

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
      '/v1/course-decision-signals',
    );
  });
});
