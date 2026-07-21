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
        programmes: '/v1/programmes',
        plannerBaseline: '/v1/planner/baseline',
        plannerDemo: '/v1/planner/demo',
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

  it('lists programme versions for programme-first onboarding', async () => {
    const response = await app.handle(new Request('http://localhost/v1/programmes'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ programmeVersionId: string; title: string; relationAuthority: string }>;
      meta: { count: number };
    };

    expect(body.meta.count).toBeGreaterThan(0);
    expect(body.items[0]).toMatchObject({
      programmeVersionId: 'no.ntnu:bit:2026',
      title: 'Informatics — bachelor',
      relationAuthority: 'fixture',
    });
  });

  it('generates a baseline for a selected programme version', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/planner/baseline?programmeVersionId=no.ntnu%3Abit%3A2026'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      scenario: { schemaVersion: number; terms: unknown[] };
      viewSpec: { presentation: string };
    };
    expect(body.scenario.schemaVersion).toBe(1);
    expect(body.scenario.terms).toHaveLength(6);
    expect(body.viewSpec.presentation).toBe('roadmap');
  });

  it('returns the illustrative roadmap projection with structured findings', async () => {
    const response = await app.handle(new Request('http://localhost/v1/planner/demo'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      programme: { title: string; relationAuthority: string };
      scenario: { terms: Array<{ courses: unknown[] }> };
      evaluation: { totalPlannedCredits: number; isFeasible: boolean };
      meta: { note: string };
    };

    expect(body.programme).toMatchObject({
      title: 'Informatics — bachelor',
      relationAuthority: 'fixture',
    });
    expect(body.scenario.terms).toHaveLength(6);
    expect(body.evaluation.totalPlannedCredits).toBe(60);
    expect(body.evaluation.isFeasible).toBe(true);
    expect(body.meta.note).toContain('not an official NTNU curriculum');
  });

  it('publishes a runtime-schema-derived OpenAPI document', async () => {
    const response = await app.handle(new Request('http://localhost/openapi/json'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { paths: Record<string, unknown> };
    expect(body.paths).toHaveProperty('/v1/courses');
    expect(body.paths).toHaveProperty('/v1/programmes');
    expect(body.paths).toHaveProperty('/v1/planner/baseline');
    expect(body.paths).toHaveProperty('/v1/planner/demo');
  });
});
