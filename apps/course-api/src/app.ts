import {
  CourseInsightParamsDto,
  CourseInsightQueryDto,
  CourseInsightResponseDto,
  CourseGradeSummariesRequestDto,
  CourseGradeSummariesResponseDto,
  CourseSearchQueryDto,
  CourseSearchResponseDto,
  ProblemDto,
  toCourseInsightDto,
  toCourseGradeSummaryDto,
  toCourseSearchItemDto,
} from '@course-data/contracts';
import type {
  CourseDecisionService,
  CourseSearchCampus,
  CourseSearchLevel,
} from '@course-data/course-service';
import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import * as Effect from 'effect/Effect';
import * as Result from 'effect/Result';
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

const csv = <Value extends string>(value: string): ReadonlyArray<Value> =>
  value.split(',') as unknown as ReadonlyArray<Value>;

export const createCourseApi = (
  service: CourseDecisionService,
  makeRequestId: () => string = () => crypto.randomUUID(),
) =>
  new Elysia()
    .use(cors({ origin: true }))
    .onError(({ code, request, set }) => {
      if (code !== 'VALIDATION') return;
      const requestId = request.headers.get('cf-ray') ?? makeRequestId();
      set.status = 400;
      set.headers['x-request-id'] = requestId;
      return problem(
        requestId,
        400,
        'invalid-request',
        'Invalid request',
        'The request parameters did not match the published schema.',
      );
    })
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
          gradeSummaries: '/v1/course-grade-summaries',
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
            gradeSummaries: t.String(),
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
          Effect.result(
            service.search({
              ...(query.query === undefined ? {} : { query: query.query }),
              ...(query.term === undefined ? {} : { term: query.term }),
              ...(query.page === undefined ? {} : { page: query.page }),
              ...(query.sort === undefined ? {} : { sort: query.sort }),
              ...(query.campuses === undefined
                ? {}
                : { campuses: csv<CourseSearchCampus>(query.campuses) }),
              ...(query.levels === undefined
                ? {}
                : { levels: csv<CourseSearchLevel>(query.levels) }),
              ...(query.continuingEducation === undefined
                ? {}
                : { continuingEducation: query.continuingEducation === 'true' }),
              ...(query.open === undefined ? {} : { open: query.open === 'true' }),
              ...(query.english === undefined ? {} : { english: query.english === 'true' }),
            }),
          ),
        );
        set.headers['x-request-id'] = requestId;
        set.headers['cache-control'] = 'public, max-age=30, stale-while-revalidate=300';

        if (Result.isFailure(result)) {
          if (result.failure._tag === 'CourseInvalidTermError') {
            return status(
              400,
              problem(
                requestId,
                400,
                'invalid-course-term',
                'Invalid course term',
                result.failure.message,
              ),
            );
          }
          return status(
            503,
            problem(
              requestId,
              503,
              'course-search-unavailable',
              'Course search unavailable',
              result.failure.message,
            ),
          );
        }

        return {
          items: result.success.items.map(toCourseSearchItemDto),
          sourceStatuses: result.success.sourceStatuses.map((sourceStatus) => ({
            ...sourceStatus,
            observedAt: sourceStatus.observedAt?.toISOString() ?? null,
          })),
          meta: {
            count: result.success.items.length,
            total: result.success.total,
            page: result.success.page,
            pageSize: result.success.pageSize,
            hasMore: result.success.hasMore,
            exactMatchCode: result.success.exactMatchCode,
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
    .post(
      '/v1/course-grade-summaries',
      async ({ body, request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? makeRequestId();
        const result = await Effect.runPromise(
          Effect.result(service.getGradeSummaries({ courseCodes: body.courseCodes })),
        );
        set.headers['x-request-id'] = requestId;
        set.headers['cache-control'] = 'public, max-age=300, stale-while-revalidate=3600';

        if (Result.isFailure(result)) {
          return status(
            503,
            problem(
              requestId,
              503,
              'course-grade-summaries-unavailable',
              'Course grade summaries unavailable',
              result.failure.message,
            ),
          );
        }

        return {
          items: result.success.items.map(toCourseGradeSummaryDto),
          sourceStatuses: result.success.sourceStatuses.map((sourceStatus) => ({
            ...sourceStatus,
            observedAt: sourceStatus.observedAt?.toISOString() ?? null,
          })),
          meta: {
            count: result.success.items.length,
            fromYear: result.success.fromYear,
            toYear: result.success.toYear,
          },
        };
      },
      {
        body: CourseGradeSummariesRequestDto,
        response: { 200: CourseGradeSummariesResponseDto, 400: ProblemDto, 503: ProblemDto },
        detail: {
          summary: 'Summarize grades for visible NTNU courses',
          description:
            'Returns official DBH/HK-dir grade availability for up to 40 course codes in one request.',
          tags: ['Courses'],
        },
      },
    )
    .get(
      '/v1/courses/:courseCode/insight',
      async ({ params, query, request, set, status }) => {
        const requestId = request.headers.get('cf-ray') ?? makeRequestId();
        const result = await Effect.runPromise(
          Effect.result(
            service.getInsight({
              courseCode: params.courseCode,
              ...(query.term === undefined ? {} : { term: query.term }),
            }),
          ),
        );
        set.headers['x-request-id'] = requestId;
        set.headers['cache-control'] = 'public, max-age=60, stale-while-revalidate=900';

        if (Result.isFailure(result)) {
          if (result.failure._tag === 'CourseInvalidTermError') {
            return status(
              400,
              problem(
                requestId,
                400,
                'invalid-course-term',
                'Invalid course term',
                result.failure.message,
              ),
            );
          }
          if (result.failure._tag === 'CourseNotFoundError') {
            return status(
              404,
              problem(
                requestId,
                404,
                'course-not-found',
                'Course not found',
                `No NTNU course matched ${result.failure.courseCode}.`,
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
              result.failure.message,
            ),
          );
        }

        return {
          item: toCourseInsightDto(result.success.item),
          meta: { partial: result.success.partial },
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
