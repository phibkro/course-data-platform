import {
  CourseRepository,
  courseRepositoryLayer,
  type CourseRepositoryService,
} from '@course-data/application';
import * as ManagedRuntime from 'effect/ManagedRuntime';

export const createCourseRuntime = (repository: CourseRepositoryService) =>
  ManagedRuntime.make(courseRepositoryLayer(repository));

export type CourseRuntime = ReturnType<typeof createCourseRuntime>;
export type CourseRuntimeServices = CourseRepository;
