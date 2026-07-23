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
      meta: { count: 1, exactMatchCode: 'TDT4136' },
    });
  });

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
    expect(document.paths).toHaveProperty('/v1/courses/{courseCode}/insight');
  });
});
