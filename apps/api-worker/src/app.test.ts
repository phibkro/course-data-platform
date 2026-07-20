import { createMemoryCourseRepository } from '@course-data/application';
import { fixtureCourses } from '@course-data/application/fixtures';
import { describe, expect, it } from 'vitest';

import { createApi } from './app';
import { createCourseRuntime } from './runtime';

const runtime = createCourseRuntime(createMemoryCourseRepository(fixtureCourses));
const app = createApi(runtime);

describe('Course Data API', () => {
  it('publishes a discoverable service index at the root', async () => {
    const response = await app.handle(new Request('http://localhost/'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      service: 'Course Data API',
      endpoints: {
        health: '/health',
        courses: '/v1/courses',
        openapi: '/openapi',
      },
    });
  });

  it('allows the local PWA origin to call the API', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/courses', {
        headers: { origin: 'http://localhost:5173' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('validates, filters, and returns source provenance', async () => {
    const response = await app.handle(new Request('http://localhost/v1/courses?search=security'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ code: string; source: { provider: string } }>;
      meta: { count: number };
    };
    expect(body.meta.count).toBe(1);
    expect(body.items[0]).toMatchObject({
      code: 'TTM4215',
      source: { provider: 'fixture' },
    });
  });

  it('publishes a runtime-schema-derived OpenAPI document', async () => {
    const response = await app.handle(new Request('http://localhost/openapi/json'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { paths: Record<string, unknown> };
    expect(body.paths).toHaveProperty('/v1/courses');
  });
});
