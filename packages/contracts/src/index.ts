import type { CourseSummary } from '@course-data/domain';
import type {
  PlanningScenario,
  ProgrammeVersion,
  ScenarioEvaluation,
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
  }),
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
  };
}

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
  readonly meta: { readonly note: string; readonly dataRevision: string };
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
  meta: { ...projection.meta },
});
