import { describe, expect, test } from 'vitest';

import { courseIdentity } from './course-identity';
import { ntnuResultCourses, type CourseResult } from './features/progress/domain';
import { emptySavedList, saveCourse } from './saved-courses';
import { filterStudentCoursesByOrigins, studentCourses } from './student-courses';

const identity = (courseCode: string) => {
  const parsed = courseIdentity(courseCode);
  if (parsed === null) throw new Error(`Expected a valid course code: ${courseCode}`);
  return parsed;
};

const result = (courseCode: string, name: string): CourseResult => ({
  institution: 'NTNU',
  code: courseCode,
  name,
  year: 2025,
  term: 1,
  credits: 7.5,
  grade: 'A',
  included: true,
});

describe('student course projection', () => {
  test('joins matching results while preserving independent saved and result facets', () => {
    const saved = saveCourse(
      saveCourse(emptySavedList, identity('TDT4100'), '2026-01-01T00:00:00.000Z'),
      identity('TMA4100'),
      '2026-02-01T00:00:00.000Z',
    );
    const projected = studentCourses(
      saved,
      ntnuResultCourses([
        result('TDT4100', 'Object-oriented programming'),
        result('IT1901', 'Informatics project'),
      ]),
    );

    expect(projected.map((course) => course.id)).toEqual([
      'ntnu:TMA4100',
      'ntnu:TDT4100',
      'ntnu:IT1901',
    ]);
    expect(projected[1]).toMatchObject({
      savedCourse: { courseCode: 'TDT4100' },
      resultCourse: { title: 'Object-oriented programming' },
    });
    expect(
      filterStudentCoursesByOrigins(projected, ['saved']).map((course) => course.courseCode),
    ).toEqual(['TMA4100', 'TDT4100']);
    expect(
      filterStudentCoursesByOrigins(projected, ['results']).map((course) => course.courseCode),
    ).toEqual(['TDT4100', 'IT1901']);
    expect(
      filterStudentCoursesByOrigins(projected, ['saved', 'results']).map(
        (course) => course.courseCode,
      ),
    ).toEqual(['TMA4100', 'TDT4100', 'IT1901']);
    expect(filterStudentCoursesByOrigins(projected, [])).toEqual([]);
    expect(saved.savedCourses).toHaveLength(2);
  });
});
