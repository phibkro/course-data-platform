import {
  compareProgrammes,
  getDataStatus,
  getPlannerBaseline,
  listCourses,
  listProgrammes,
} from '@course-data/application';
import {
  CompareProgrammesQueryDto,
  CompareProgrammesResponseDto,
  DataStatusResponseDto,
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

const createCompareApi = (runtime: CourseRuntime) =>
  new Elysia().get(
    '/v1/compare',
    async ({ query, request, set, status }) => {
      const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
      const result = await runtime.runPromise(
        Effect.either(
          compareProgrammes(query.leftProgrammeVersionId, query.rightProgrammeVersionId),
        ),
      );
      set.headers['x-request-id'] = requestId;
      if (Either.isLeft(result)) {
        if (result.left._tag === 'CompareUnavailableError') {
          return status(409, {
            type: 'https://course-data.example/problems/compare-locked',
            title: 'Compare is locked',
            status: 409,
            detail: `Compare requires ${result.left.requiredProgrammeCount} programmes; ${result.left.availableProgrammeCount} are available.`,
            requestId,
          });
        }
        if (result.left._tag === 'ProgrammeVersionNotFoundError') {
          return status(404, {
            type: 'https://course-data.example/problems/programme-version-not-found',
            title: 'Programme version not found',
            status: 404,
            detail: `No programme version exists for ${result.left.programmeVersionId}.`,
            requestId,
          });
        }
        return status(503, {
          type: 'https://course-data.example/problems/compare-unavailable',
          title: 'Compare unavailable',
          status: 503,
          detail: result.left.message,
          requestId,
        });
      }
      return {
        left: {
          ...result.right.left,
          uniqueCourses: result.right.left.uniqueCourses.map((course) => ({ ...course })),
        },
        right: {
          ...result.right.right,
          uniqueCourses: result.right.right.uniqueCourses.map((course) => ({ ...course })),
        },
        sharedCourses: result.right.sharedCourses.map((course) => ({ ...course })),
        meta: { ...result.right.meta },
      };
    },
    {
      query: CompareProgrammesQueryDto,
      response: {
        200: CompareProgrammesResponseDto,
        404: ProblemDto,
        409: ProblemDto,
        503: ProblemDto,
      },
      detail: { summary: 'Compare two published programme versions', tags: ['Programmes'] },
    },
  );

const createDataStatusApi = (runtime: CourseRuntime) =>
  new Elysia().get(
    '/v1/data-status',
    async ({ request, set, status }) => {
      const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
      const result = await runtime.runPromise(Effect.either(getDataStatus()));
      set.headers['x-request-id'] = requestId;
      set.headers['cache-control'] = 'public, max-age=30, stale-while-revalidate=60';
      if (Either.isLeft(result)) {
        return status(503, {
          type: 'https://course-data.example/problems/data-status-unavailable',
          title: 'Data status unavailable',
          status: 503,
          detail: result.left.message,
          requestId,
        });
      }
      return {
        sources: result.right.sources.map((source) => ({ ...source })),
        meta: { ...result.right.meta },
      };
    },
    {
      response: { 200: DataStatusResponseDto, 503: ProblemDto },
      detail: { summary: 'Read live source freshness', tags: ['System'] },
    },
  );

const createCoursesApi = (runtime: CourseRuntime) =>
  new Elysia().get(
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
      return { items, meta: { count: items.length, dataRevision: DATA_REVISION } };
    },
    {
      query: ListCoursesQueryDto,
      response: { 200: ListCoursesResponseDto, 503: ProblemDto },
      detail: {
        summary: 'List course versions',
        description: 'Returns normalized course versions with source provenance.',
        tags: ['Courses'],
      },
    },
  );

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
          compare: '/v1/compare',
          dataStatus: '/v1/data-status',
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
            compare: t.String(),
            dataStatus: t.String(),
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
    .use(createCoursesApi(runtime))
    .use(createDataStatusApi(runtime))
    .use(createCompareApi(runtime));

export type Api = ReturnType<typeof createApi>;
