import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { createCourseApi } from './app';
import { fixtureCourseDecisionService } from './course-decision/fixture';
import { CourseSourcesUnavailableError } from './course-decision/service';
import type { CourseDecisionService } from './course-decision/service';

const app = createCourseApi(fixtureCourseDecisionService, () => 'request-test');

const unavailableSearchService: CourseDecisionService = {
  ...fixtureCourseDecisionService,
  search: () =>
    Effect.fail(
      new CourseSourcesUnavailableError({
        operation: 'search',
        message: 'The NTNU source is unavailable.',
      }),
    ),
};

const unavailableScheduleService: CourseDecisionService = {
  ...fixtureCourseDecisionService,
  getSchedule: () =>
    Effect.fail(
      new CourseSourcesUnavailableError({
        operation: 'schedule',
        message: 'The NTNU schedule source is unavailable.',
      }),
    ),
};

describe('course decision HTTP transport', () => {
  it.each([
    {
      name: 'search',
      request: () => new Request('http://localhost/v1/course-search?query=TDT4136'),
      expected: {
        items: [expect.objectContaining({ code: 'TDT4136' })],
        meta: expect.objectContaining({ exactMatchCode: 'TDT4136' }),
      },
    },
    {
      name: 'partial insight',
      request: () => new Request('http://localhost/v1/courses/TDT4136/insight'),
      expected: {
        item: {
          code: 'TDT4136',
          gradeOutcomes: {
            sampleSize: { state: 'known' },
            distribution: { state: 'unavailable' },
          },
        },
        meta: { partial: true },
      },
    },
    {
      name: 'grade summary batch',
      request: () =>
        new Request('http://localhost/v1/course-grade-summaries', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ courseCodes: ['TDT4136', 'NORESULT'] }),
        }),
      expected: {
        items: [{ courseCode: 'TDT4136' }, { courseCode: 'NORESULT' }],
        meta: { count: 2 },
      },
    },
    {
      name: 'decision signal batch',
      request: () =>
        new Request('http://localhost/v1/course-decision-signals', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ courseCodes: ['TDT4136', 'NORESULT'], term: '2026-autumn' }),
        }),
      expected: {
        items: [{ courseCode: 'TDT4136' }, { courseCode: 'NORESULT' }],
        meta: { count: 2 },
      },
    },
  ])('returns the declared success family for $name', async ({ request, expected }) => {
    const response = await app.handle(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('request-test');
    expect(body).toMatchObject(expected);
  });

  it('returns a contract-valid schedule response in the requested order', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/course-schedules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseCodes: ['TDT4136', 'TDT4136-1'],
          term: '2026-autumn',
          week: 45,
        }),
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=900',
    );
    expect(body).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            courseCode: 'TDT4136',
            sourceStatus: expect.objectContaining({
              provider: 'ntnu-course-schedule',
              status: 'available',
            }),
            activityStreams: [
              expect.objectContaining({
                activityCode: 'TDT4136-LECTURE-01',
                title: 'Introduction to search',
                summary: 'Lecture',
              }),
              expect.objectContaining({
                activityCode: 'TDT4136-EXERCISE-01',
                title: 'Search exercise',
                summary: 'Exercise session',
              }),
            ],
            occurrences: expect.arrayContaining([
              expect.objectContaining({
                courseCode: 'TDT4136',
                evidence: expect.objectContaining({
                  provider: 'ntnu-course-schedule',
                  kind: 'fixture',
                }),
              }),
            ]),
          }),
          expect.objectContaining({
            courseCode: 'TDT4136-1',
            sourceStatus: expect.objectContaining({
              provider: 'ntnu-course-schedule',
              status: 'unavailable',
            }),
            activityStreams: [],
            occurrences: [],
          }),
        ],
        meta: {
          count: 2,
          term: '2026-autumn',
          week: 45,
          timezone: 'Europe/Oslo',
          limitations: {
            activitySelection: 'all-published-activities',
            activityGrouping: 'unavailable',
            exceptionSemantics: 'provider-status-unverified',
          },
        },
      }),
    );
  });

  it('keeps a valid fixture schedule available when the selected week has no events', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/course-schedules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseCodes: ['TDT4136'], term: '2026-autumn', week: 44 }),
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      items: [
        {
          courseCode: 'TDT4136',
          sourceStatus: { status: 'available' },
          occurrences: [],
          activityStreams: [
            expect.objectContaining({ activityCode: 'TDT4136-LECTURE-01' }),
            expect.objectContaining({ activityCode: 'TDT4136-EXERCISE-01' }),
          ],
        },
      ],
      meta: { week: 44 },
    });
  });

  it('returns a contract-valid problem when the schedule operation fails', async () => {
    const unavailableApp = createCourseApi(unavailableScheduleService, () => 'request-test');
    const response = await unavailableApp.handle(
      new Request('http://localhost/v1/course-schedules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseCodes: ['TDT4136'], term: '2026-autumn', week: 45 }),
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      type: 'https://course-data.example/problems/course-schedule-unavailable',
      status: 503,
      requestId: 'request-test',
    });
  });

  it.each([
    {
      name: 'invalid catalogue paging',
      request: () => new Request('http://localhost/v1/course-search?page=0'),
    },
    {
      name: 'an empty grade-summary batch',
      request: () =>
        new Request('http://localhost/v1/course-grade-summaries', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ courseCodes: [] }),
        }),
    },
    {
      name: 'an invalid schedule week',
      request: () =>
        new Request('http://localhost/v1/course-schedules', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ courseCodes: ['TDT4136'], term: '2026-autumn', week: 0 }),
        }),
    },
  ])('returns a declared 400 problem for $name', async ({ request }) => {
    const response = await app.handle(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      type: 'https://course-data.example/problems/invalid-request',
      status: 400,
      requestId: 'request-test',
    });
  });

  it('maps not-found and source failure domain errors to their declared problem families', async () => {
    const notFound = await app.handle(new Request('http://localhost/v1/courses/NOT101/insight'));
    const unavailableApp = createCourseApi(unavailableSearchService, () => 'request-test');
    const unavailable = await unavailableApp.handle(
      new Request('http://localhost/v1/course-search?query=TDT4136'),
    );

    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toMatchObject({
      type: 'https://course-data.example/problems/course-not-found',
      status: 404,
      requestId: 'request-test',
    });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      type: 'https://course-data.example/problems/course-search-unavailable',
      status: 503,
      requestId: 'request-test',
    });
  });

  it('publishes the endpoint response families through OpenAPI', async () => {
    const response = await app.handle(new Request('http://localhost/openapi/json'));
    const document = (await response.json()) as {
      readonly paths: Readonly<
        Record<
          string,
          Readonly<Record<string, { readonly responses: Readonly<Record<string, unknown>> }>>
        >
      >;
    };

    expect(response.status).toBe(200);
    for (const { path, method, statuses } of [
      {
        path: '/v1/course-search',
        method: 'get',
        statuses: ['200', '400', '503'],
      },
      {
        path: '/v1/course-decision-signals',
        method: 'post',
        statuses: ['200', '400', '503'],
      },
      {
        path: '/v1/course-grade-summaries',
        method: 'post',
        statuses: ['200', '400', '503'],
      },
      {
        path: '/v1/course-schedules',
        method: 'post',
        statuses: ['200', '400', '503'],
      },
      {
        path: '/v1/courses/{courseCode}/insight',
        method: 'get',
        statuses: ['200', '400', '404', '503'],
      },
    ]) {
      const operation = document.paths[path]?.[method];
      expect(operation).toBeDefined();
      if (operation === undefined)
        throw new Error(`OpenAPI omitted ${method.toUpperCase()} ${path}.`);
      expect(Object.keys(operation.responses)).toEqual(expect.arrayContaining(statuses));
    }
  });
});
