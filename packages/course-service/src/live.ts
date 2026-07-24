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
  fetchDbhGradeSummaries,
  fetchDbhGrades,
  fetchGradesNoGrades,
  mapDbhToGradeSummary,
  mapGradesToOutcomes,
  type GradeWindow,
  type ValidatedDbhGrades,
  type ValidatedGradesNoPeriod,
} from '@course-data/source-grades';
import {
  fetchNtnuCourseDetail,
  fetchNtnuCourseSearch,
  mapNtnuDetailToCourseDecisionSignals,
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
  type CourseSearchCampus,
  type CourseSearchInput,
  type CourseSearchLevel,
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

const defaultCampuses: ReadonlyArray<CourseSearchCampus> = ['trondheim', 'gjovik', 'alesund'];
const defaultLevels: ReadonlyArray<CourseSearchLevel> = ['bachelor', 'master', 'phd', 'other'];

const sourceStatusForSearch = (
  hit: ValidatedNtnuSearchHit | undefined,
  observedAt: Date,
  rejectedRows: number,
): SourceStatus => ({
  provider: 'ntnu-course-search',
  status: 'available',
  observedAt: hit === undefined ? observedAt : new Date(hit.attribution.retrievedAt),
  warning:
    rejectedRows === 0 ? null : `${rejectedRows} malformed NTNU catalogue row(s) were excluded.`,
});

const campuses = (location: string | null): ReadonlyArray<string> | null => {
  if (location === null) return null;
  const values = location
    .split(',')
    .map((campus) => campus.trim())
    .filter((campus) => campus.length > 0);
  return values.length === 0 ? null : values;
};

const academicPeriod = (academicYear: number, season: 'spring' | 'autumn'): string =>
  `${academicYear}/${academicYear + 1} · ${season}`;

const mapConcurrent = async <Input, Output>(
  inputs: ReadonlyArray<Input>,
  concurrency: number,
  task: (input: Input) => Promise<Output>,
): Promise<ReadonlyArray<Output>> => {
  const results = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      const input = inputs[index];
      if (input !== undefined) results[index] = await task(input);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, inputs.length) }, async () => worker()),
  );
  return results;
};

const toSearchItem = (hit: ValidatedNtnuSearchHit): CourseSearchItem => {
  const evidenceId = `evidence:${hit.sourceRecordId}`;
  const knownCampuses = campuses(hit.location);
  return decodeCourseSearchItem({
    courseKey: `ntnu:${hit.courseCode}:${hit.academicYear}-${hit.season}`,
    institutionCode: 'NTNU',
    code: hit.courseCode,
    title: known(hit.courseName, [evidenceId]),
    credits: unknown('Course credits require the NTNU detail page.'),
    level: unknown('The NTNU search response does not expose course level.'),
    offerings:
      knownCampuses === null
        ? unknown('The NTNU catalogue did not identify a campus for this offering.')
        : known(
            [
              {
                academicYear: hit.academicYear,
                season: hit.season,
                campuses: knownCampuses,
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
        sourcePeriod: academicPeriod(hit.academicYear, hit.season),
        observedAt: hit.attribution.retrievedAt,
        excerpt: hit.courseName,
        inferenceRule: null,
      },
    ],
  });
};

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
        const queryString = input.query?.trim() ?? '';
        const result = await fetchNtnuCourseSearch(deps, {
          queryString,
          academicYear: term.academicYear,
          season: term.season,
          page: input.page ?? 1,
          sort: input.sort ?? (queryString.length === 0 ? 'title-asc' : 'relevance'),
          campuses: input.campuses ?? defaultCampuses,
          levels: input.levels ?? defaultLevels,
          continuingEducation: input.continuingEducation ?? true,
          open: input.open ?? false,
          english: input.english ?? false,
        });
        if (result.rejected.length > 0 && result.accepted.length === 0) {
          throw new Error(result.rejected[0]?.message ?? 'NTNU course search was rejected.');
        }

        const observedAt = deps.now();
        return {
          items: result.accepted.map(toSearchItem),
          sourceStatuses: [
            sourceStatusForSearch(result.accepted[0], observedAt, result.rejected.length),
          ],
          exactMatchCode: result.accepted.find((hit) => hit.exactMatch)?.courseCode ?? null,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
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
          page: 1,
          sort: 'relevance',
          campuses: defaultCampuses,
          levels: defaultLevels,
          continuingEducation: true,
          open: false,
          english: false,
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

        const detailResult = detailSettled.status === 'fulfilled' ? detailSettled.value : null;
        const detail = detailResult?.accepted ?? null;
        const detailWarning =
          detailSettled.status === 'rejected'
            ? errorMessage(detailSettled.reason)
            : (detailResult?.rejected?.message ?? null);

        const gradesNoResult =
          gradesNoSettled.status === 'fulfilled' ? gradesNoSettled.value : null;
        const gradesNo =
          gradesNoResult !== null && gradesNoResult.rejected.length === 0
            ? gradesNoResult.accepted.filter(
                (period) =>
                  period.year >= defaults.gradeFromYear && period.year <= defaults.gradeToYear,
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

  const getGradeSummaries = (input: { readonly courseCodes: ReadonlyArray<string> }) =>
    Effect.tryPromise({
      try: async () => {
        const courseCodes = [
          ...new Set(input.courseCodes.map((courseCode) => courseCode.trim().toUpperCase())),
        ];
        const result = await fetchDbhGradeSummaries(
          deps,
          courseCodes,
          defaults.gradeFromYear,
          defaults.gradeToYear,
        );
        if (result.rejected.length > 0 && result.accepted.length === 0) {
          throw new Error(
            result.rejected[0]?.message ?? 'DBH grade-summary response was rejected.',
          );
        }

        const byCourseCode = new Map(
          result.accepted.map((grades) => [grades.courseCode, grades] as const),
        );
        return {
          items: courseCodes.map((courseCode) =>
            mapDbhToGradeSummary(courseCode, byCourseCode.get(courseCode) ?? null),
          ),
          sourceStatuses: [
            {
              provider: 'dbh',
              status:
                result.accepted.length === 0 ? ('unavailable' as const) : ('available' as const),
              observedAt: deps.now(),
              warning:
                result.rejected.length === 0
                  ? null
                  : `${result.rejected.length} malformed DBH grade row(s) were excluded.`,
            },
          ],
          fromYear: defaults.gradeFromYear,
          toYear: defaults.gradeToYear,
        };
      },
      catch: (cause) =>
        new CourseSourcesUnavailableError({
          operation: 'grade-summaries',
          message: errorMessage(cause),
        }),
    });

  const getDecisionSignals = (input: {
    readonly courseCodes: ReadonlyArray<string>;
    readonly term?: string;
  }) =>
    Effect.tryPromise({
      try: async () => {
        const term = resolveTerm(input.term, defaults);
        const courseCodes = [
          ...new Set(input.courseCodes.map((courseCode) => courseCode.trim().toUpperCase())),
        ];
        const items = await mapConcurrent(courseCodes, 4, async (courseCode) => {
          try {
            const result = await fetchNtnuCourseDetail(deps, courseCode, String(term.academicYear));
            return mapNtnuDetailToCourseDecisionSignals(
              courseCode,
              term.academicYear,
              term.season,
              result.accepted,
              result.rejected?.message ?? null,
            );
          } catch (cause) {
            return mapNtnuDetailToCourseDecisionSignals(
              courseCode,
              term.academicYear,
              term.season,
              null,
              errorMessage(cause),
            );
          }
        });
        return { items };
      },
      catch: (cause) =>
        cause instanceof CourseInvalidTermError
          ? cause
          : new CourseSourcesUnavailableError({
              operation: 'decision-signals',
              message: errorMessage(cause),
            }),
    });

  return { search, getInsight, getGradeSummaries, getDecisionSignals };
};
