import {
  known,
  suppressed,
  unavailable,
  type Fact,
} from '../../course-decision/model/course-insight';

import type { ValidatedDbhCourseGrades } from './dbh-grade-summaries';

export interface EncodedEvidence {
  readonly id: string;
  readonly provider: string;
  readonly kind: 'source-fact' | 'inference' | 'fixture';
  readonly recordId: string;
  readonly sourceUrl: string | null;
  readonly sourcePeriod: string | null;
  readonly observedAt: string;
  readonly excerpt: string | null;
  readonly inferenceRule: string | null;
}

export interface EncodedSourceStatus {
  readonly provider: string;
  readonly status: 'available' | 'unavailable' | 'failed';
  readonly observedAt: string | null;
  readonly warning: string | null;
}

export interface GradeBucket {
  readonly grade: string;
  readonly count: number;
  readonly percentage: number;
}

export interface GradePeriod {
  readonly fromYear: number;
  readonly toYear: number;
}

export interface GradeOutcomesFields {
  readonly period: Fact<GradePeriod>;
  readonly sampleSize: Fact<number>;
  readonly distribution: Fact<ReadonlyArray<GradeBucket>>;
  readonly failureRatePercent: Fact<number>;
  readonly averageGrade: Fact<string>;
  readonly medianGrade: Fact<string>;
  readonly evidence: ReadonlyArray<EncodedEvidence>;
  readonly sourceStatuses: ReadonlyArray<EncodedSourceStatus>;
}

const DBH_ENDPOINT = 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData';
const ORDINAL_SCALE: Readonly<Record<string, number>> = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5 };
const AVERAGE_SCALE: Readonly<Record<string, number>> = { E: 1, D: 2, C: 3, B: 4, A: 5 };
const ASSESSED_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
const FAIL_GRADES = new Set(['F', 'H']);
const DISPLAY_ORDER: Readonly<Record<string, number>> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
};

const numericToLetter = (value: number): string => {
  const rounded = Math.min(5, Math.max(0, Math.round(value)));
  return (['F', 'E', 'D', 'C', 'B', 'A'] as const)[rounded] as string;
};

const bucketsToPercentaged = (counts: ReadonlyMap<string, number>): GradeBucket[] => {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort(
      ([left], [right]) =>
        (DISPLAY_ORDER[left] ?? Number.MAX_SAFE_INTEGER) -
        (DISPLAY_ORDER[right] ?? Number.MAX_SAFE_INTEGER),
    )
    .map(([grade, count]) => ({
      grade,
      count,
      percentage: total > 0 ? Math.round((10000 * count) / total) / 100 : 0,
    }));
};

const medianFromDistribution = (buckets: ReadonlyArray<GradeBucket>): string | null => {
  let assessedCount = 0;
  for (const bucket of buckets) {
    if (ORDINAL_SCALE[bucket.grade] !== undefined) assessedCount += bucket.count;
  }
  if (assessedCount === 0) return null;

  const middle = Math.floor((assessedCount - 1) / 2);
  let cumulative = 0;
  for (const grade of ['F', 'E', 'D', 'C', 'B', 'A'] as const) {
    cumulative += buckets.find((bucket) => bucket.grade === grade)?.count ?? 0;
    if (cumulative > middle) return grade;
  }
  return null;
};

const unavailableOutcomes = (
  reason: string,
  sourceStatus: EncodedSourceStatus,
): GradeOutcomesFields => ({
  period: unavailable(reason),
  sampleSize: unavailable(reason),
  distribution: unavailable(reason),
  failureRatePercent: unavailable(reason),
  averageGrade: unavailable(reason),
  medianGrade: unavailable(reason),
  evidence: [],
  sourceStatuses: [sourceStatus],
});

/** Maps official DBH table-308 buckets into the provider-neutral grade facts. */
export const mapGradesToOutcomes = (
  courseCode: string,
  dbh: ValidatedDbhCourseGrades | null,
  sourceObservation?: { readonly observedAt: string; readonly rejectedRows: number },
): GradeOutcomesFields => {
  if (dbh === null) {
    const available = sourceObservation !== undefined;
    const reason = available
      ? 'DBH/HK-dir table 308 returned no assessed grade rows for this course.'
      : 'DBH/HK-dir grade outcomes could not be retrieved.';
    return unavailableOutcomes(reason, {
      provider: 'dbh-table-308',
      status: available ? 'unavailable' : 'failed',
      observedAt: sourceObservation?.observedAt ?? null,
      warning: available ? reason : 'DBH/HK-dir table-308 request failed or was unreachable.',
    });
  }

  const assessedRows = dbh.rows.filter((row) => ASSESSED_GRADES.has(row.grade));
  const observedYears = assessedRows.map((row) => row.year);
  const observedPeriod =
    observedYears.length === 0
      ? dbh.attribution.period
      : {
          fromYear: Math.min(...observedYears),
          toYear: Math.max(...observedYears),
        };
  const evidenceId = `evidence:${dbh.sourceRecordId}`;
  const evidence: EncodedEvidence = {
    id: evidenceId,
    provider: dbh.attribution.provider,
    kind: dbh.attribution.evidenceKind,
    recordId: dbh.sourceRecordId,
    sourceUrl: DBH_ENDPOINT,
    sourcePeriod: `${observedPeriod.fromYear}-${observedPeriod.toYear}`,
    observedAt: dbh.attribution.retrievedAt,
    excerpt: null,
    inferenceRule: null,
  };
  const sourceStatus = (status: 'available' | 'unavailable', warning: string | null) => ({
    provider: 'dbh-table-308',
    status,
    observedAt: dbh.attribution.retrievedAt,
    warning,
  });
  const rejectedWarning =
    sourceObservation !== undefined && sourceObservation.rejectedRows > 0
      ? `${sourceObservation.rejectedRows} malformed or out-of-scope DBH table-308 row(s) were excluded.`
      : null;

  if (assessedRows.length === 0) {
    const reason = 'DBH/HK-dir table 308 returned no assessed grade rows for this course.';
    return {
      ...unavailableOutcomes(reason, sourceStatus('unavailable', reason)),
      evidence: [evidence],
    };
  }

  const period = known(observedPeriod, [evidenceId]);
  if (assessedRows.some((row) => row.candidateCount === 0)) {
    const reason =
      'DBH/HK-dir returned a privacy-protected zero candidate count for an assessed grade bucket in this period.';
    return {
      period,
      sampleSize: suppressed(reason, [evidenceId]),
      distribution: suppressed(reason, [evidenceId]),
      failureRatePercent: suppressed(reason, [evidenceId]),
      averageGrade: suppressed(reason, [evidenceId]),
      medianGrade: suppressed(reason, [evidenceId]),
      evidence: [evidence],
      sourceStatuses: [sourceStatus('available', reason)],
    };
  }

  const counts = new Map<string, number>();
  let sampleSize = 0;
  let failures = 0;
  let weightedSum = 0;
  let weightedCount = 0;
  for (const row of assessedRows) {
    counts.set(row.grade, (counts.get(row.grade) ?? 0) + row.candidateCount);
    sampleSize += row.candidateCount;
    if (FAIL_GRADES.has(row.grade)) failures += row.candidateCount;
    const scaleValue = AVERAGE_SCALE[row.grade];
    if (scaleValue !== undefined) {
      weightedSum += scaleValue * row.candidateCount;
      weightedCount += row.candidateCount;
    }
  }
  const distribution = bucketsToPercentaged(counts);
  const median = medianFromDistribution(distribution);
  const inferenceEvidenceId = `evidence:grade-outcomes-inference:${courseCode}`;
  const inferenceEvidence: EncodedEvidence = {
    id: inferenceEvidenceId,
    provider: 'course-data-grades',
    kind: 'inference',
    recordId: `grade-outcomes:${courseCode}`,
    sourceUrl: null,
    sourcePeriod: null,
    observedAt: dbh.attribution.retrievedAt,
    excerpt: null,
    inferenceRule:
      'Average uses A=5 through E=1 and excludes F/G/H; median uses the ordinal F-through-A distribution and excludes G/H.',
  };

  return {
    period,
    sampleSize: known(sampleSize, [evidenceId]),
    distribution: known(distribution, [evidenceId]),
    failureRatePercent: known(Math.round((10000 * failures) / sampleSize) / 100, [evidenceId]),
    averageGrade:
      weightedCount === 0
        ? unavailable('DBH/HK-dir exposed no A-E outcomes from which to derive an average grade.')
        : known(numericToLetter(weightedSum / weightedCount), [evidenceId, inferenceEvidenceId]),
    medianGrade:
      median === null
        ? unavailable(
            'DBH/HK-dir exposed no letter-scale distribution from which to derive a median grade.',
          )
        : known(median, [evidenceId, inferenceEvidenceId]),
    evidence: [evidence, inferenceEvidence],
    sourceStatuses: [sourceStatus('available', rejectedWarning)],
  };
};
