import {
  decodeCourseGradeSummary,
  known,
  suppressed,
  unavailable,
  type CourseGradeSummary,
  type GradingScale,
} from '@course-data/course-model';

import type { ValidatedDbhCourseGrades, ValidatedDbhGradeSummaryRow } from './dbh-grade-summaries';

const LETTER_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F']);
const PASS_FAIL_GRADES = new Set(['G', 'H']);
const FAIL_GRADES = new Set(['F', 'H']);

const unavailableSummary = (courseCode: string, reason: string): CourseGradeSummary =>
  decodeCourseGradeSummary({
    courseCode,
    period: unavailable(reason),
    sampleSize: unavailable(reason),
    distribution: unavailable(reason),
    failureRatePercent: unavailable(reason),
    gradingScale: unavailable(reason),
    evidence: [],
  });

const distributionOf = (
  rows: ReadonlyArray<ValidatedDbhGradeSummaryRow>,
): ReadonlyArray<{
  readonly grade: string;
  readonly count: number;
  readonly percentage: number;
}> => {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.grade, (counts.get(row.grade) ?? 0) + row.candidateCount);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()].map(([grade, count]) => ({
    grade,
    count,
    percentage: total > 0 ? Math.round((10000 * count) / total) / 100 : 0,
  }));
};

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
  if (assessedRows.length === 0) {
    return unavailableSummary(
      courseCode,
      'DBH/HK-dir exposed no assessed grade outcomes for this course in the selected period.',
    );
  }

  const years = assessedRows.map((row) => row.year);
  const period = { fromYear: Math.min(...years), toYear: Math.max(...years) };
  const hasLetterGrades = assessedRows.some((row) => LETTER_GRADES.has(row.grade));
  const hasPassFailGrades = assessedRows.some((row) => PASS_FAIL_GRADES.has(row.grade));
  const gradingScale: GradingScale =
    hasLetterGrades && hasPassFailGrades ? 'mixed' : hasPassFailGrades ? 'pass-fail' : 'letter';
  const evidenceId = `evidence:${grades.sourceRecordId}`;
  const evidence = [
    {
      id: evidenceId,
      provider: grades.attribution.provider,
      kind: grades.attribution.evidenceKind,
      recordId: grades.sourceRecordId,
      sourceUrl: null,
      sourcePeriod: `${period.fromYear}-${period.toYear}`,
      observedAt: grades.attribution.retrievedAt,
      excerpt: null,
      inferenceRule: null,
    },
  ];

  // DBH/HK-dir anonymizes small counts as a returned zero. A returned zero on
  // an assessed bucket is therefore suppression, not evidence of zero
  // candidates, and it makes the whole sample/distribution/failure-rate
  // picture for this course incomplete rather than merely small.
  const hasSuppressedRow = assessedRows.some((row) => row.candidateCount === 0);
  if (hasSuppressedRow) {
    const reason =
      'DBH/HK-dir returned a privacy-protected zero candidate count for an assessed grade bucket in this period.';
    return decodeCourseGradeSummary({
      courseCode,
      period: known(period, [evidenceId]),
      sampleSize: suppressed(reason, [evidenceId]),
      distribution: suppressed(reason, [evidenceId]),
      failureRatePercent: suppressed(reason, [evidenceId]),
      gradingScale: known(gradingScale, [evidenceId]),
      evidence,
    });
  }

  const sampleSize = assessedRows.reduce((sum, row) => sum + row.candidateCount, 0);
  const failureCount = assessedRows.reduce(
    (sum, row) => sum + (FAIL_GRADES.has(row.grade) ? row.candidateCount : 0),
    0,
  );

  return decodeCourseGradeSummary({
    courseCode,
    period: known(period, [evidenceId]),
    sampleSize: known(sampleSize, [evidenceId]),
    distribution: known(distributionOf(assessedRows), [evidenceId]),
    failureRatePercent: known(Math.round((10000 * failureCount) / sampleSize) / 100, [evidenceId]),
    gradingScale: known(gradingScale, [evidenceId]),
    evidence,
  });
};
