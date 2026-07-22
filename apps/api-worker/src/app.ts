import { getPlannerBaseline, listCourses, listProgrammes } from '@course-data/application';
import {
  ListCoursesQueryDto,
  ListCoursesResponseDto,
  ListProgrammesResponseDto,
  PlannerBaselineQueryDto,
  PlannerDemoResponseDto,
  ProblemDto,
  toCourseSummaryDto,
  toPlannerDemoResponseDto,
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
          programmes: '/v1/programmes',
          plannerBaseline: '/v1/planner/baseline',
          plannerDemo: '/v1/planner/demo',
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
            programmes: t.String(),
            plannerBaseline: t.String(),
            plannerDemo: t.String(),
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
      '/v1/programmes',
      async ({ request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
        const result = await runtime.runPromise(Effect.either(listProgrammes()));
        set.headers['x-request-id'] = requestId;
        if (Either.isLeft(result)) {
          return status(503, {
            type: 'https://course-data.example/problems/catalogue-unavailable',
            title: 'Programme catalogue unavailable',
            status: 503,
            detail: result.left.message,
            requestId,
          });
        }
        return {
          items: result.right.items.map((item) => ({ ...item })),
          meta: {
            ...result.right.meta,
            warnings: result.right.meta.warnings.map((warning) => ({ ...warning })),
          },
        };
      },
      {
        response: { 200: ListProgrammesResponseDto, 503: ProblemDto },
        detail: {
          summary: 'List programme versions available to the planner',
          description:
            'Returns programme versions with their institution, cohort, relation authority, and data revision.',
          tags: ['Programmes'],
        },
      },
    )
    .get(
      '/v1/planner/baseline',
      async ({ query, request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
        const result = await runtime.runPromise(
          Effect.either(getPlannerBaseline(query.programmeVersionId)),
        );
        set.headers['x-request-id'] = requestId;
        if (Either.isLeft(result)) {
          if (result.left._tag !== 'ProgrammeVersionNotFoundError') {
            return status(503, {
              type: 'https://course-data.example/problems/planner-unavailable',
              title: 'Planner unavailable',
              status: 503,
              detail: result.left.message,
              requestId,
            });
          }
          return status(404, {
            type: 'https://course-data.example/problems/programme-version-not-found',
            title: 'Programme version not found',
            status: 404,
            detail: `No programme version exists for ${query.programmeVersionId}.`,
            requestId,
          });
        }
        return toPlannerDemoResponseDto(result.right);
      },
      {
        query: PlannerBaselineQueryDto,
        response: {
          200: PlannerDemoResponseDto,
          404: ProblemDto,
          503: ProblemDto,
        },
        detail: {
          summary: 'Generate a baseline planning scenario',
          description:
            'Returns the programme version, deterministic baseline scenario, evaluation, and declarative roadmap view specification.',
          tags: ['Planner'],
        },
      },
    )
    .get(
      '/v1/planner/demo',
      async ({ request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
        const programmes = await runtime.runPromise(Effect.either(listProgrammes()));
        set.headers['x-request-id'] = requestId;
        if (Either.isLeft(programmes) || programmes.right.items[0] === undefined) {
          return status(503, {
            type: 'https://course-data.example/problems/planner-unavailable',
            title: 'Planner unavailable',
            status: 503,
            detail: Either.isLeft(programmes)
              ? programmes.left.message
              : 'No persisted programme version is available.',
            requestId,
          });
        }
        const result = await runtime.runPromise(
          Effect.either(getPlannerBaseline(programmes.right.items[0].programmeVersionId)),
        );
        if (Either.isLeft(result)) {
          return status(503, {
            type: 'https://course-data.example/problems/planner-unavailable',
            title: 'Planner unavailable',
            status: 503,
            detail:
              result.left._tag === 'ProgrammeVersionNotFoundError'
                ? `Persisted programme ${result.left.programmeVersionId} disappeared during the read.`
                : result.left.message,
            requestId,
          });
        }
        return toPlannerDemoResponseDto(result.right);
      },
      {
        response: { 200: PlannerDemoResponseDto, 503: ProblemDto },
        detail: {
          summary: 'Get the default persisted study-roadmap projection',
          description:
            'Returns the first persisted programme version with its baseline planning scenario and structured evaluation findings; it fails when no persisted curriculum is available.',
          tags: ['Planner'],
        },
      },
    )
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
