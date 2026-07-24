import {
  decodeCourseGradeSummary,
  known,
  unavailable,
  type CourseGradeSummary,
  type GradingScale,
} from '@course-data/course-model';

import type { ValidatedDbhCourseGrades } from './dbh-grade-summaries';

const LETTER_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F']);
const PASS_FAIL_GRADES = new Set(['G', 'H']);
const FAIL_GRADES = new Set(['F', 'H']);

const unavailableSummary = (courseCode: string, reason: string): CourseGradeSummary =>
  decodeCourseGradeSummary({
    courseCode,
    period: unavailable(reason),
    sampleSize: unavailable(reason),
    failureRatePercent: unavailable(reason),
    gradingScale: unavailable(reason),
    evidence: [],
  });

export const mapDbhToGradeSummary = (
  courseCode: string,
  grades: ValidatedDbhCourseGrades | null,
): CourseGradeSummary => {
  if (grades === null || grades.rows.length === 0) {
    return unavailableSummary(
      courseCode,
      'DBH/HK-dir exposed no assessed grade outcomes for this course in the selected period.',
    );
  }

  const assessedRows = grades.rows.filter(
    (row) => LETTER_GRADES.has(row.grade) || PASS_FAIL_GRADES.has(row.grade),
  );
  const sampleSize = assessedRows.reduce((sum, row) => sum + row.candidateCount, 0);
  if (sampleSize === 0) {
    return unavailableSummary(
      courseCode,
      'DBH/HK-dir exposed no assessed grade outcomes for this course in the selected period.',
    );
  }

  const failureCount = assessedRows.reduce(
    (sum, row) => sum + (FAIL_GRADES.has(row.grade) ? row.candidateCount : 0),
    0,
  );
  const hasLetterGrades = assessedRows.some(
    (row) => LETTER_GRADES.has(row.grade) && row.candidateCount > 0,
  );
  const hasPassFailGrades = assessedRows.some(
    (row) => PASS_FAIL_GRADES.has(row.grade) && row.candidateCount > 0,
  );
  const gradingScale: GradingScale =
    hasLetterGrades && hasPassFailGrades ? 'mixed' : hasPassFailGrades ? 'pass-fail' : 'letter';
  const evidenceId = `evidence:${grades.sourceRecordId}`;

  return decodeCourseGradeSummary({
    courseCode,
    period: known(grades.attribution.period, [evidenceId]),
    sampleSize: known(sampleSize, [evidenceId]),
    failureRatePercent: known(Math.round((10000 * failureCount) / sampleSize) / 100, [evidenceId]),
    gradingScale: known(gradingScale, [evidenceId]),
    evidence: [
      {
        id: evidenceId,
        provider: grades.attribution.provider,
        kind: grades.attribution.evidenceKind,
        recordId: grades.sourceRecordId,
        sourceUrl: null,
        sourcePeriod: `${grades.attribution.period.fromYear}-${grades.attribution.period.toYear}`,
        observedAt: grades.attribution.retrievedAt,
        excerpt: null,
        inferenceRule: null,
      },
    ],
  });
};
