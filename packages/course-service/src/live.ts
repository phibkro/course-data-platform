import {
  decodeCourseInsight,
  decodeCourseSearchItem,
  known,
  unknown,
  validateEvidenceReferences,
  type CourseInsight,
  type CourseSearchItem,
  type SourceStatus,
} from '@course-data/course-model';
import {
  fetchDbhGrades,
  fetchGradesNoGrades,
  mapGradesToOutcomes,
  type GradeWindow,
  type ValidatedDbhGrades,
  type ValidatedGradesNoPeriod,
} from '@course-data/source-grades';
import {
  fetchNtnuCourseDetail,
  fetchNtnuCourseSearch,
  mapNtnuToCourseInsightFields,
  type ValidatedNtnuCourseDetail,
  type ValidatedNtnuSearchHit,
} from '@course-data/source-ntnu-course';
import * as Effect from 'effect/Effect';

import {
  CourseInvalidTermError,
  CourseNotFoundError,
  CourseSourcesUnavailableError,
  type CourseDecisionService,
  type CourseInsightInput,
  type CourseSearchInput,
} from './index';

export interface LiveCourseDecisionDependencies {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

export interface LiveCourseDecisionDefaults {
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
  readonly gradeFromYear: number;
  readonly gradeToYear: number;
}

interface ResolvedTerm {
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
}

const resolveTerm = (
  term: string | undefined,
  defaults: LiveCourseDecisionDefaults,
): ResolvedTerm => {
  if (term === undefined) {
    return {
      academicYear: defaults.academicYear,
      season: defaults.season,
    };
  }

  const match = /^(\d{4})-(spring|autumn)$/.exec(term.trim().toLowerCase());
  const academicYear = Number(match?.[1]);
  const season = match?.[2];
  if (
    match === null ||
    !Number.isInteger(academicYear) ||
    academicYear < 2000 ||
    academicYear > 2200 ||
    (season !== 'spring' && season !== 'autumn')
  ) {
    throw new CourseInvalidTermError({
      term,
      message: 'Term must use the form YYYY-spring or YYYY-autumn.',
    });
  }

  return { academicYear, season };
};

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const sourceStatusForSearch = (
  hit: ValidatedNtnuSearchHit | undefined,
  observedAt: Date,
): SourceStatus => ({
  provider: 'ntnu-course-search',
  status: 'available',
  observedAt: hit === undefined ? observedAt : new Date(hit.attribution.retrievedAt),
  warning: null,
});

const campuses = (location: string | null): ReadonlyArray<string> =>
  location === null
    ? []
    : location
        .split(',')
        .map((campus) => campus.trim())
        .filter((campus) => campus.length > 0);

const toSearchItem = (hit: ValidatedNtnuSearchHit): CourseSearchItem => {
  const evidenceId = `evidence:${hit.sourceRecordId}`;
  return decodeCourseSearchItem({
    courseKey: `ntnu:${hit.courseCode}:${hit.academicYear}-${hit.season}`,
    institutionCode: 'NTNU',
    code: hit.courseCode,
    title: known(hit.courseName, [evidenceId]),
    credits: unknown('Course credits require the NTNU detail page.'),
    level: unknown('The NTNU search response does not expose course level.'),
    offerings: known(
      [
        {
          academicYear: hit.academicYear,
          season: hit.season,
          campuses: campuses(hit.location),
          deliveryModes: [],
        },
      ],
      [evidenceId],
    ),
    assessmentSignals: unknown('Assessment forms require the NTNU detail page.'),
    workFormSignals: unknown('Work forms require the NTNU detail page.'),
    enrichment: 'basic',
    evidence: [
      {
        id: evidenceId,
        provider: hit.attribution.provider,
        kind: 'source-fact',
        recordId: hit.sourceRecordId,
        sourceUrl: hit.courseUrl,
        sourcePeriod: `${hit.season}-${hit.academicYear}`,
        observedAt: hit.attribution.retrievedAt,
        excerpt: hit.courseName,
        inferenceRule: null,
      },
    ],
  });
};

const parseFailure = (
  source: string,
  rejection: { readonly message: string } | null | undefined,
): string => rejection?.message ?? `${source} returned no usable records.`;

const assembleInsight = (
  hit: ValidatedNtnuSearchHit,
  detail: ValidatedNtnuCourseDetail | null,
  detailWarning: string | null,
  gradesNo: ReadonlyArray<ValidatedGradesNoPeriod> | null,
  dbh: ValidatedDbhGrades | null,
  gradeWindow: GradeWindow,
): CourseInsight => {
  const courseKey = `ntnu:${hit.courseCode}:${hit.academicYear}-${hit.season}`;
  const ntnu = mapNtnuToCourseInsightFields(courseKey, hit, detail, detailWarning);
  const grades = mapGradesToOutcomes(hit.courseCode, gradesNo, dbh, gradeWindow);
  const insight = decodeCourseInsight({
    ...ntnu,
    gradeOutcomes: {
      period: grades.period,
      sampleSize: grades.sampleSize,
      distribution: grades.distribution,
      failureRatePercent: grades.failureRatePercent,
      averageGrade: grades.averageGrade,
      medianGrade: grades.medianGrade,
    },
    sourceStatuses: [...ntnu.sourceStatuses, ...grades.sourceStatuses],
    evidence: [...ntnu.evidence, ...grades.evidence],
  });

  const missingEvidence = validateEvidenceReferences(insight);
  if (missingEvidence.length > 0) {
    throw new Error(
      `Course insight assembly referenced ${missingEvidence.length} missing evidence record(s).`,
    );
  }
  return insight;
};

export const makeLiveCourseDecisionService = (
  deps: LiveCourseDecisionDependencies,
  defaults: LiveCourseDecisionDefaults,
): CourseDecisionService => {
  const search = (input: CourseSearchInput) =>
    Effect.tryPromise({
      try: async () => {
        const term = resolveTerm(input.term, defaults);
        const result = await fetchNtnuCourseSearch(deps, {
          queryString: input.query.trim(),
          academicYear: term.academicYear,
          season: term.season,
        });
        if (result.rejected.length > 0 && result.accepted.length === 0) {
          throw new Error(result.rejected[0]?.message ?? 'NTNU course search was rejected.');
        }

        const observedAt = deps.now();
        return {
          items: result.accepted.map(toSearchItem),
          sourceStatuses: [sourceStatusForSearch(result.accepted[0], observedAt)],
          exactMatchCode:
            result.accepted.find((hit) => hit.exactMatch)?.courseCode ?? null,
        };
      },
      catch: (cause) =>
        cause instanceof CourseInvalidTermError
          ? cause
          : new CourseSourcesUnavailableError({
              operation: 'search',
              message: errorMessage(cause),
            }),
    });

  const getInsight = (input: CourseInsightInput) =>
    Effect.tryPromise({
      try: async () => {
        const term = resolveTerm(input.term, defaults);
        const courseCode = input.courseCode.trim().toUpperCase();
        const searchResult = await fetchNtnuCourseSearch(deps, {
          queryString: courseCode,
          academicYear: term.academicYear,
          season: term.season,
        });
        if (searchResult.rejected.length > 0 && searchResult.accepted.length === 0) {
          throw new Error(searchResult.rejected[0]?.message ?? 'NTNU course search was rejected.');
        }

        const hit = searchResult.accepted.find(
          (candidate) => candidate.courseCode.toUpperCase() === courseCode,
        );
        if (hit === undefined) {
          throw new CourseNotFoundError({ courseCode });
        }

        const detailRequest = fetchNtnuCourseDetail(
          deps,
          hit.courseCode,
          String(term.academicYear),
        );
        const gradesNoRequest = fetchGradesNoGrades(deps, hit.courseCode);
        const dbhRequest = fetchDbhGrades(
          deps,
          hit.courseCode,
          defaults.gradeFromYear,
          defaults.gradeToYear,
        );
        const [detailSettled, gradesNoSettled, dbhSettled] = await Promise.allSettled([
          detailRequest,
          gradesNoRequest,
          dbhRequest,
        ]);

        const detailResult =
          detailSettled.status === 'fulfilled' ? detailSettled.value : null;
        const detail = detailResult?.accepted ?? null;
        const detailWarning =
          detailSettled.status === 'rejected'
            ? errorMessage(detailSettled.reason)
            : detailResult?.rejected?.message ?? null;

        const gradesNoResult =
          gradesNoSettled.status === 'fulfilled' ? gradesNoSettled.value : null;
        const gradesNo =
          gradesNoResult !== null && gradesNoResult.rejected.length === 0
            ? gradesNoResult.accepted.filter(
                (period) =>
                  period.year >= defaults.gradeFromYear &&
                  period.year <= defaults.gradeToYear,
              )
            : null;

        const dbhResult = dbhSettled.status === 'fulfilled' ? dbhSettled.value : null;
        const dbh = dbhResult?.accepted ?? null;

        const item = assembleInsight(hit, detail, detailWarning, gradesNo, dbh, {
          fromYear: defaults.gradeFromYear,
          toYear: defaults.gradeToYear,
          semesters: ['AUTUMN', 'SPRING'],
          minimumCohortSize: 4,
        });
        return {
          item,
          partial: item.sourceStatuses.some((status) => status.status !== 'available'),
        };
      },
      catch: (cause) => {
        if (cause instanceof CourseNotFoundError || cause instanceof CourseInvalidTermError) {
          return cause;
        }
        return new CourseSourcesUnavailableError({
          operation: 'insight',
          message: errorMessage(cause),
        });
      },
    });

  return { search, getInsight };
};
