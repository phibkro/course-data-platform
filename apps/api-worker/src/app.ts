import { listCourses } from '@course-data/application';
import {
  ListCoursesQueryDto,
  ListCoursesResponseDto,
  ProblemDto,
  toCourseSummaryDto,
} from '@course-data/contracts';
import { decodeInstitutionId } from '@course-data/domain';
import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import * as Either from 'effect/Either';
import * as Effect from 'effect/Effect';
import { Elysia, t } from 'elysia';

import type { CourseRuntime } from './runtime';

const DATA_REVISION = 'fixture-2026-07-20';

export const createApi = (runtime: CourseRuntime) =>
  new Elysia()
    .use(cors({ origin: true }))
    .use(
      openapi({
        path: '/openapi',
        documentation: {
          info: {
            title: 'Course Data API',
            version: '0.1.0',
            description: 'A provenance-preserving API for comparable higher-education courses.',
          },
        },
      }),
    )
    .get(
      '/',
      () => ({
        service: 'Course Data API' as const,
        version: '0.1.0',
        endpoints: {
          health: '/health',
          courses: '/v1/courses',
          openapi: '/openapi',
          openapiJson: '/openapi/json',
        },
      }),
      {
        response: t.Object({
          service: t.Literal('Course Data API'),
          version: t.String(),
          endpoints: t.Object({
            health: t.String(),
            courses: t.String(),
            openapi: t.String(),
            openapiJson: t.String(),
          }),
        }),
        detail: {
          summary: 'Service index',
          tags: ['System'],
        },
      },
    )
    .get('/health', () => ({ status: 'ok' as const, dataRevision: DATA_REVISION }), {
      response: t.Object({
        status: t.Literal('ok'),
        dataRevision: t.String(),
      }),
      detail: {
        summary: 'Service health',
        tags: ['System'],
      },
    })
    .get(
      '/v1/courses',
      async ({ query, request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
        const result = await runtime.runPromise(
          Effect.either(
            listCourses({
              ...(query.search ? { search: query.search } : {}),
              ...(query.institutionId
                ? { institutionId: decodeInstitutionId(query.institutionId) }
                : {}),
              ...(query.academicYear ? { academicYear: query.academicYear } : {}),
            }),
          ),
        );

        set.headers['cache-control'] = 'public, max-age=60, stale-while-revalidate=300';
        set.headers['x-request-id'] = requestId;

        if (Either.isLeft(result)) {
          return status(503, {
            type: 'https://course-data.example/problems/catalogue-unavailable',
            title: 'Catalogue unavailable',
            status: 503,
            detail: result.left.message,
            requestId,
          });
        }

        const items = result.right.map(toCourseSummaryDto);
        return {
          items,
          meta: {
            count: items.length,
            dataRevision: DATA_REVISION,
          },
        };
      },
      {
        query: ListCoursesQueryDto,
        response: {
          200: ListCoursesResponseDto,
          503: ProblemDto,
        },
        detail: {
          summary: 'List course versions',
          description: 'Returns normalized course versions with source provenance.',
          tags: ['Courses'],
        },
      },
    );

export type Api = ReturnType<typeof createApi>;
