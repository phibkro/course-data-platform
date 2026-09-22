/** A normalized NTNU course identity shared by local student-owned features. */
export interface CourseIdentity {
  readonly institutionId: 'ntnu';
  readonly courseCode: string;
  readonly savedCourseId: string;
}

export const courseCodeSource = '[A-ZÆØÅ][A-ZÆØÅ0-9]*\\d[A-ZÆØÅ0-9]*(?:-\\d+)?';
const courseCodePattern = new RegExp(`^${courseCodeSource}$`, 'u');

export const isCourseCode = (candidate: string): boolean =>
  courseCodePattern.test(candidate.trim().toUpperCase());

export const courseIdentity = (candidate: string): CourseIdentity | null => {
  const courseCode = candidate.trim().toUpperCase();
  if (!courseCodePattern.test(courseCode)) return null;
  return { institutionId: 'ntnu', courseCode, savedCourseId: `ntnu:${courseCode}` };
};

/** Maps a result into the NTNU catalogue only when its institution is explicit. */
export const ntnuCourseIdentity = (
  institution: string,
  courseCode: string,
): CourseIdentity | null =>
  institution.trim().toUpperCase() === 'NTNU' ? courseIdentity(courseCode) : null;
