import { Effect } from 'effect';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  fixtureDecisionSignalsResponse,
  fixtureSearchResponse,
  makeCourseClient,
} from './course-client';

describe('course client public boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('encodes official browse filters and decodes a valid search response', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(fixtureSearchResponse(1)));
    vi.stubGlobal('fetch', fetchMock);

    const response = await Effect.runPromise(
      makeCourseClient('http://course-api.test').search({
        query: '  algoritmer  ',
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

    const [request] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request));
    expect(response.items.length).toBeGreaterThan(0);
    expect(url.pathname).toBe('/v1/course-search');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
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

  test('encodes the visible course set and term for decision signals', async () => {
    const courseCodes = ['TDT4136', 'TDT4100'];
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(fixtureDecisionSignalsResponse(courseCodes)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await Effect.runPromise(
      makeCourseClient('http://course-api.test').getDecisionSignals(courseCodes, '2026-autumn'),
    );

    const [request, init] = fetchMock.mock.calls[0] ?? [];
    expect(new URL(String(request)).pathname).toBe('/v1/course-decision-signals');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({ courseCodes, term: '2026-autumn' });
    expect(response.items.map((item) => item.courseCode)).toEqual(courseCodes);
  });

  test('rejects malformed success payloads and surfaces a provider problem detail', async () => {
    const malformedSearch = vi.fn<typeof fetch>(async () =>
      Response.json({ ...fixtureSearchResponse(1), meta: { count: 1, exactMatchCode: null } }),
    );
    vi.stubGlobal('fetch', malformedSearch);

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

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
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
});
