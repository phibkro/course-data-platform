import type { CourseIdentity } from './course-identity';
import type { NtnuResultCourse } from './features/progress/domain';
import { savedCoursesNewestFirst, type SavedCourse, type SavedListState } from './saved-courses';

export const courseOriginFilters = ['all', 'saved', 'results'] as const;
export type CourseOriginFilter = (typeof courseOriginFilters)[number];

/** One course row derived from independent student-owned sources. */
export interface StudentCourse {
  readonly id: string;
  readonly identity: CourseIdentity;
  readonly courseCode: string;
  readonly savedCourse: SavedCourse | null;
  readonly resultCourse: NtnuResultCourse | null;
}

/**
 * Joins bookmarks and NTNU result groups without copying either source. Saved
 * order stays stable; result-only courses follow in latest-result order.
 */
export const studentCourses = (
  saved: SavedListState,
  results: ReadonlyArray<NtnuResultCourse>,
): ReadonlyArray<StudentCourse> => {
  const resultsById = new Map(results.map((course) => [course.identity.savedCourseId, course]));
  const courses: Array<StudentCourse> = savedCoursesNewestFirst(saved).map((savedCourse) => {
    const resultCourse = resultsById.get(savedCourse.id) ?? null;
    resultsById.delete(savedCourse.id);
    return {
      id: savedCourse.id,
      identity: {
        institutionId: savedCourse.institutionId,
        courseCode: savedCourse.courseCode,
        savedCourseId: savedCourse.id,
      },
      courseCode: savedCourse.courseCode,
      savedCourse,
      resultCourse,
    };
  });
  for (const resultCourse of results) {
    if (!resultsById.has(resultCourse.identity.savedCourseId)) continue;
    courses.push({
      id: resultCourse.identity.savedCourseId,
      identity: resultCourse.identity,
      courseCode: resultCourse.identity.courseCode,
      savedCourse: null,
      resultCourse,
    });
  }
  return courses;
};

export const filterStudentCoursesByOrigin = (
  courses: ReadonlyArray<StudentCourse>,
  filter: CourseOriginFilter,
): ReadonlyArray<StudentCourse> =>
  filter === 'saved'
    ? courses.filter((course) => course.savedCourse !== null)
    : filter === 'results'
      ? courses.filter((course) => course.resultCourse !== null)
      : courses;
