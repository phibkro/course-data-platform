import {
  CourseRepository,
  ProgrammeCurriculumRepository,
  courseRepositoryLayer,
  type CourseRepositoryService,
  programmeCurriculumRepositoryLayer,
  type ProgrammeCurriculumRepositoryService,
} from '@course-data/application';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

export const createCourseRuntime = (
  courseRepository: CourseRepositoryService,
  programmeRepository: ProgrammeCurriculumRepositoryService,
) =>
  ManagedRuntime.make(
    Layer.merge(
      courseRepositoryLayer(courseRepository),
      programmeCurriculumRepositoryLayer(programmeRepository),
    ),
  );

export type CourseRuntime = ReturnType<typeof createCourseRuntime>;
export type CourseRuntimeServices = CourseRepository | ProgrammeCurriculumRepository;
