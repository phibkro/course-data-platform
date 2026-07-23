import {
  CourseInsightParamsDto,
  CourseInsightQueryDto,
  CourseInsightResponseDto,
  CourseSearchQueryDto,
  CourseSearchResponseDto,
  ProblemDto,
  toCourseInsightDto,
  toCourseSearchItemDto,
} from '@course-data/contracts';
import type { CourseDecisionService } from '@course-data/course-service';
import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import * as Either from 'effect/Either';
import * as Effect from 'effect/Effect';
import { Elysia, t } from 'elysia';

const problem = (
  requestId: string,
  status: number,
  type: string,
  title: string,
  detail: string,
) => ({
  type: `https://course-data.example/problems/${type}`,
  title,
  status,
  detail,
  requestId,
});

export const createCourseApi = (
  service: CourseDecisionService,
  makeRequestId: () => string = () => crypto.randomUUID(),
) =>
  new Elysia()
    .use(cors({ origin: true }))
    .use(
      openapi({
        path: '/openapi',
        documentation: {
          info: {
            title: 'NTNU Course Decision API',
            version: '0.1.0',
            description: 'Evidence-backed course discovery and detail for student decision-making.',
          },
        },
      }),
    )
    .get(
      '/',
      () => ({
        service: 'NTNU Course Decision API' as const,
        version: '0.1.0',
        endpoints: {
          health: '/health',
          search: '/v1/course-search',
          insight: '/v1/courses/:courseCode/insight',
          openapi: '/openapi',
          openapiJson: '/openapi/json',
        },
      }),
      {
        response: t.Object({
          service: t.Literal('NTNU Course Decision API'),
          version: t.String(),
          endpoints: t.Object({
            health: t.String(),
            search: t.String(),
            insight: t.String(),
            openapi: t.String(),
            openapiJson: t.String(),
          }),
        }),
        detail: { summary: 'Service index', tags: ['System'] },
      },
    )
    .get('/health', () => ({ status: 'ok' as const }), {
      response: t.Object({ status: t.Literal('ok') }),
      detail: { summary: 'Service health', tags: ['System'] },
    })
    .get(
      '/v1/course-search',
      async ({ query, request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? makeRequestId();
        const result = await Effect.runPromise(
          Effect.either(
            service.search({
              query: query.query,
              ...(query.term === undefined ? {} : { term: query.term }),
              ...(query.language === undefined ? {} : { language: query.language }),
            }),
          ),
        );
        set.headers['x-request-id'] = requestId;
        set.headers['cache-control'] = 'public, max-age=30, stale-while-revalidate=300';

        if (Either.isLeft(result)) {
          if (result.left._tag === 'CourseInvalidTermError') {
            return status(
              400,
              problem(requestId, 400, 'invalid-course-term', 'Invalid course term', result.left.message),
            );
          }
          return status(
            503,
            problem(
              requestId,
              503,
              'course-search-unavailable',
              'Course search unavailable',
              result.left.message,
            ),
          );
        }

        return {
          items: result.right.items.map(toCourseSearchItemDto),
          sourceStatuses: result.right.sourceStatuses.map((sourceStatus) => ({
            ...sourceStatus,
            observedAt: sourceStatus.observedAt?.toISOString() ?? null,
          })),
          meta: {
            count: result.right.items.length,
            exactMatchCode: result.right.exactMatchCode,
          },
        };
      },
      {
        query: CourseSearchQueryDto,
        response: { 200: CourseSearchResponseDto, 400: ProblemDto, 503: ProblemDto },
        detail: {
          summary: 'Search NTNU courses',
          description: 'Returns fast course summaries with explicit enrichment and source status.',
          tags: ['Courses'],
        },
      },
    )
    .get(
      '/v1/courses/:courseCode/insight',
      async ({ params, query, request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? makeRequestId();
        const result = await Effect.runPromise(
          Effect.either(
            service.getInsight({
              courseCode: params.courseCode,
              ...(query.term === undefined ? {} : { term: query.term }),
              ...(query.language === undefined ? {} : { language: query.language }),
            }),
          ),
        );
        set.headers['x-request-id'] = requestId;
        set.headers['cache-control'] = 'public, max-age=60, stale-while-revalidate=900';

        if (Either.isLeft(result)) {
          if (result.left._tag === 'CourseInvalidTermError') {
            return status(
              400,
              problem(requestId, 400, 'invalid-course-term', 'Invalid course term', result.left.message),
            );
          }
          if (result.left._tag === 'CourseNotFoundError') {
            return status(
              404,
              problem(
                requestId,
                404,
                'course-not-found',
                'Course not found',
                `No NTNU course matched ${result.left.courseCode}.`,
              ),
            );
          }
          return status(
            503,
            problem(
              requestId,
              503,
              'course-insight-unavailable',
              'Course insight unavailable',
              result.left.message,
            ),
          );
        }

        return {
          item: toCourseInsightDto(result.right.item),
          meta: { partial: result.right.partial },
        };
      },
      {
        params: CourseInsightParamsDto,
        query: CourseInsightQueryDto,
        response: {
          200: CourseInsightResponseDto,
          400: ProblemDto,
          404: ProblemDto,
          503: ProblemDto,
        },
        detail: {
          summary: 'Understand one NTNU course',
          description:
            'Combines independently sourced course, work-form, assessment, attendance, and grade evidence.',
          tags: ['Courses'],
        },
      },
    );

export type CourseApi = ReturnType<typeof createCourseApi>;
