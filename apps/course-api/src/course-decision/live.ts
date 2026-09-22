import {
  decodeCourseInsight,
  decodeCourseSearchItem,
  known,
  unknown,
  type CourseInsight,
  type CourseSearchItem,
  type SourceStatus,
} from './model/course-insight';
import {
  fetchDbhExamOutcomes,
  fetchDbhGradeSummaries,
  mapDbhToExamParticipation,
  mapDbhToGradeSummary,
  mapGradesToOutcomes,
  type DbhExamOutcomesParseResult,
  type DbhGradeSummariesParseResult,
  type ValidatedDbhCourseGrades,
  type ValidatedDbhExamOutcomes,
} from '../sources/grades';
import {
  fetchNtnuCourseDetail,
  fetchNtnuCourseSchedule,
  fetchNtnuCourseSearch,
  mapNtnuDetailToCourseDecisionSignals,
  mapNtnuToCourseInsightFields,
  type NtnuDetailParseResult,
  type NtnuScheduleParseResult,
  type NtnuSearchParseResult,
  type ValidatedNtnuCourseDetail,
  type ValidatedNtnuScheduleOccurrence,
  type ValidatedNtnuSearchHit,
} from '../sources/ntnu';
import * as Effect from 'effect/Effect';
import * as Tracer from 'effect/Tracer';

import {
  CourseInvalidTermError,
  CourseNotFoundError,
  CourseSourcesUnavailableError,
  type CourseDecisionService,
  type CourseInsightInput,
  type CourseScheduleActivityStream,
  type CourseScheduleInput,
  type CourseScheduleItem,
  type CourseScheduleOccurrence,
  type CourseSearchCampus,
  type CourseSearchInput,
  type CourseSearchLevel,
} from './service';

export interface LiveCourseDecisionDependencies {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
  readonly tracer?: Tracer.Tracer;
}

export interface LiveCourseDecisionConfig {
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
  readonly gradeFromYear: number;
  readonly gradeToYear: number;
  readonly sourceRequestTimeoutMs: number;
  readonly sourceCacheTtlMs: number;
  readonly sourceCacheMaxEntriesPerProvider: number;
}

interface ResolvedTerm {
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
}

const resolveTerm = (term: string | undefined, config: LiveCourseDecisionConfig): ResolvedTerm => {
  if (term === undefined) {
    return {
      academicYear: config.academicYear,
      season: config.season,
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

const runWithSourceDeadline = async <Output>(
  deps: LiveCourseDecisionDependencies,
  timeoutMs: number,
  task: (sourceDeps: LiveCourseDecisionDependencies) => Promise<Output>,
) => {
  const controller = new AbortController();
  let sourceHost = 'external source';
  const sourceDeps: LiveCourseDecisionDependencies = {
    ...deps,
    fetch: (url, init) => {
      sourceHost = new URL(url).hostname;
      const upstreamSignal = init?.signal;
      const signal =
        upstreamSignal === undefined || upstreamSignal === null
          ? controller.signal
          : AbortSignal.any([upstreamSignal, controller.signal]);
      return deps.fetch(url, { ...init, signal });
    },
  };
  let cancelTimeout!: () => void;
  const timeout = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`Source request to ${sourceHost} timed out after ${timeoutMs} ms.`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
    cancelTimeout = () => clearTimeout(timeoutId);
  });

  try {
    return await Promise.race([task(sourceDeps), timeout]);
  } finally {
    cancelTimeout();
  }
};

interface CachedSourceResult<Output> {
  readonly expiresAt: number;
  readonly observedAt: Date;
  readonly value: Output;
}

const makeSourceRequestCache = <Output>(
  ttlMs: number,
  maxEntries: number,
  now: () => Date,
  isCacheable: (value: Output) => boolean,
) => {
  const completed = new Map<string, CachedSourceResult<Output>>();
  const inFlight = new Map<string, Promise<CachedSourceResult<Output>>>();

  return async (key: string, load: () => Promise<Output>): Promise<CachedSourceResult<Output>> => {
    const cached = completed.get(key);
    if (cached !== undefined) {
      if (cached.expiresAt > now().getTime()) {
        completed.delete(key);
        completed.set(key, cached);
        return cached;
      }
      completed.delete(key);
    }

    const pending = inFlight.get(key);
    if (pending !== undefined) return pending;

    const request = Promise.resolve()
      .then(load)
      .then((value) => {
        const observedAt = now();
        const result = {
          expiresAt: observedAt.getTime() + ttlMs,
          observedAt,
          value,
        };
        if (isCacheable(value)) {
          completed.set(key, result);
          if (completed.size > maxEntries) {
            const oldestKey = completed.keys().next().value;
            if (oldestKey !== undefined) completed.delete(oldestKey);
          }
        }
        return result;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  };
};

const defaultCampuses: ReadonlyArray<CourseSearchCampus> = ['alesund', 'gjovik', 'trondheim'];
const defaultLevels: ReadonlyArray<CourseSearchLevel> = ['bachelor', 'master', 'other', 'phd'];

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

const osloDateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Oslo',
  year: 'numeric',
});

const osloIsoWeek = (instant: string): number => {
  let day = 0;
  let month = 0;
  let year = 0;
  for (const part of osloDateFormatter.formatToParts(new Date(instant))) {
    if (part.type === 'day') day = Number(part.value);
    if (part.type === 'month') month = Number(part.value);
    if (part.type === 'year') year = Number(part.value);
  }

  const localDate = new Date(Date.UTC(year, month - 1, day));
  const localDayOfWeek = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() + 4 - localDayOfWeek);
  const isoYearStart = new Date(Date.UTC(localDate.getUTCFullYear(), 0, 1));
  return Math.ceil((localDate.getTime() - isoYearStart.getTime() + 86_400_000) / 604_800_000);
};

const combineWarnings = (...warnings: ReadonlyArray<string | null>): string | null => {
  const message = warnings.filter((warning): warning is string => warning !== null).join(' ');
  return message === '' ? null : message;
};

const unavailableScheduleItem = (
  courseCode: string,
  observedAt: Date | null,
  warning: string,
): CourseScheduleItem => ({
  courseCode,
  sourceStatus: {
    provider: 'ntnu-course-schedule',
    status: 'unavailable',
    observedAt,
    warning,
  },
  activityStreams: [],
  occurrences: [],
});

const failedScheduleItem = (
  courseCode: string,
  observedAt: Date | null,
  warning: string,
): CourseScheduleItem => ({
  courseCode,
  sourceStatus: {
    provider: 'ntnu-course-schedule',
    status: 'failed',
    observedAt,
    warning,
  },
  activityStreams: [],
  occurrences: [],
});

const toCourseScheduleOccurrence = (
  occurrence: ValidatedNtnuScheduleOccurrence,
): CourseScheduleOccurrence => ({
  id: occurrence.sourceRecordId,
  courseCode: occurrence.courseCode,
  activityCode: occurrence.activityCode,
  title: occurrence.title,
  summary: occurrence.summary,
  status: occurrence.status,
  startsAt: new Date(occurrence.startsAt),
  endsAt: new Date(occurrence.endsAt),
  rooms: occurrence.rooms.map((room) => ({
    building: room.building,
    room: room.room,
    url: room.url,
  })),
  evidence: {
    provider: occurrence.attribution.provider,
    kind: occurrence.attribution.evidenceKind,
    sourceRecordId: occurrence.attribution.sourceRecordId,
    sourceUrl: occurrence.attribution.requestUrl,
    observedAt: new Date(occurrence.attribution.retrievedAt),
  },
});

const toCourseScheduleActivityStreams = (
  occurrences: ReadonlyArray<ValidatedNtnuScheduleOccurrence>,
): ReadonlyArray<CourseScheduleActivityStream> => {
  const streams = new Map<
    string,
    {
      activityCode: string;
      title: string | null;
      summary: string | null;
      titleConflicted: boolean;
      summaryConflicted: boolean;
    }
  >();

  for (const occurrence of occurrences) {
    const stream = streams.get(occurrence.activityCode);
    if (stream === undefined) {
      streams.set(occurrence.activityCode, {
        activityCode: occurrence.activityCode,
        title: occurrence.title,
        summary: occurrence.summary,
        titleConflicted: false,
        summaryConflicted: false,
      });
      continue;
    }

    if (occurrence.title !== null) {
      if (stream.title === null) stream.title = occurrence.title;
      else if (stream.title !== occurrence.title) stream.titleConflicted = true;
    }
    if (occurrence.summary !== null) {
      if (stream.summary === null) stream.summary = occurrence.summary;
      else if (stream.summary !== occurrence.summary) stream.summaryConflicted = true;
    }
  }

  return Array.from(streams.values(), (stream) => ({
    activityCode: stream.activityCode,
    title: stream.titleConflicted ? null : stream.title,
    summary: stream.summaryConflicted ? null : stream.summary,
  }));
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
  dbh: ValidatedDbhCourseGrades | null,
  dbhObservation: { readonly observedAt: string; readonly rejectedRows: number } | undefined,
  dbhExam: ValidatedDbhExamOutcomes | null,
  dbhExamRejectedRows: number,
): CourseInsight => {
  const courseKey = `ntnu:${hit.courseCode}:${hit.academicYear}-${hit.season}`;
  const ntnu = mapNtnuToCourseInsightFields(courseKey, hit, detail, detailWarning);
  const grades = mapGradesToOutcomes(hit.courseCode, dbh, dbhObservation);
  const examParticipation = mapDbhToExamParticipation(dbhExam, dbhExamRejectedRows);
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
    examParticipation: {
      period: examParticipation.period,
      registered: examParticipation.registered,
      attended: examParticipation.attended,
      passed: examParticipation.passed,
      failed: examParticipation.failed,
      passedAfterRepeat: examParticipation.passedAfterRepeat,
    },
    sourceStatuses: [
      ...ntnu.sourceStatuses,
      ...grades.sourceStatuses,
      ...examParticipation.sourceStatuses,
    ],
    evidence: [...ntnu.evidence, ...grades.evidence, ...examParticipation.evidence],
  });

  return insight;
};

export const makeLiveCourseDecisionService = (
  deps: LiveCourseDecisionDependencies,
  config: LiveCourseDecisionConfig,
): CourseDecisionService => {
  if (!Number.isSafeInteger(config.sourceRequestTimeoutMs) || config.sourceRequestTimeoutMs <= 0) {
    throw new RangeError('sourceRequestTimeoutMs must be a positive integer.');
  }
  if (!Number.isSafeInteger(config.sourceCacheTtlMs) || config.sourceCacheTtlMs <= 0) {
    throw new RangeError('sourceCacheTtlMs must be a positive integer.');
  }
  if (
    !Number.isSafeInteger(config.sourceCacheMaxEntriesPerProvider) ||
    config.sourceCacheMaxEntriesPerProvider <= 0
  ) {
    throw new RangeError('sourceCacheMaxEntriesPerProvider must be a positive integer.');
  }
  const runSource = <Output>(
    task: (sourceDeps: LiveCourseDecisionDependencies) => Promise<Output>,
  ) => runWithSourceDeadline(deps, config.sourceRequestTimeoutMs, task);
  const ntnuSearchRequests = makeSourceRequestCache<NtnuSearchParseResult>(
    config.sourceCacheTtlMs,
    config.sourceCacheMaxEntriesPerProvider,
    deps.now,
    (result) => result.rejected.length === 0,
  );
  const ntnuScheduleRequests = makeSourceRequestCache<NtnuScheduleParseResult>(
    config.sourceCacheTtlMs,
    config.sourceCacheMaxEntriesPerProvider,
    deps.now,
    (result) => result.rejected.length === 0,
  );
  const ntnuDetailRequests = makeSourceRequestCache<NtnuDetailParseResult>(
    config.sourceCacheTtlMs,
    config.sourceCacheMaxEntriesPerProvider,
    deps.now,
    (result) => result.rejected === null,
  );
  const dbhExamOutcomeRequests = makeSourceRequestCache<DbhExamOutcomesParseResult>(
    config.sourceCacheTtlMs,
    config.sourceCacheMaxEntriesPerProvider,
    deps.now,
    (result) => result.accepted !== null && result.rejected.length === 0,
  );
  const dbhGradeSummaryRequests = makeSourceRequestCache<DbhGradeSummariesParseResult>(
    config.sourceCacheTtlMs,
    config.sourceCacheMaxEntriesPerProvider,
    deps.now,
    (result) => result.rejected.length === 0,
  );

  const search = (input: CourseSearchInput) =>
    Effect.tryPromise({
      try: async () => {
        const term = resolveTerm(input.term, config);
        const queryString = input.query?.trim() ?? '';
        const searchQuery = {
          queryString,
          academicYear: term.academicYear,
          season: term.season,
          page: input.page ?? 1,
          sort: input.sort ?? (queryString.length === 0 ? ('title-asc' as const) : 'relevance'),
          campuses: [...new Set(input.campuses ?? defaultCampuses)].sort(),
          levels: [...new Set(input.levels ?? defaultLevels)].sort(),
          continuingEducation: input.continuingEducation ?? true,
          open: input.open ?? false,
          english: input.english ?? false,
        };
        const { value: result, observedAt } = await ntnuSearchRequests(
          JSON.stringify(searchQuery),
          () => runSource((sourceDeps) => fetchNtnuCourseSearch(sourceDeps, searchQuery)),
        );
        if (result.rejected.length > 0 && result.accepted.length === 0) {
          throw new Error(result.rejected[0]?.message ?? 'NTNU course search was rejected.');
        }

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
        const term = resolveTerm(input.term, config);
        const courseCode = input.courseCode.trim().toUpperCase();
        const searchQuery = {
          queryString: courseCode,
          academicYear: term.academicYear,
          season: term.season,
          page: 1,
          sort: 'relevance' as const,
          campuses: defaultCampuses,
          levels: defaultLevels,
          continuingEducation: true,
          open: false,
          english: false,
        };
        const { value: searchResult } = await ntnuSearchRequests(JSON.stringify(searchQuery), () =>
          runSource((sourceDeps) => fetchNtnuCourseSearch(sourceDeps, searchQuery)),
        );
        if (searchResult.rejected.length > 0 && searchResult.accepted.length === 0) {
          throw new Error(searchResult.rejected[0]?.message ?? 'NTNU course search was rejected.');
        }

        const hit = searchResult.accepted.find(
          (candidate) => candidate.courseCode.toUpperCase() === courseCode,
        );
        if (hit === undefined) {
          throw new CourseNotFoundError({ courseCode });
        }

        const detailRequest = ntnuDetailRequests(
          JSON.stringify([hit.courseCode, term.academicYear]),
          () =>
            runSource((sourceDeps) =>
              fetchNtnuCourseDetail(sourceDeps, hit.courseCode, String(term.academicYear)),
            ),
        );
        const dbhExamRequest = dbhExamOutcomeRequests(
          JSON.stringify([hit.courseCode, config.gradeFromYear, config.gradeToYear]),
          () =>
            runSource((sourceDeps) =>
              fetchDbhExamOutcomes(
                sourceDeps,
                hit.courseCode,
                config.gradeFromYear,
                config.gradeToYear,
              ),
            ),
        );
        const gradeCodes = [hit.courseCode];
        const dbhRequest = dbhGradeSummaryRequests(
          JSON.stringify([gradeCodes, config.gradeFromYear, config.gradeToYear]),
          () =>
            runSource((sourceDeps) =>
              fetchDbhGradeSummaries(
                sourceDeps,
                gradeCodes,
                config.gradeFromYear,
                config.gradeToYear,
              ),
            ),
        );
        const [detailSettled, dbhSettled, dbhExamSettled] = await Promise.allSettled([
          detailRequest,
          dbhRequest,
          dbhExamRequest,
        ]);

        const detailResult =
          detailSettled.status === 'fulfilled' ? detailSettled.value.value : null;
        const detail = detailResult?.accepted ?? null;
        const detailWarning =
          detailSettled.status === 'rejected'
            ? errorMessage(detailSettled.reason)
            : (detailResult?.rejected?.message ?? null);

        const dbhExamResult =
          dbhExamSettled.status === 'fulfilled' ? dbhExamSettled.value.value : null;
        const dbhExam = dbhExamResult?.accepted ?? null;

        const dbhResult = dbhSettled.status === 'fulfilled' ? dbhSettled.value.value : null;
        const dbh =
          dbhResult?.accepted.find((course) => course.courseCode === hit.courseCode) ?? null;
        const dbhObservation =
          dbhSettled.status === 'fulfilled'
            ? {
                observedAt: dbhSettled.value.observedAt.toISOString(),
                rejectedRows: dbhResult?.rejected.length ?? 0,
              }
            : undefined;

        const item = assembleInsight(
          hit,
          detail,
          detailWarning,
          dbh,
          dbhObservation,
          dbhExam,
          dbhExamResult?.rejected.length ?? 0,
        );
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
        const { value: result, observedAt } = await dbhGradeSummaryRequests(
          JSON.stringify([[...courseCodes].sort(), config.gradeFromYear, config.gradeToYear]),
          () =>
            runSource((sourceDeps) =>
              fetchDbhGradeSummaries(
                sourceDeps,
                courseCodes,
                config.gradeFromYear,
                config.gradeToYear,
              ),
            ),
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
              observedAt,
              warning:
                result.rejected.length === 0
                  ? null
                  : `${result.rejected.length} malformed DBH grade row(s) were excluded.`,
            },
          ],
          fromYear: config.gradeFromYear,
          toYear: config.gradeToYear,
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
        const term = resolveTerm(input.term, config);
        const courseCodes = [
          ...new Set(input.courseCodes.map((courseCode) => courseCode.trim().toUpperCase())),
        ];
        const items = await mapConcurrent(courseCodes, 4, async (courseCode) => {
          try {
            const { value: result } = await ntnuDetailRequests(
              JSON.stringify([courseCode, term.academicYear]),
              () =>
                runSource((sourceDeps) =>
                  fetchNtnuCourseDetail(sourceDeps, courseCode, String(term.academicYear)),
                ),
            );
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

  const getSchedule = (input: CourseScheduleInput) =>
    Effect.tryPromise({
      try: async () => {
        const term = resolveTerm(input.term, config);
        const courseCodes = input.courseCodes.map((courseCode) => courseCode.trim().toUpperCase());
        const items = await mapConcurrent(courseCodes, 4, async (courseCode) => {
          try {
            return await runWithSourceDeadline(
              deps,
              config.sourceRequestTimeoutMs,
              async (sourceDeps) => {
                const searchQuery = {
                  queryString: courseCode,
                  academicYear: term.academicYear,
                  season: term.season,
                  page: 1,
                  sort: 'relevance' as const,
                  campuses: defaultCampuses,
                  levels: defaultLevels,
                  continuingEducation: true,
                  open: false,
                  english: false,
                };
                const { value: searchResult, observedAt: searchObservedAt } =
                  await ntnuSearchRequests(JSON.stringify(searchQuery), () =>
                    fetchNtnuCourseSearch(sourceDeps, searchQuery),
                  );
                const searchWarning =
                  searchResult.rejected.length === 0
                    ? null
                    : `${searchResult.rejected.length} malformed NTNU catalogue row(s) were excluded.`;
                if (searchResult.rejected.length > 0 && searchResult.accepted.length === 0) {
                  return failedScheduleItem(
                    courseCode,
                    searchObservedAt,
                    searchResult.rejected[0]?.message ?? 'NTNU course search was rejected.',
                  );
                }

                const hit = searchResult.accepted.find(
                  (candidate) =>
                    candidate.exactMatch && candidate.courseCode.toUpperCase() === courseCode,
                );
                if (hit === undefined) {
                  return unavailableScheduleItem(
                    courseCode,
                    searchObservedAt,
                    combineWarnings(
                      `NTNU course search had no exact hit for ${courseCode}.`,
                      searchWarning,
                    ) ?? `NTNU course search had no exact hit for ${courseCode}.`,
                  );
                }

                const courseVersion = hit.courseVersion;
                if (courseVersion === null || courseVersion.trim() === '') {
                  return unavailableScheduleItem(
                    courseCode,
                    new Date(hit.attribution.retrievedAt),
                    combineWarnings(
                      `NTNU course search did not publish a version for ${courseCode}.`,
                      searchWarning,
                    ) ?? `NTNU course search did not publish a version for ${courseCode}.`,
                  );
                }

                const { value: scheduleResult, observedAt: scheduleObservedAt } =
                  await ntnuScheduleRequests(
                    JSON.stringify([hit.courseCode, courseVersion, term.academicYear, term.season]),
                    () =>
                      fetchNtnuCourseSchedule(sourceDeps, {
                        courseCode: hit.courseCode,
                        courseVersion,
                        academicYear: term.academicYear,
                        season: term.season,
                      }),
                  );
                const firstOccurrence = scheduleResult.accepted[0];
                const observedAt =
                  firstOccurrence === undefined
                    ? scheduleObservedAt
                    : new Date(firstOccurrence.attribution.retrievedAt);
                const warning = combineWarnings(
                  searchWarning,
                  scheduleResult.rejected.length === 0
                    ? null
                    : `${scheduleResult.rejected.length} malformed NTNU schedule occurrence(s) were excluded.`,
                );
                if (scheduleResult.rejected.length > 0 && scheduleResult.accepted.length === 0) {
                  return failedScheduleItem(
                    courseCode,
                    observedAt,
                    warning ?? 'NTNU schedule response was rejected.',
                  );
                }

                return {
                  courseCode,
                  sourceStatus: {
                    provider: 'ntnu-course-schedule' as const,
                    status: 'available' as const,
                    observedAt,
                    warning,
                  },
                  activityStreams: toCourseScheduleActivityStreams(scheduleResult.accepted),
                  occurrences: scheduleResult.accepted
                    .filter((occurrence) => osloIsoWeek(occurrence.startsAt) === input.week)
                    .map(toCourseScheduleOccurrence),
                };
              },
            );
          } catch (cause) {
            return failedScheduleItem(courseCode, null, errorMessage(cause));
          }
        });

        return {
          items,
          term: `${term.academicYear}-${term.season}`,
          week: input.week,
        };
      },
      catch: (cause) =>
        cause instanceof CourseInvalidTermError
          ? cause
          : new CourseSourcesUnavailableError({
              operation: 'schedule',
              message: errorMessage(cause),
            }),
    });

  const traced = <Success, Error, Requirements>(
    name: string,
    attributes: Record<string, unknown>,
    effect: Effect.Effect<Success, Error, Requirements>,
  ): Effect.Effect<Success, Error, Requirements> => {
    const withSpan = effect.pipe(Effect.withSpan(name, { attributes }));
    return deps.tracer === undefined
      ? withSpan
      : Effect.provideService(withSpan, Tracer.Tracer, deps.tracer);
  };

  return {
    search: (input) =>
      traced('course-decision.search', { 'course.term': input.term ?? 'default' }, search(input)),
    getInsight: (input) =>
      traced(
        'course-decision.insight',
        { 'course.code': input.courseCode, 'course.term': input.term ?? 'default' },
        getInsight(input),
      ),
    getGradeSummaries: (input) =>
      traced(
        'course-decision.grade-summaries',
        { 'course.count': input.courseCodes.length },
        getGradeSummaries(input),
      ),
    getDecisionSignals: (input) =>
      traced(
        'course-decision.decision-signals',
        { 'course.count': input.courseCodes.length, 'course.term': input.term ?? 'default' },
        getDecisionSignals(input),
      ),
    getSchedule: (input) =>
      traced(
        'course-decision.schedule',
        {
          'course.count': input.courseCodes.length,
          'course.term': input.term ?? 'default',
          'course.week': input.week,
        },
        getSchedule(input),
      ),
  };
};
