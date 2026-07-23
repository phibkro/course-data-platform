import { known, unavailable, type Fact } from '@course-data/course-model';

import type { ValidatedDbhGrades } from './dbh-grades';
import type { ValidatedGradesNoPeriod } from './grades-no';

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

export interface GradeWindow {
  readonly fromYear: number;
  readonly toYear: number;
  readonly semesters: ReadonlyArray<'AUTUMN' | 'SPRING'>;
  readonly minimumCohortSize: number;
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

const aggregateGradesNo = (
  periods: ReadonlyArray<ValidatedGradesNoPeriod>,
  window: GradeWindow,
): Aggregate | null => {
  // SUMMER records represent resits/special examinations rather than the
  // ordinary teaching term. Keep them validated at the boundary, but do not
  // silently mix them into the primary-course outcome summary.
  const primaryPeriods = periods.filter(
    (period) =>
      (period.semester === 'AUTUMN' || period.semester === 'SPRING') &&
      window.semesters.includes(period.semester) &&
      period.year >= window.fromYear &&
      period.year <= window.toYear &&
      period.attendeeCount >= window.minimumCohortSize,
  );
  if (primaryPeriods.length === 0) return null;

  const counts = new Map<string, number>([
    ['A', 0],
    ['B', 0],
    ['C', 0],
    ['D', 0],
    ['E', 0],
    ['F', 0],
  ]);
  let passedOnly = 0;
  let failedOnly = 0;
  let sampleSize = 0;
  const years = primaryPeriods.map((period) => period.year);

  for (const period of primaryPeriods) {
    if (period.passedCount !== null) {
      passedOnly += period.passedCount;
      failedOnly += period.letterCounts.f;
    } else {
      counts.set('A', (counts.get('A') ?? 0) + period.letterCounts.a);
      counts.set('B', (counts.get('B') ?? 0) + period.letterCounts.b);
      counts.set('C', (counts.get('C') ?? 0) + period.letterCounts.c);
      counts.set('D', (counts.get('D') ?? 0) + period.letterCounts.d);
      counts.set('E', (counts.get('E') ?? 0) + period.letterCounts.e);
      counts.set('F', (counts.get('F') ?? 0) + period.letterCounts.f);
    }
    sampleSize += period.attendeeCount;
  }
  if (passedOnly > 0) counts.set('G', passedOnly);
  if (failedOnly > 0) counts.set('H', failedOnly);

  const fails = (counts.get('F') ?? 0) + (counts.get('H') ?? 0);
  const failureDenominator = sampleSize;
  const failureRatePercent =
    failureDenominator > 0 ? Math.round((10000 * fails) / failureDenominator) / 100 : 0;

  return {
    period: { fromYear: Math.min(...years), toYear: Math.max(...years) },
    sampleSize,
    distribution: bucketsToPercentaged(counts),
    failureRatePercent,
    averageGrade: (() => {
      const weightedSum = [...counts.entries()].reduce(
        (sum, [grade, count]) => sum + (AVERAGE_SCALE[grade] ?? 0) * count,
        0,
      );
      const weightedCount = [...counts.entries()].reduce(
        (sum, [grade, count]) => sum + (AVERAGE_SCALE[grade] === undefined ? 0 : count),
        0,
      );
      return weightedCount > 0 ? numericToLetter(weightedSum / weightedCount) : null;
    })(),
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
    if (scaleValue !== undefined)
      numericValues.push({ value: scaleValue, count: row.candidateCount });
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

const distributionsMateriallyDisagree = (a: Aggregate, b: Aggregate): boolean => {
  const aPercentages = new Map(a.distribution.map((bucket) => [bucket.grade, bucket.percentage]));
  const bPercentages = new Map(b.distribution.map((bucket) => [bucket.grade, bucket.percentage]));
  const grades = new Set([...aPercentages.keys(), ...bPercentages.keys()]);
  return [...grades].some(
    (grade) => Math.abs((aPercentages.get(grade) ?? 0) - (bPercentages.get(grade) ?? 0)) > 5,
  );
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
  window: GradeWindow,
): GradeOutcomesFields => {
  const evidence: EncodedEvidence[] = [];
  const sourceStatuses: EncodedSourceStatus[] = [];

  const gradesNoAggregate =
    gradesNo !== null && gradesNo.length > 0 ? aggregateGradesNo(gradesNo, window) : null;
  const dbhInWindow =
    dbh !== null &&
    dbh.attribution.period.fromYear === window.fromYear &&
    dbh.attribution.period.toYear === window.toYear;
  const dbhAggregate = dbhInWindow && dbh.rows.length > 0 ? aggregateDbh(dbh) : null;

  let gradesNoEvidenceId: string | null = null;
  if (gradesNo !== null) {
    const excludedPeriods = gradesNo.filter(
      (period) =>
        period.semester === 'SUMMER' ||
        !window.semesters.includes(period.semester) ||
        period.year < window.fromYear ||
        period.year > window.toYear ||
        period.attendeeCount < window.minimumCohortSize,
    ).length;
    sourceStatuses.push({
      provider: 'grades-no',
      status: gradesNoAggregate !== null ? 'available' : 'unavailable',
      observedAt: gradesNo[0]?.attribution.retrievedAt ?? null,
      warning:
        gradesNoAggregate === null
          ? 'grades.no returned no ordinary autumn or spring grade periods for this course.'
          : excludedPeriods > 0
            ? `${excludedPeriods} period(s) outside the selected ordinary-term window or cohort threshold were excluded.`
            : null,
    });
    if (gradesNoAggregate !== null && gradesNo[0]) {
      gradesNoEvidenceId = `evidence:grades-no:${courseCode}`;
      evidence.push({
        id: gradesNoEvidenceId,
        provider: 'grades-no',
        kind: gradesNo[0].attribution.evidenceKind,
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
      warning:
        dbhAggregate === null
          ? dbhInWindow
            ? 'DBH table 308 returned no grade rows for this course.'
            : 'DBH table 308 did not cover the requested grade window.'
          : null,
    });
    if (dbhAggregate !== null) {
      dbhEvidenceId = `evidence:${dbh.sourceRecordId}`;
      evidence.push({
        id: dbhEvidenceId,
        provider: 'dbh',
        kind: dbh.attribution.evidenceKind,
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
      'Average uses A=5 through E=1 and excludes F/G/H; median uses the ordinal F-through-A distribution and excludes G/H.',
  });

  const canonical = gradesNoAggregate ?? dbhAggregate;
  if (!canonical) throw new Error('unreachable: at least one aggregate is present');
  const canonicalEvidenceId = gradesNoAggregate !== null ? gradesNoEvidenceId : dbhEvidenceId;
  if (canonicalEvidenceId === null) {
    throw new Error('unreachable: the canonical grade aggregate must have source evidence');
  }
  const median = medianFromDistribution(canonical.distribution);

  if (
    gradesNoAggregate !== null &&
    gradesNoEvidenceId !== null &&
    dbhAggregate !== null &&
    dbhEvidenceId !== null
  ) {
    const conflicting = <A>(
      reason: string,
      gradesNoValue: A,
      dbhValue: A,
      derived = false,
    ): Fact<A> => {
      const gradesNoIds = derived
        ? ([gradesNoEvidenceId, inferenceEvidenceId] as const)
        : ([gradesNoEvidenceId] as const);
      const dbhIds = derived
        ? ([dbhEvidenceId, inferenceEvidenceId] as const)
        : ([dbhEvidenceId] as const);
      return {
        state: 'conflicting',
        reason,
        candidates: [
          { value: gradesNoValue, evidenceIds: gradesNoIds },
          { value: dbhValue, evidenceIds: dbhIds },
        ],
        evidenceIds: [gradesNoEvidenceId, dbhEvidenceId],
      };
    };
    const samePeriod =
      gradesNoAggregate.period.fromYear === dbhAggregate.period.fromYear &&
      gradesNoAggregate.period.toYear === dbhAggregate.period.toYear;
    const sampleDelta =
      Math.max(gradesNoAggregate.sampleSize, dbhAggregate.sampleSize) > 0
        ? Math.abs(gradesNoAggregate.sampleSize - dbhAggregate.sampleSize) /
          Math.max(gradesNoAggregate.sampleSize, dbhAggregate.sampleSize)
        : 0;
    const dbhMedian = medianFromDistribution(dbhAggregate.distribution);
    const averageGrade: Fact<string> =
      gradesNoAggregate.averageGrade === null
        ? dbhAggregate.averageGrade === null
          ? unavailable('The available provider(s) do not expose a supported average grade.')
          : known(dbhAggregate.averageGrade, [dbhEvidenceId, inferenceEvidenceId])
        : dbhAggregate.averageGrade === null
          ? known(gradesNoAggregate.averageGrade, [gradesNoEvidenceId, inferenceEvidenceId])
          : gradesNoAggregate.averageGrade !== dbhAggregate.averageGrade
            ? conflicting(
                'grades.no and DBH imply different average letter grades.',
                gradesNoAggregate.averageGrade,
                dbhAggregate.averageGrade,
                true,
              )
            : known(gradesNoAggregate.averageGrade, [
                gradesNoEvidenceId,
                dbhEvidenceId,
                inferenceEvidenceId,
              ]);
    const medianGrade: Fact<string> =
      median === null
        ? dbhMedian === null
          ? unavailable(
              'The available provider(s) do not expose a letter-scale distribution to compute a median.',
            )
          : known(dbhMedian, [dbhEvidenceId, inferenceEvidenceId])
        : dbhMedian === null
          ? known(median, [gradesNoEvidenceId, inferenceEvidenceId])
          : median !== dbhMedian
            ? conflicting(
                'grades.no and DBH imply different median letter grades.',
                median,
                dbhMedian,
                true,
              )
            : known(median, [gradesNoEvidenceId, dbhEvidenceId, inferenceEvidenceId]);

    return {
      period: samePeriod
        ? known(gradesNoAggregate.period, [gradesNoEvidenceId])
        : conflicting(
            'grades.no and DBH cover different year windows.',
            gradesNoAggregate.period,
            dbhAggregate.period,
          ),
      sampleSize:
        samePeriod && sampleDelta <= 0.1
          ? known(gradesNoAggregate.sampleSize, [gradesNoEvidenceId])
          : conflicting(
              'grades.no and DBH report candidate counts for different windows or materially different samples.',
              gradesNoAggregate.sampleSize,
              dbhAggregate.sampleSize,
            ),
      distribution: distributionsMateriallyDisagree(gradesNoAggregate, dbhAggregate)
        ? conflicting(
            'grades.no and DBH report materially different grade distributions.',
            gradesNoAggregate.distribution,
            dbhAggregate.distribution,
          )
        : known(gradesNoAggregate.distribution, [gradesNoEvidenceId]),
      failureRatePercent:
        Math.abs(gradesNoAggregate.failureRatePercent - dbhAggregate.failureRatePercent) > 5
          ? conflicting(
              'grades.no and DBH report materially different failure rates.',
              gradesNoAggregate.failureRatePercent,
              dbhAggregate.failureRatePercent,
            )
          : known(gradesNoAggregate.failureRatePercent, [gradesNoEvidenceId]),
      averageGrade,
      medianGrade,
      evidence,
      sourceStatuses,
    };
  }

  return {
    period: known(canonical.period, [canonicalEvidenceId]),
    sampleSize: known(canonical.sampleSize, [canonicalEvidenceId]),
    distribution: known(canonical.distribution, [canonicalEvidenceId]),
    failureRatePercent: known(canonical.failureRatePercent, [canonicalEvidenceId]),
    averageGrade:
      canonical.averageGrade === null
        ? unavailable('The available provider(s) do not expose a numeric or letter grade average.')
        : known(canonical.averageGrade, [canonicalEvidenceId, inferenceEvidenceId]),
    medianGrade:
      median === null
        ? unavailable(
            'The available provider(s) do not expose a letter-scale distribution to compute a median.',
          )
        : known(median, [canonicalEvidenceId, inferenceEvidenceId]),
    evidence,
    sourceStatuses,
  };
};
