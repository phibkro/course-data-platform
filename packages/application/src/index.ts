import type { CourseSummary, InstitutionId } from '@course-data/domain';
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

export interface CourseQuery {
  readonly search?: string;
  readonly institutionId?: InstitutionId;
  readonly academicYear?: number;
}

export class RepositoryError extends Data.TaggedError('RepositoryError')<{
  readonly operation: string;
  readonly message: string;
}> {}

export interface CourseRepositoryService {
  readonly list: (
    query: CourseQuery,
  ) => Effect.Effect<ReadonlyArray<CourseSummary>, RepositoryError>;
}

export class CourseRepository extends Context.Tag('@course-data/CourseRepository')<
  CourseRepository,
  CourseRepositoryService
>() {}

export const listCourses = (query: CourseQuery) =>
  Effect.flatMap(CourseRepository, (repository) => repository.list(query));

export const courseRepositoryLayer = (repository: CourseRepositoryService) =>
  Layer.succeed(CourseRepository, repository);

export const createMemoryCourseRepository = (
  courses: ReadonlyArray<CourseSummary>,
): CourseRepositoryService => ({
  list: (query) =>
    Effect.sync(() => {
      const search = query.search?.trim().toLocaleLowerCase();
      return courses.filter((course) => {
        if (query.institutionId && course.institutionId !== query.institutionId) return false;
        if (query.academicYear && course.academicYear !== query.academicYear) return false;
        if (!search) return true;
        return (
          course.code.toLocaleLowerCase().includes(search) ||
          course.title.toLocaleLowerCase().includes(search)
        );
      });
    }),
});
