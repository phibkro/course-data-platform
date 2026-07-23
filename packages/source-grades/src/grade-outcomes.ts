import { known, unavailable, unknown, type Fact } from '@course-data/course-model';

import type { ValidatedDbhGrades } from './dbh-grades.ts';
import type { ValidatedGradesNoPeriod } from './grades-no.ts';

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

// Ordinal rank scale (F..A) used for the median, which is a rank statistic
// and legitimately includes fails. G (Bestått) and H (Ikke bestått) are
// pass/fail outcomes with no place on this ordinal scale and are excluded.
const ORDINAL_SCALE: Readonly<Record<string, number>> = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5 };
// Per DBH documentation, the letter-grade average is computed only over
// A-E; F (and the pass/fail codes G/H) are excluded from the average.
const AVERAGE_SCALE: Readonly<Record<string, number>> = { E: 1, D: 2, C: 3, B: 4, A: 5 };
// DBH: G = Bestått (pass, non-graded), H = Ikke bestått (fail, non-graded).
const FAIL_CODES = new Set(['F', 'H']);
const numericToLetter = (value: number): string => {
  const rounded = Math.min(5, Math.max(0, Math.round(value)));
  return (['F', 'E', 'D', 'C', 'B', 'A'] as const)[rounded] as string;
};

const bucketsToPercentaged = (counts: ReadonlyMap<string, number>): GradeBucket[] => {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([grade, count]) => ({
      grade,
      count,
      percentage: total > 0 ? Math.round((10000 * count) / total) / 100 : 0,
    }));
};

const medianFromDistribution = (buckets: ReadonlyArray<GradeBucket>): string | null => {
  const expanded: number[] = [];
  for (const bucket of buckets) {
    const value = ORDINAL_SCALE[bucket.grade];
    if (value === undefined) continue; // skip non-ordinal codes (e.g. G/H pass/fail)
    for (let i = 0; i < bucket.count; i += 1) expanded.push(value);
  }
  if (expanded.length === 0) return null;
  expanded.sort((a, b) => a - b);
  const middle = expanded[Math.floor((expanded.length - 1) / 2)];
  return middle === undefined ? null : numericToLetter(middle);
};

interface Aggregate {
  readonly period: GradePeriod;
  readonly sampleSize: number;
  readonly distribution: ReadonlyArray<GradeBucket>;
  readonly failureRatePercent: number;
  readonly averageGrade: string | null;
}

const aggregateGradesNo = (periods: ReadonlyArray<ValidatedGradesNoPeriod>): Aggregate => {
  const counts = new Map<string, number>([
    ['A', 0],
    ['B', 0],
    ['C', 0],
    ['D', 0],
    ['E', 0],
    ['F', 0],
  ]);
  let passedOnly = 0;
  let sampleSize = 0;
  const weightedAverages: number[] = [];
  const years = periods.map((period) => period.year);

  for (const period of periods) {
    counts.set('A', (counts.get('A') ?? 0) + period.letterCounts.a);
    counts.set('B', (counts.get('B') ?? 0) + period.letterCounts.b);
    counts.set('C', (counts.get('C') ?? 0) + period.letterCounts.c);
    counts.set('D', (counts.get('D') ?? 0) + period.letterCounts.d);
    counts.set('E', (counts.get('E') ?? 0) + period.letterCounts.e);
    counts.set('F', (counts.get('F') ?? 0) + period.letterCounts.f);
    if (period.passedCount !== null) passedOnly += period.passedCount;
    sampleSize += period.attendeeCount;
    if (period.averageGrade !== null) weightedAverages.push(period.averageGrade);
  }
  if (passedOnly > 0) counts.set('Bestått', passedOnly);

  const graded = [...counts.entries()]
    .filter(([grade]) => grade !== 'Bestått')
    .reduce((sum, [, count]) => sum + count, 0);
  const fails = counts.get('F') ?? 0;
  const failureDenominator = graded > 0 ? graded : sampleSize;
  const failureRatePercent =
    failureDenominator > 0 ? Math.round((10000 * fails) / failureDenominator) / 100 : 0;

  return {
    period: { fromYear: Math.min(...years), toYear: Math.max(...years) },
    sampleSize,
    distribution: bucketsToPercentaged(counts),
    failureRatePercent,
    averageGrade:
      weightedAverages.length > 0
        ? numericToLetter(weightedAverages.reduce((a, b) => a + b, 0) / weightedAverages.length)
        : null,
  };
};

const aggregateDbh = (dbh: ValidatedDbhGrades): Aggregate => {
  const counts = new Map<string, number>();
  let sampleSize = 0;
  let fails = 0;
  const numericValues: Array<{ readonly value: number; readonly count: number }> = [];

  for (const row of dbh.rows) {
    counts.set(row.grade, (counts.get(row.grade) ?? 0) + row.candidateCount);
    sampleSize += row.candidateCount;
    if (FAIL_CODES.has(row.grade)) fails += row.candidateCount;
    const scaleValue = AVERAGE_SCALE[row.grade];
    if (scaleValue !== undefined) numericValues.push({ value: scaleValue, count: row.candidateCount });
  }

  const weightedSum = numericValues.reduce((sum, entry) => sum + entry.value * entry.count, 0);
  const weightedCount = numericValues.reduce((sum, entry) => sum + entry.count, 0);

  return {
    period: dbh.attribution.period,
    sampleSize,
    distribution: bucketsToPercentaged(counts),
    failureRatePercent: sampleSize > 0 ? Math.round((10000 * fails) / sampleSize) / 100 : 0,
    averageGrade: weightedCount > 0 ? numericToLetter(weightedSum / weightedCount) : null,
  };
};

const materiallyDisagree = (a: Aggregate, b: Aggregate): boolean => {
  const failureDelta = Math.abs(a.failureRatePercent - b.failureRatePercent);
  const sampleDelta =
    Math.max(a.sampleSize, b.sampleSize) > 0
      ? Math.abs(a.sampleSize - b.sampleSize) / Math.max(a.sampleSize, b.sampleSize)
      : 0;
  return failureDelta > 5 || sampleDelta > 0.1;
};

/**
 * Pure combinator: maps optional grades.no and DBH/HK-dir grade evidence
 * into the GradeOutcomes fact-shape owned by CourseInsight. Either provider
 * may be `null` to represent an independent source failure; the other
 * provider's facts remain known (see AGENTS.md: a source failure must not
 * erase independently available course information). When both providers
 * are present and materially disagree, the affected facts become
 * `conflicting` instead of silently picking one value.
 */
export const mapGradesToOutcomes = (
  courseCode: string,
  gradesNo: ReadonlyArray<ValidatedGradesNoPeriod> | null,
  dbh: ValidatedDbhGrades | null,
): GradeOutcomesFields => {
  const evidence: EncodedEvidence[] = [];
  const sourceStatuses: EncodedSourceStatus[] = [];

  const gradesNoAggregate =
    gradesNo !== null && gradesNo.length > 0 ? aggregateGradesNo(gradesNo) : null;
  const dbhAggregate = dbh !== null && dbh.rows.length > 0 ? aggregateDbh(dbh) : null;

  let gradesNoEvidenceId: string | null = null;
  if (gradesNo !== null) {
    sourceStatuses.push({
      provider: 'grades-no',
      status: gradesNoAggregate !== null ? 'available' : 'unavailable',
      observedAt: gradesNo[0]?.attribution.retrievedAt ?? null,
      warning: gradesNoAggregate === null ? 'grades.no returned no grade periods for this course.' : null,
    });
    if (gradesNoAggregate !== null && gradesNo[0]) {
      gradesNoEvidenceId = `evidence:grades-no:${courseCode}`;
      evidence.push({
        id: gradesNoEvidenceId,
        provider: 'grades-no',
        kind: 'source-fact',
        recordId: `grades-no:${courseCode}`,
        sourceUrl: gradesNo[0].attribution.requestUrl,
        sourcePeriod: `${gradesNoAggregate.period.fromYear}-${gradesNoAggregate.period.toYear}`,
        observedAt: gradesNo[0].attribution.retrievedAt,
        excerpt: null,
        inferenceRule: null,
      });
    }
  } else {
    sourceStatuses.push({
      provider: 'grades-no',
      status: 'failed',
      observedAt: null,
      warning: 'grades.no request failed or was unreachable.',
    });
  }

  let dbhEvidenceId: string | null = null;
  if (dbh !== null) {
    sourceStatuses.push({
      provider: 'dbh',
      status: dbhAggregate !== null ? 'available' : 'unavailable',
      observedAt: dbh.attribution.retrievedAt,
      warning: dbhAggregate === null ? 'DBH table 308 returned no grade rows for this course.' : null,
    });
    if (dbhAggregate !== null) {
      dbhEvidenceId = `evidence:${dbh.sourceRecordId}`;
      evidence.push({
        id: dbhEvidenceId,
        provider: 'dbh',
        kind: 'source-fact',
        recordId: dbh.sourceRecordId,
        sourceUrl: null,
        sourcePeriod: `${dbhAggregate.period.fromYear}-${dbhAggregate.period.toYear}`,
        observedAt: dbh.attribution.retrievedAt,
        excerpt: null,
        inferenceRule: null,
      });
    }
  } else {
    sourceStatuses.push({
      provider: 'dbh',
      status: 'failed',
      observedAt: null,
      warning: 'DBH/HK-dir table-308 request failed or was unreachable.',
    });
  }

  if (gradesNoAggregate === null && dbhAggregate === null) {
    const reason = 'Neither grades.no nor DBH/HK-dir exposed grade evidence for this course.';
    return {
      period: unavailable(reason),
      sampleSize: unavailable(reason),
      distribution: unavailable(reason),
      failureRatePercent: unavailable(reason),
      averageGrade: unavailable(reason),
      medianGrade: unavailable(reason),
      evidence,
      sourceStatuses,
    };
  }

  const inferenceEvidenceId = `evidence:grade-outcomes-inference:${courseCode}`;
  const evidenceIdsUsed = [gradesNoEvidenceId, dbhEvidenceId].filter((id): id is string => id !== null);
  evidence.push({
    id: inferenceEvidenceId,
    provider: 'course-data-grades',
    kind: 'inference',
    recordId: `grade-outcomes:${courseCode}`,
    sourceUrl: null,
    sourcePeriod: null,
    observedAt: dbh?.attribution.retrievedAt ?? gradesNo?.[0]?.attribution.retrievedAt ?? '',
    excerpt: null,
    inferenceRule:
      'Average/median letter grade rounded from the numeric scale (F=0..A=5) over the chosen distribution.',
  });

  if (gradesNoAggregate !== null && dbhAggregate !== null) {
    if (materiallyDisagree(gradesNoAggregate, dbhAggregate)) {
      const conflicting = <A>(
        reason: string,
        candidates: ReadonlyArray<{ readonly value: A; readonly evidenceIds: readonly [string, ...string[]] }>,
      ): Fact<A> => ({ state: 'conflicting', reason, candidates, evidenceIds: evidenceIdsUsed });

      return {
        period: conflicting('grades.no and DBH cover different or non-overlapping year windows.', [
          { value: gradesNoAggregate.period, evidenceIds: [gradesNoEvidenceId as string] },
          { value: dbhAggregate.period, evidenceIds: [dbhEvidenceId as string] },
        ]),
        sampleSize: conflicting('grades.no and DBH report materially different candidate counts.', [
          { value: gradesNoAggregate.sampleSize, evidenceIds: [gradesNoEvidenceId as string] },
          { value: dbhAggregate.sampleSize, evidenceIds: [dbhEvidenceId as string] },
        ]),
        distribution: conflicting('grades.no and DBH report materially different grade distributions.', [
          { value: gradesNoAggregate.distribution, evidenceIds: [gradesNoEvidenceId as string] },
          { value: dbhAggregate.distribution, evidenceIds: [dbhEvidenceId as string] },
        ]),
        failureRatePercent: conflicting('grades.no and DBH report materially different failure rates.', [
          { value: gradesNoAggregate.failureRatePercent, evidenceIds: [gradesNoEvidenceId as string] },
          { value: dbhAggregate.failureRatePercent, evidenceIds: [dbhEvidenceId as string] },
        ]),
        averageGrade: unknown('Average grade is not computed while the underlying distribution conflicts.'),
        medianGrade: unknown('Median grade is not computed while the underlying distribution conflicts.'),
        evidence,
        sourceStatuses,
      };
    }
  }

  const canonical = gradesNoAggregate ?? dbhAggregate;
  if (!canonical) throw new Error('unreachable: at least one aggregate is present');
  const median = medianFromDistribution(canonical.distribution);

  return {
    period: known(canonical.period, evidenceIdsUsed as [string, ...string[]]),
    sampleSize: known(canonical.sampleSize, evidenceIdsUsed as [string, ...string[]]),
    distribution: known(canonical.distribution, evidenceIdsUsed as [string, ...string[]]),
    failureRatePercent: known(canonical.failureRatePercent, evidenceIdsUsed as [string, ...string[]]),
    averageGrade:
      canonical.averageGrade === null
        ? unavailable('The available provider(s) do not expose a numeric or letter grade average.')
        : known(canonical.averageGrade, [inferenceEvidenceId]),
    medianGrade:
      median === null
        ? unavailable('The available provider(s) do not expose a letter-scale distribution to compute a median.')
        : known(median, [inferenceEvidenceId]),
    evidence,
    sourceStatuses,
  };
};
