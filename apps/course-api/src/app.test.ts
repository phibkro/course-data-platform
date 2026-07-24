import { fixtureCourseDecisionService } from '@course-data/course-service/fixture';
import { describe, expect, it } from 'vitest';

import { createCourseApi } from './app';

const app = createCourseApi(fixtureCourseDecisionService, () => 'request-test');

describe('course decision API', () => {
  it('advertises the student-facing course endpoints', async () => {
    const response = await app.handle(new Request('http://localhost/'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      service: 'NTNU Course Decision API',
      endpoints: {
        search: '/v1/course-search',
        gradeSummaries: '/v1/course-grade-summaries',
        decisionSignals: '/v1/course-decision-signals',
        insight: '/v1/courses/:courseCode/insight',
      },
    });
  });

  it('returns the exact TDT4136 result', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/course-search?query=TDT4136'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('request-test');
    expect(await response.json()).toMatchObject({
      items: [{ code: 'TDT4136', enrichment: 'enriched' }],
      meta: {
        count: 1,
        total: 1,
        page: 1,
        pageSize: 500,
        hasMore: false,
        exactMatchCode: 'TDT4136',
      },
    });
  });

  it('returns a default catalogue page when query is omitted', async () => {
    const response = await app.handle(new Request('http://localhost/v1/course-search'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ code: 'TDT4136' }],
      meta: {
        count: 1,
        total: 1,
        page: 1,
        pageSize: 500,
        hasMore: false,
        exactMatchCode: null,
      },
    });
  });

  it('accepts validated paging, sorting, and official filter parameters', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost/v1/course-search?page=2&sort=code-desc&campuses=trondheim,alesund&levels=bachelor,phd&continuingEducation=true&open=false&english=true',
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [],
      meta: { total: 1, page: 2, pageSize: 500, hasMore: false },
    });
  });

  it.each(['page=1.5', 'page=0', 'page=101', 'campuses=oslo', 'open=maybe'])(
    'returns a declared problem for invalid catalogue query %s',
    async (query) => {
      const response = await app.handle(new Request(`http://localhost/v1/course-search?${query}`));

      expect(response.status).toBe(400);
      expect(response.headers.get('x-request-id')).toBe('request-test');
      expect(await response.json()).toEqual({
        type: 'https://course-data.example/problems/invalid-request',
        title: 'Invalid request',
        status: 400,
        detail: 'The request parameters did not match the published schema.',
        requestId: 'request-test',
      });
    },
  );

  it('returns partial course insight without collapsing unavailable grades', async () => {
    const response = await app.handle(new Request('http://localhost/v1/courses/TDT4136/insight'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      item: {
        code: 'TDT4136',
        gradeOutcomes: {
          sampleSize: { state: 'known', value: 1951 },
          distribution: { state: 'unavailable' },
        },
      },
      meta: { partial: true },
    });
  });

  it('returns a grade summary for every requested visible course', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/course-grade-summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseCodes: ['TDT4136', 'NORESULT'] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [
        {
          courseCode: 'TDT4136',
          sampleSize: { state: 'known', value: 1951 },
          distribution: { state: 'unavailable' },
          gradingScale: { state: 'known', value: 'letter' },
        },
        {
          courseCode: 'NORESULT',
          sampleSize: { state: 'unavailable' },
          distribution: { state: 'unavailable' },
        },
      ],
      meta: { count: 2, fromYear: 2022, toYear: 2025 },
    });
  });

  it('returns decision signals for every requested visible course', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/course-decision-signals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseCodes: ['TDT4136', 'NORESULT'], term: '2026-autumn' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [
        {
          courseCode: 'TDT4136',
          assessment: {
            state: 'known',
            value: [{ form: 'written-exam', weightPercent: { state: 'known', value: 100 } }],
          },
          obligatoryActivities: { state: 'known' },
        },
        {
          courseCode: 'NORESULT',
          assessment: { state: 'unavailable' },
          sourceStatus: { status: 'unavailable' },
        },
      ],
      meta: { count: 2 },
    });
  });

  it.each([
    { courseCodes: [] },
    { courseCodes: ['TDT4136', 'TDT4136'] },
    { courseCodes: ['not valid'] },
    { courseCodes: Array.from({ length: 41 }, (_, index) => `TDT${index}`) },
  ])('rejects invalid grade-summary batches as declared problems', async (body) => {
    const response = await app.handle(
      new Request('http://localhost/v1/course-grade-summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      type: 'https://course-data.example/problems/invalid-request',
      status: 400,
    });
  });

  it.each([
    { courseCodes: [] },
    { courseCodes: ['TDT4136', 'TDT4136'] },
    { courseCodes: ['not valid'] },
    { courseCodes: ['TDT4136'], term: 'latest' },
  ])('rejects invalid decision-signal batches as declared problems', async (body) => {
    const response = await app.handle(
      new Request('http://localhost/v1/course-decision-signals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      type: expect.stringMatching(/invalid-(request|course-term)$/),
      status: 400,
    });
  });

  it('returns a schema-declared not-found problem', async () => {
    const response = await app.handle(new Request('http://localhost/v1/courses/NOT101/insight'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      type: 'https://course-data.example/problems/course-not-found',
      title: 'Course not found',
      status: 404,
      detail: 'No NTNU course matched NOT101.',
      requestId: 'request-test',
    });
  });

  it('publishes the new routes through OpenAPI', async () => {
    const response = await app.handle(new Request('http://localhost/openapi/json'));
    const document = (await response.json()) as { paths?: Record<string, unknown> };

    expect(document.paths).toHaveProperty('/v1/course-search');
    expect(document.paths).toHaveProperty('/v1/course-decision-signals');
    expect(document.paths).toHaveProperty('/v1/course-grade-summaries');
    expect(document.paths).toHaveProperty('/v1/courses/{courseCode}/insight');
  });
});
