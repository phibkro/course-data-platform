import type { CourseSummary } from '@course-data/domain';
import type {
  PlanningScenario,
  ProgrammeVersion,
  ScenarioEvaluation,
  WorkbenchViewSpec,
} from '@course-data/study-kernel';
import { t } from 'elysia';

export const CourseLevelDto = t.Union([
  t.Literal('bachelor'),
  t.Literal('master'),
  t.Literal('phd'),
  t.Literal('continuing-education'),
  t.Literal('unknown'),
]);

export const SourceReferenceDto = t.Object({
  provider: t.String({ minLength: 1 }),
  recordId: t.String({ minLength: 1 }),
  retrievedAt: t.String({ format: 'date-time' }),
});

export const CourseSummaryDto = t.Object({
  id: t.String(),
  courseId: t.String(),
  institutionId: t.String(),
  institutionShortName: t.String(),
  code: t.String(),
  title: t.String(),
  academicYear: t.Integer({ minimum: 2000, maximum: 2200 }),
  credits: t.Union([t.Number({ minimum: 0, maximum: 60 }), t.Null()]),
  level: CourseLevelDto,
  teachingLanguage: t.Union([t.String(), t.Null()]),
  source: SourceReferenceDto,
});

export const ListCoursesQueryDto = t.Object({
  search: t.Optional(t.String({ maxLength: 200 })),
  institutionId: t.Optional(t.String({ minLength: 1 })),
  academicYear: t.Optional(t.Numeric({ minimum: 2000, maximum: 2200 })),
});

export const ListCoursesResponseDto = t.Object({
  items: t.Array(CourseSummaryDto),
  meta: t.Object({
    count: t.Integer({ minimum: 0 }),
    dataRevision: t.String(),
  }),
});

export const ProblemDto = t.Object({
  type: t.String(),
  title: t.String(),
  status: t.Integer(),
  detail: t.String(),
  requestId: t.String(),
});

export interface CourseSummaryDtoType {
  readonly id: string;
  readonly courseId: string;
  readonly institutionId: string;
  readonly institutionShortName: string;
  readonly code: string;
  readonly title: string;
  readonly academicYear: number;
  readonly credits: number | null;
  readonly level: 'bachelor' | 'master' | 'phd' | 'continuing-education' | 'unknown';
  readonly teachingLanguage: string | null;
  readonly source: {
    readonly provider: string;
    readonly recordId: string;
    readonly retrievedAt: string;
  };
}

export interface ListCoursesResponseDtoType {
  readonly items: ReadonlyArray<CourseSummaryDtoType>;
  readonly meta: {
    readonly count: number;
    readonly dataRevision: string;
  };
}

export const DataStatusResponseDto = t.Object({
  sources: t.Array(
    t.Object({
      sourceProvider: t.String(),
      scope: t.String(),
      targetSeconds: t.Integer({ minimum: 1 }),
      lastAttemptAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
      lastSuccessfulPublishAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
      lastError: t.Union([t.String(), t.Null()]),
      stale: t.Boolean(),
    }),
  ),
  meta: t.Object({
    sourceCount: t.Integer({ minimum: 0 }),
    staleCount: t.Integer({ minimum: 0 }),
  }),
});

export interface DataStatusResponseDtoType {
  readonly sources: ReadonlyArray<{
    readonly sourceProvider: string;
    readonly scope: string;
    readonly targetSeconds: number;
    readonly lastAttemptAt: string | null;
    readonly lastSuccessfulPublishAt: string | null;
    readonly lastError: string | null;
    readonly stale: boolean;
  }>;
  readonly meta: { readonly sourceCount: number; readonly staleCount: number };
}

export const CompareProgrammesQueryDto = t.Object({
  leftProgrammeVersionId: t.String({ minLength: 1 }),
  rightProgrammeVersionId: t.String({ minLength: 1 }),
});

const ComparedCourseDto = t.Object({
  code: t.String(),
  title: t.String(),
  credits: t.Number({ minimum: 0 }),
});
const ComparedProgrammeDto = t.Object({
  programmeVersionId: t.String(),
  programmeId: t.String(),
  title: t.String(),
  institutionShortName: t.String(),
  cohortStartYear: t.Integer(),
  durationTerms: t.Integer(),
  listedCourseCount: t.Integer({ minimum: 0 }),
  listedCredits: t.Number({ minimum: 0 }),
  choiceGroupCount: t.Integer({ minimum: 0 }),
  uniqueCourses: t.Array(ComparedCourseDto),
});

export const CompareProgrammesResponseDto = t.Object({
  left: ComparedProgrammeDto,
  right: ComparedProgrammeDto,
  sharedCourses: t.Array(ComparedCourseDto),
  meta: t.Object({ programmeCount: t.Integer({ minimum: 10 }), compareThreshold: t.Literal(10) }),
});

export interface CompareProgrammesResponseDtoType {
  readonly left: ComparedProgrammeDtoType;
  readonly right: ComparedProgrammeDtoType;
  readonly sharedCourses: ReadonlyArray<ComparedCourseDtoType>;
  readonly meta: { readonly programmeCount: number; readonly compareThreshold: 10 };
}

interface ComparedCourseDtoType {
  readonly code: string;
  readonly title: string;
  readonly credits: number;
}
interface ComparedProgrammeDtoType {
  readonly programmeVersionId: string;
  readonly programmeId: string;
  readonly title: string;
  readonly institutionShortName: string;
  readonly cohortStartYear: number;
  readonly durationTerms: number;
  readonly listedCourseCount: number;
  readonly listedCredits: number;
  readonly choiceGroupCount: number;
  readonly uniqueCourses: ReadonlyArray<ComparedCourseDtoType>;
}

export const toCourseSummaryDto = (course: CourseSummary): CourseSummaryDtoType => ({
  ...course,
  source: {
    ...course.source,
    retrievedAt: course.source.retrievedAt.toISOString(),
  },
});

export const CourseOptionDto = t.Object({
  courseVersionId: t.String(),
  code: t.String(),
  title: t.String(),
  credits: t.Number({ minimum: 0, maximum: 60 }),
  recommendedTermIndex: t.Union([t.Integer({ minimum: 0 }), t.Null()]),
});

export const ProgrammeRequirementDto = t.Union([
  t.Object({
    kind: t.Literal('required-course'),
    id: t.String(),
    title: t.String(),
    course: CourseOptionDto,
    evidenceRefs: t.Array(t.String()),
  }),
  t.Object({
    kind: t.Literal('choose-n'),
    id: t.String(),
    title: t.String(),
    choose: t.Integer({ minimum: 1 }),
    options: t.Array(CourseOptionDto),
    defaultCourseVersionIds: t.Array(t.String()),
    evidenceRefs: t.Array(t.String()),
  }),
  t.Object({
    kind: t.Literal('minimum-credits'),
    id: t.String(),
    title: t.String(),
    minimumCredits: t.Number({ minimum: 0, maximum: 60 }),
    eligibleCourseVersionIds: t.Array(t.String()),
    evidenceRefs: t.Array(t.String()),
  }),
]);

export const ProgrammeVersionDto = t.Object({
  id: t.String(),
  programmeId: t.String(),
  institutionId: t.String(),
  institutionShortName: t.String(),
  title: t.String(),
  cohortStartYear: t.Integer({ minimum: 2000, maximum: 2200 }),
  startSeason: t.Union([t.Literal('autumn'), t.Literal('spring')]),
  durationTerms: t.Integer({ minimum: 1, maximum: 24 }),
  dataRevision: t.String(),
  relationAuthority: t.Union([
    t.Literal('official'),
    t.Literal('administrative'),
    t.Literal('inferred'),
    t.Literal('fixture'),
  ]),
  requirements: t.Array(ProgrammeRequirementDto),
});

export const PlannedCourseDto = t.Object({
  courseVersionId: t.String(),
  code: t.String(),
  title: t.String(),
  credits: t.Number({ minimum: 0, maximum: 60 }),
  requirementGroupId: t.Union([t.String(), t.Null()]),
  placementSource: t.Union([t.Literal('baseline'), t.Literal('user')]),
});

export const PlannedTermDto = t.Object({
  term: t.Object({
    id: t.String(),
    index: t.Integer({ minimum: 0 }),
    academicYear: t.Integer({ minimum: 2000, maximum: 2200 }),
    season: t.Union([t.Literal('autumn'), t.Literal('spring'), t.Literal('summer')]),
    label: t.String(),
  }),
  courses: t.Array(PlannedCourseDto),
});

export const PlanningScenarioDto = t.Object({
  schemaVersion: t.Literal(1),
  id: t.String(),
  title: t.String(),
  programmeVersionId: t.String(),
  dataRevision: t.String(),
  completedCourseVersionIds: t.Array(t.String()),
  terms: t.Array(PlannedTermDto),
});

export const EvaluationFindingDto = t.Object({
  code: t.Union([
    t.Literal('required-course-missing'),
    t.Literal('choice-requirement-unmet'),
    t.Literal('minimum-credits-unmet'),
    t.Literal('term-credit-limit-exceeded'),
    t.Literal('recommended-term-changed'),
  ]),
  severity: t.Union([t.Literal('info'), t.Literal('warning'), t.Literal('error')]),
  title: t.String(),
  detail: t.String(),
  requirementGroupId: t.Union([t.String(), t.Null()]),
  courseVersionId: t.Union([t.String(), t.Null()]),
  termId: t.Union([t.String(), t.Null()]),
  evidenceRefs: t.Array(t.String()),
});

export const CapabilityWarningDto = t.Object({
  code: t.String(),
  severity: t.Union([t.Literal('info'), t.Literal('warning'), t.Literal('error')]),
  title: t.String(),
  detail: t.String(),
});

export const ProgrammeSummaryDto = t.Object({
  programmeId: t.String(),
  programmeVersionId: t.String(),
  institutionId: t.String(),
  institutionShortName: t.String(),
  title: t.String(),
  cohortStartYear: t.Integer({ minimum: 2000, maximum: 2200 }),
  startSeason: t.Union([t.Literal('autumn'), t.Literal('spring')]),
  durationTerms: t.Integer({ minimum: 1, maximum: 24 }),
  relationAuthority: t.Union([
    t.Literal('official'),
    t.Literal('administrative'),
    t.Literal('inferred'),
    t.Literal('fixture'),
  ]),
  dataRevision: t.String(),
  observedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
  sourcePeriod: t.Union([t.String(), t.Null()]),
});

export const ListProgrammesResponseDto = t.Object({
  items: t.Array(ProgrammeSummaryDto),
  meta: t.Object({
    count: t.Integer({ minimum: 0 }),
    programmeCount: t.Integer({ minimum: 0 }),
    compareThreshold: t.Literal(10),
    compareEnabled: t.Boolean(),
    dataRevision: t.String(),
    observedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
    sourcePeriod: t.Union([t.String(), t.Null()]),
    warnings: t.Array(CapabilityWarningDto),
  }),
});

export const PlannerBaselineQueryDto = t.Object({
  programmeVersionId: t.String({ minLength: 1 }),
});

export interface ProgrammeSummaryDtoType {
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

export interface ListProgrammesResponseDtoType {
  readonly items: ReadonlyArray<ProgrammeSummaryDtoType>;
  readonly meta: {
    readonly count: number;
    readonly programmeCount: number;
    readonly compareThreshold: 10;
    readonly compareEnabled: boolean;
    readonly dataRevision: string;
    readonly observedAt: string | null;
    readonly sourcePeriod: string | null;
    readonly warnings: ReadonlyArray<CapabilityWarningDtoType>;
  };
}

export interface CapabilityWarningDtoType {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly detail: string;
}

export const WorkbenchViewSpecDto = t.Object({
  schemaVersion: t.Literal(1),
  id: t.String(),
  title: t.String(),
  entity: t.Union([
    t.Literal('programme-version'),
    t.Literal('planning-scenario'),
    t.Literal('course-version'),
  ]),
  filters: t.Array(
    t.Object({
      field: t.String(),
      operator: t.Union([
        t.Literal('equals'),
        t.Literal('includes'),
        t.Literal('in'),
        t.Literal('greater-than-or-equal'),
      ]),
      value: t.Union([t.String(), t.Number(), t.Array(t.String())]),
    }),
  ),
  relationTraversal: t.Array(t.String()),
  groupBy: t.Array(t.String()),
  sort: t.Array(
    t.Object({
      field: t.String(),
      direction: t.Union([t.Literal('ascending'), t.Literal('descending')]),
    }),
  ),
  fields: t.Array(t.String()),
  presentation: t.Union([
    t.Literal('table'),
    t.Literal('cards'),
    t.Literal('roadmap'),
    t.Literal('graph'),
    t.Literal('matrix'),
  ]),
  parameters: t.Array(t.Object({ name: t.String(), value: t.String() })),
});

export const PlannerDemoResponseDto = t.Object({
  programme: ProgrammeVersionDto,
  scenario: PlanningScenarioDto,
  evaluation: t.Object({
    totalPlannedCredits: t.Number({ minimum: 0 }),
    termCredits: t.Record(t.String(), t.Number({ minimum: 0 })),
    findings: t.Array(EvaluationFindingDto),
    isFeasible: t.Boolean(),
  }),
  meta: t.Object({
    note: t.String(),
    dataRevision: t.String(),
    observedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
    sourcePeriod: t.Union([t.String(), t.Null()]),
    warnings: t.Array(CapabilityWarningDto),
  }),
  viewSpec: WorkbenchViewSpecDto,
});

export interface PlannerDemoResponseDtoType {
  programme: {
    id: string;
    programmeId: string;
    institutionId: string;
    institutionShortName: string;
    title: string;
    cohortStartYear: number;
    startSeason: 'autumn' | 'spring';
    durationTerms: number;
    dataRevision: string;
    relationAuthority: 'official' | 'administrative' | 'inferred' | 'fixture';
    requirements: Array<
      | {
          kind: 'required-course';
          id: string;
          title: string;
          course: CourseOptionDtoType;
          evidenceRefs: Array<string>;
        }
      | {
          kind: 'choose-n';
          id: string;
          title: string;
          choose: number;
          options: Array<CourseOptionDtoType>;
          defaultCourseVersionIds: Array<string>;
          evidenceRefs: Array<string>;
        }
      | {
          kind: 'minimum-credits';
          id: string;
          title: string;
          minimumCredits: number;
          eligibleCourseVersionIds: Array<string>;
          evidenceRefs: Array<string>;
        }
    >;
  };
  scenario: {
    schemaVersion: 1;
    id: string;
    title: string;
    programmeVersionId: string;
    dataRevision: string;
    completedCourseVersionIds: Array<string>;
    terms: Array<{
      term: {
        id: string;
        index: number;
        academicYear: number;
        season: 'autumn' | 'spring' | 'summer';
        label: string;
      };
      courses: Array<{
        courseVersionId: string;
        code: string;
        title: string;
        credits: number;
        requirementGroupId: string | null;
        placementSource: 'baseline' | 'user';
      }>;
    }>;
  };
  evaluation: {
    totalPlannedCredits: number;
    termCredits: Record<string, number>;
    findings: Array<{
      code:
        | 'required-course-missing'
        | 'choice-requirement-unmet'
        | 'minimum-credits-unmet'
        | 'term-credit-limit-exceeded'
        | 'recommended-term-changed';
      severity: 'info' | 'warning' | 'error';
      title: string;
      detail: string;
      requirementGroupId: string | null;
      courseVersionId: string | null;
      termId: string | null;
      evidenceRefs: Array<string>;
    }>;
    isFeasible: boolean;
  };
  meta: {
    note: string;
    dataRevision: string;
    observedAt: string | null;
    sourcePeriod: string | null;
    warnings: Array<CapabilityWarningDtoType>;
  };
  viewSpec: {
    schemaVersion: 1;
    id: string;
    title: string;
    entity: 'programme-version' | 'planning-scenario' | 'course-version';
    filters: Array<{
      field: string;
      operator: 'equals' | 'includes' | 'in' | 'greater-than-or-equal';
      value: string | number | Array<string>;
    }>;
    relationTraversal: Array<string>;
    groupBy: Array<string>;
    sort: Array<{ field: string; direction: 'ascending' | 'descending' }>;
    fields: Array<string>;
    presentation: 'table' | 'cards' | 'roadmap' | 'graph' | 'matrix';
    parameters: Array<{ name: string; value: string }>;
  };
}

const toMutableViewFilterValue = (
  value: WorkbenchViewSpec['filters'][number]['value'],
): string | number | Array<string> =>
  typeof value === 'string' || typeof value === 'number' ? value : [...value];

interface CourseOptionDtoType {
  courseVersionId: string;
  code: string;
  title: string;
  credits: number;
  recommendedTermIndex: number | null;
}

export const toPlannerDemoResponseDto = (projection: {
  readonly programme: ProgrammeVersion;
  readonly scenario: PlanningScenario;
  readonly evaluation: ScenarioEvaluation;
  readonly meta: {
    readonly note: string;
    readonly dataRevision: string;
    readonly observedAt: string | null;
    readonly sourcePeriod: string | null;
    readonly warnings: ReadonlyArray<CapabilityWarningDtoType>;
  };
  readonly viewSpec: WorkbenchViewSpec;
}): PlannerDemoResponseDtoType => ({
  programme: {
    ...projection.programme,
    requirements: projection.programme.requirements.map((requirement) => {
      if (requirement.kind === 'required-course') {
        return {
          ...requirement,
          evidenceRefs: [...requirement.evidenceRefs],
        };
      }
      if (requirement.kind === 'choose-n') {
        return {
          ...requirement,
          options: requirement.options.map((option) => ({ ...option })),
          defaultCourseVersionIds: [...requirement.defaultCourseVersionIds],
          evidenceRefs: [...requirement.evidenceRefs],
        };
      }
      return {
        ...requirement,
        eligibleCourseVersionIds: [...requirement.eligibleCourseVersionIds],
        evidenceRefs: [...requirement.evidenceRefs],
      };
    }),
  },
  scenario: {
    ...projection.scenario,
    completedCourseVersionIds: [...projection.scenario.completedCourseVersionIds],
    terms: projection.scenario.terms.map((term) => ({
      term: { ...term.term },
      courses: term.courses.map((course) => ({ ...course })),
    })),
  },
  evaluation: {
    totalPlannedCredits: projection.evaluation.totalPlannedCredits,
    termCredits: { ...projection.evaluation.termCredits },
    findings: projection.evaluation.findings.map((finding) => ({
      ...finding,
      evidenceRefs: [...finding.evidenceRefs],
    })),
    isFeasible: projection.evaluation.isFeasible,
  },
  meta: {
    ...projection.meta,
    warnings: projection.meta.warnings.map((warning) => ({ ...warning })),
  },
  viewSpec: {
    ...projection.viewSpec,
    filters: projection.viewSpec.filters.map((filter) => ({
      ...filter,
      value: toMutableViewFilterValue(filter.value),
    })),
    relationTraversal: [...projection.viewSpec.relationTraversal],
    groupBy: [...projection.viewSpec.groupBy],
    sort: projection.viewSpec.sort.map((sort) => ({ ...sort })),
    fields: [...projection.viewSpec.fields],
    parameters: projection.viewSpec.parameters.map((parameter) => ({ ...parameter })),
  },
});
