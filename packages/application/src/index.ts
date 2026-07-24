import type { CourseSummary, InstitutionId } from '@course-data/domain';
import {
  decodeWorkbenchViewSpec,
  evaluateScenario,
  generateBaselineScenario,
  type PlanningScenarioId,
  type ProgrammeVersion,
} from '@course-data/study-kernel';
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

export interface CourseQuery {
  readonly search?: string;
  readonly institutionId?: InstitutionId;
  readonly academicYear?: number;
}

export class RepositoryError extends Data.TaggedError('RepositoryError')<{
  readonly operation: string;
  readonly message: string;
}> {}

export class ProgrammeVersionNotFoundError extends Data.TaggedError(
  'ProgrammeVersionNotFoundError',
)<{
  readonly programmeVersionId: string;
}> {}

export class CompareUnavailableError extends Data.TaggedError('CompareUnavailableError')<{
  readonly availableProgrammeCount: number;
  readonly requiredProgrammeCount: number;
}> {}

export interface CourseRepositoryService {
  readonly list: (
    query: CourseQuery,
  ) => Effect.Effect<ReadonlyArray<CourseSummary>, RepositoryError>;
}

export class CourseRepository extends Context.Service<CourseRepository, CourseRepositoryService>()(
  '@course-data/CourseRepository',
) {}

export const listCourses = (query: CourseQuery) =>
  Effect.flatMap(CourseRepository, (repository) => repository.list(query));

export const courseRepositoryLayer = (repository: CourseRepositoryService) =>
  Layer.succeed(CourseRepository, repository);

export interface ProgrammeVersionListRow {
  readonly programmeId: string;
  readonly programmeVersionId: string;
  readonly institutionId: string;
  readonly institutionShortName: string;
  readonly title: string;
  readonly cohortStartYear: number;
  readonly startSeason: 'autumn' | 'spring';
  readonly durationTerms: number;
  readonly relationAuthority: 'official' | 'administrative' | 'inferred' | 'fixture';
  readonly dataRevision: string;
  readonly observedAt: string | null;
  readonly sourcePeriod: string | null;
}

export interface SourceFreshnessRow {
  readonly sourceProvider: string;
  readonly scope: string;
  readonly targetSeconds: number;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessfulPublishAt: string | null;
  readonly lastError: string | null;
  readonly stale: boolean;
}

export interface CapabilityWarning {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly detail: string;
}

export interface ProgrammeCurriculumRepositoryService {
  readonly listProgrammeVersions: () => Effect.Effect<
    ReadonlyArray<ProgrammeVersionListRow>,
    RepositoryError
  >;
  readonly getProgrammeVersion: (
    programmeVersionId: string,
  ) => Effect.Effect<ProgrammeVersion, RepositoryError | ProgrammeVersionNotFoundError>;
  readonly listSourceFreshness: () => Effect.Effect<
    ReadonlyArray<SourceFreshnessRow>,
    RepositoryError
  >;
}

export class ProgrammeCurriculumRepository extends Context.Service<
  ProgrammeCurriculumRepository,
  ProgrammeCurriculumRepositoryService
>()('@course-data/ProgrammeCurriculumRepository') {}

export const programmeCurriculumRepositoryLayer = (
  repository: ProgrammeCurriculumRepositoryService,
) => Layer.succeed(ProgrammeCurriculumRepository, repository);

const incompleteCapabilityWarnings: ReadonlyArray<CapabilityWarning> = [
  {
    code: 'actual-progress-unavailable',
    severity: 'warning',
    title: 'Actual progress is not connected',
    detail:
      'This roadmap uses the official curriculum and local scenario state; authoritative completed-course progress is not available in this increment.',
  },
];

const freshnessWarnings = (
  observedAt: string | null,
  sourcePeriod: string | null,
): ReadonlyArray<CapabilityWarning> => {
  const warnings: CapabilityWarning[] = [...incompleteCapabilityWarnings];
  if (observedAt === null || sourcePeriod === null) {
    warnings.push({
      code: 'freshness-unknown',
      severity: 'warning',
      title: 'Source freshness is incomplete',
      detail:
        'At least one source freshness field is unknown; no retrieval time or source period has been inferred.',
    });
  }
  return warnings;
};

export const roadmapWorkbenchView = decodeWorkbenchViewSpec({
  schemaVersion: 1,
  id: 'view:programme-roadmap',
  title: 'Programme roadmap',
  entity: 'planning-scenario',
  filters: [],
  relationTraversal: ['scenario.programmeVersion', 'programme.requirements'],
  groupBy: ['terms.term.index'],
  sort: [{ field: 'terms.term.index', direction: 'ascending' }],
  fields: [
    'terms.term.label',
    'terms.courses.code',
    'terms.courses.title',
    'terms.courses.credits',
    'evaluation.findings',
  ],
  presentation: 'roadmap',
  parameters: [{ name: 'maximumCreditsPerTerm', value: '30' }],
});

export const listProgrammes = () =>
  Effect.flatMap(ProgrammeCurriculumRepository, (repository) =>
    Effect.map(repository.listProgrammeVersions(), (items) => {
      const observedValues = [...new Set(items.map((item) => item.observedAt))];
      const sourcePeriods = [...new Set(items.map((item) => item.sourcePeriod))];
      const observedAt = observedValues.length === 1 ? (observedValues[0] ?? null) : null;
      const sourcePeriod = sourcePeriods.length === 1 ? (sourcePeriods[0] ?? null) : null;
      const revisions = [...new Set(items.map((item) => item.dataRevision))];
      const programmeCount = new Set(items.map((item) => item.programmeId)).size;
      return {
        items,
        meta: {
          count: items.length,
          programmeCount,
          compareThreshold: 10 as const,
          compareEnabled: programmeCount >= 10,
          dataRevision:
            revisions.length === 0
              ? 'unknown'
              : revisions.length === 1
                ? (revisions[0] ?? 'unknown')
                : 'multiple',
          observedAt,
          sourcePeriod,
          warnings: freshnessWarnings(observedAt, sourcePeriod),
        },
      };
    }),
  );

export const getDataStatus = () =>
  Effect.flatMap(ProgrammeCurriculumRepository, (repository) =>
    Effect.map(repository.listSourceFreshness(), (sources) => ({
      sources,
      meta: {
        sourceCount: sources.length,
        staleCount: sources.filter((source) => source.stale).length,
      },
    })),
  );

const programmeCourses = (programme: ProgrammeVersion) => {
  const courses = new Map<
    string,
    { readonly code: string; readonly title: string; readonly credits: number }
  >();
  for (const requirement of programme.requirements) {
    if (requirement.kind === 'required-course') {
      courses.set(requirement.course.code, requirement.course);
    } else if (requirement.kind === 'choose-n') {
      for (const option of requirement.options) courses.set(option.code, option);
    }
  }
  return courses;
};

export const compareProgrammes = (
  leftProgrammeVersionId: string,
  rightProgrammeVersionId: string,
) =>
  Effect.flatMap(ProgrammeCurriculumRepository, (repository) =>
    Effect.gen(function* () {
      const rows = yield* repository.listProgrammeVersions();
      const programmeCount = new Set(rows.map((row) => row.programmeId)).size;
      if (programmeCount < 10) {
        return yield* Effect.fail(
          new CompareUnavailableError({
            availableProgrammeCount: programmeCount,
            requiredProgrammeCount: 10,
          }),
        );
      }
      const left = yield* repository.getProgrammeVersion(leftProgrammeVersionId);
      const right = yield* repository.getProgrammeVersion(rightProgrammeVersionId);
      const leftCourses = programmeCourses(left);
      const rightCourses = programmeCourses(right);
      const sharedCodes = [...leftCourses.keys()].filter((code) => rightCourses.has(code)).sort();
      const summarize = (
        programme: ProgrammeVersion,
        courses: typeof leftCourses,
        other: typeof rightCourses,
      ) => ({
        programmeVersionId: programme.id,
        programmeId: programme.programmeId,
        title: programme.title,
        institutionShortName: programme.institutionShortName,
        cohortStartYear: programme.cohortStartYear,
        durationTerms: programme.durationTerms,
        listedCourseCount: courses.size,
        listedCredits: [...courses.values()].reduce((sum, course) => sum + course.credits, 0),
        choiceGroupCount: programme.requirements.filter(
          (requirement) => requirement.kind === 'choose-n',
        ).length,
        uniqueCourses: [...courses.values()]
          .filter((course) => !other.has(course.code))
          .map((course) => ({ code: course.code, title: course.title, credits: course.credits }))
          .sort((a, b) => a.code.localeCompare(b.code)),
      });
      return {
        left: summarize(left, leftCourses, rightCourses),
        right: summarize(right, rightCourses, leftCourses),
        sharedCourses: sharedCodes.map((code) => {
          const course = leftCourses.get(code)!;
          return { code, title: course.title, credits: course.credits };
        }),
        meta: { programmeCount, compareThreshold: 10 as const },
      };
    }),
  );

export const getPlannerBaseline = (programmeVersionId: string) =>
  Effect.flatMap(ProgrammeCurriculumRepository, (repository) =>
    Effect.gen(function* () {
      const programme = yield* repository.getProgrammeVersion(programmeVersionId);
      const listRows = yield* repository.listProgrammeVersions();
      const listRow = listRows.find((candidate) => candidate.programmeVersionId === programme.id);
      const observedAt = listRow?.observedAt ?? null;
      const sourcePeriod = listRow?.sourcePeriod ?? null;
      const scenario = generateBaselineScenario(programme, {
        id: `scenario:${programme.id}:baseline` as PlanningScenarioId,
        title: `${programme.title} baseline`,
      });
      return {
        programme,
        scenario,
        evaluation: evaluateScenario(programme, scenario, { maximumCreditsPerTerm: 30 }),
        meta: {
          note: 'Evidence-backed official curriculum; planning choices remain local scenarios.',
          dataRevision: programme.dataRevision,
          observedAt,
          sourcePeriod,
          warnings: freshnessWarnings(observedAt, sourcePeriod),
        },
        viewSpec: roadmapWorkbenchView,
      };
    }),
  );

export const createMemoryProgrammeCurriculumRepository = (
  programmes: ReadonlyArray<ProgrammeVersion>,
): ProgrammeCurriculumRepositoryService => ({
  listProgrammeVersions: () =>
    Effect.succeed(
      programmes.map((programme) => ({
        programmeId: programme.programmeId,
        programmeVersionId: programme.id,
        institutionId: programme.institutionId,
        institutionShortName: programme.institutionShortName,
        title: programme.title,
        cohortStartYear: programme.cohortStartYear,
        startSeason: programme.startSeason,
        durationTerms: programme.durationTerms,
        relationAuthority: programme.relationAuthority,
        dataRevision: programme.dataRevision,
        observedAt: null,
        sourcePeriod: null,
      })),
    ),
  getProgrammeVersion: (programmeVersionId) => {
    const programme = programmes.find((candidate) => candidate.id === programmeVersionId);
    return programme === undefined
      ? Effect.fail(new ProgrammeVersionNotFoundError({ programmeVersionId }))
      : Effect.succeed(programme);
  },
  listSourceFreshness: () => Effect.succeed([]),
});

export const createMemoryCourseRepository = (
  courses: ReadonlyArray<CourseSummary>,
): CourseRepositoryService => ({
  list: (query) =>
    Effect.sync(() => {
      const search = query.search?.trim().toLocaleLowerCase();
      return courses.filter((course) => {
        if (query.institutionId && course.institutionId !== query.institutionId) return false;
        if (query.academicYear && course.academicYear !== query.academicYear) return false;
        if (!search) return true;
        return (
          course.code.toLocaleLowerCase().includes(search) ||
          course.title.toLocaleLowerCase().includes(search)
        );
      });
    }),
});
