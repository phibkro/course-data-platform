import type { CourseSummary } from '@course-data/domain';
import { t } from 'elysia';

export const CourseLevelDto = t.Union([
  t.Literal('bachelor'),
  t.Literal('master'),
  t.Literal('phd'),
  t.Literal('continuing-education'),
  t.Literal('unknown'),
]);

export const SourceReferenceDto = t.Object({
  provider: t.String({ minLength: 1 }),
  recordId: t.String({ minLength: 1 }),
  retrievedAt: t.String({ format: 'date-time' }),
});

export const CourseSummaryDto = t.Object({
  id: t.String(),
  courseId: t.String(),
  institutionId: t.String(),
  institutionShortName: t.String(),
  code: t.String(),
  title: t.String(),
  academicYear: t.Integer({ minimum: 2000, maximum: 2200 }),
  credits: t.Union([t.Number({ minimum: 0, maximum: 60 }), t.Null()]),
  level: CourseLevelDto,
  teachingLanguage: t.Union([t.String(), t.Null()]),
  source: SourceReferenceDto,
});

export const ListCoursesQueryDto = t.Object({
  search: t.Optional(t.String({ maxLength: 200 })),
  institutionId: t.Optional(t.String({ minLength: 1 })),
  academicYear: t.Optional(t.Numeric({ minimum: 2000, maximum: 2200 })),
});

export const ListCoursesResponseDto = t.Object({
  items: t.Array(CourseSummaryDto),
  meta: t.Object({
    count: t.Integer({ minimum: 0 }),
    dataRevision: t.String(),
  }),
});

export const ProblemDto = t.Object({
  type: t.String(),
  title: t.String(),
  status: t.Integer(),
  detail: t.String(),
  requestId: t.String(),
});

export type CourseSummaryDtoType = typeof CourseSummaryDto.static;
export type ListCoursesResponseDtoType = typeof ListCoursesResponseDto.static;

export const toCourseSummaryDto = (course: CourseSummary): CourseSummaryDtoType => ({
  ...course,
  source: {
    ...course.source,
    retrievedAt: course.source.retrievedAt.toISOString(),
  },
});
