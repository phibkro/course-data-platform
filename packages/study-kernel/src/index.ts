import { CourseVersionIdSchema, InstitutionIdSchema } from '@course-data/domain';
import * as Schema from 'effect/Schema';

const nonEmptyBrandedString = <Name extends string>(name: Name) =>
  Schema.NonEmptyString.pipe(Schema.brand(name));

export const ProgrammeIdSchema = nonEmptyBrandedString('ProgrammeId');
export type ProgrammeId = Schema.Schema.Type<typeof ProgrammeIdSchema>;

export const ProgrammeVersionIdSchema = nonEmptyBrandedString('ProgrammeVersionId');
export type ProgrammeVersionId = Schema.Schema.Type<typeof ProgrammeVersionIdSchema>;

export const RequirementGroupIdSchema = nonEmptyBrandedString('RequirementGroupId');
export type RequirementGroupId = Schema.Schema.Type<typeof RequirementGroupIdSchema>;

export const PlanningScenarioIdSchema = nonEmptyBrandedString('PlanningScenarioId');
export type PlanningScenarioId = Schema.Schema.Type<typeof PlanningScenarioIdSchema>;

export const StudyTermIdSchema = nonEmptyBrandedString('StudyTermId');
export type StudyTermId = Schema.Schema.Type<typeof StudyTermIdSchema>;

export const DataRevisionSchema = nonEmptyBrandedString('DataRevision');
export type DataRevision = Schema.Schema.Type<typeof DataRevisionSchema>;

export const CreditsSchema = Schema.Number.pipe(
  Schema.check(Schema.isBetween({ minimum: 0, maximum: 60 })),
);
export type Credits = Schema.Schema.Type<typeof CreditsSchema>;

export const TermSeasonSchema = Schema.Literals(['autumn', 'spring', 'summer']);
export type TermSeason = Schema.Schema.Type<typeof TermSeasonSchema>;

export const CourseOptionSchema = Schema.Struct({
  courseVersionId: CourseVersionIdSchema,
  code: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  credits: CreditsSchema,
  recommendedTermIndex: Schema.NullOr(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  ),
});
export type CourseOption = Schema.Schema.Type<typeof CourseOptionSchema>;

export const RequiredCourseRequirementSchema = Schema.Struct({
  kind: Schema.Literal('required-course'),
  id: RequirementGroupIdSchema,
  title: Schema.NonEmptyString,
  course: CourseOptionSchema,
  evidenceRefs: Schema.Array(Schema.NonEmptyString),
});
export type RequiredCourseRequirement = Schema.Schema.Type<typeof RequiredCourseRequirementSchema>;

export const ChooseNRequirementSchema = Schema.Struct({
  kind: Schema.Literal('choose-n'),
  id: RequirementGroupIdSchema,
  title: Schema.NonEmptyString,
  choose: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  options: Schema.Array(CourseOptionSchema),
  defaultCourseVersionIds: Schema.Array(CourseVersionIdSchema),
  evidenceRefs: Schema.Array(Schema.NonEmptyString),
});
export type ChooseNRequirement = Schema.Schema.Type<typeof ChooseNRequirementSchema>;

export const MinimumCreditsRequirementSchema = Schema.Struct({
  kind: Schema.Literal('minimum-credits'),
  id: RequirementGroupIdSchema,
  title: Schema.NonEmptyString,
  minimumCredits: CreditsSchema,
  eligibleCourseVersionIds: Schema.Array(CourseVersionIdSchema),
  evidenceRefs: Schema.Array(Schema.NonEmptyString),
});
export type MinimumCreditsRequirement = Schema.Schema.Type<typeof MinimumCreditsRequirementSchema>;

export const ProgrammeRequirementSchema = Schema.Union([
  RequiredCourseRequirementSchema,
  ChooseNRequirementSchema,
  MinimumCreditsRequirementSchema,
]);
export type ProgrammeRequirement = Schema.Schema.Type<typeof ProgrammeRequirementSchema>;

export const ProgrammeVersionSchema = Schema.Struct({
  id: ProgrammeVersionIdSchema,
  programmeId: ProgrammeIdSchema,
  institutionId: InstitutionIdSchema,
  institutionShortName: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  cohortStartYear: Schema.Int.pipe(
    Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 })),
  ),
  startSeason: Schema.Literals(['autumn', 'spring']),
  durationTerms: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 24 }))),
  dataRevision: DataRevisionSchema,
  relationAuthority: Schema.Literals(['official', 'administrative', 'inferred', 'fixture']),
  requirements: Schema.Array(ProgrammeRequirementSchema),
});
export type ProgrammeVersion = Schema.Schema.Type<typeof ProgrammeVersionSchema>;

export const StudyTermSchema = Schema.Struct({
  id: StudyTermIdSchema,
  index: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  academicYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  season: TermSeasonSchema,
  label: Schema.NonEmptyString,
});
export type StudyTerm = Schema.Schema.Type<typeof StudyTermSchema>;

export const PlannedCourseSchema = Schema.Struct({
  courseVersionId: CourseVersionIdSchema,
  code: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  credits: CreditsSchema,
  requirementGroupId: Schema.NullOr(RequirementGroupIdSchema),
  placementSource: Schema.Literals(['baseline', 'user']),
});
export type PlannedCourse = Schema.Schema.Type<typeof PlannedCourseSchema>;

export const PlannedTermSchema = Schema.Struct({
  term: StudyTermSchema,
  courses: Schema.Array(PlannedCourseSchema),
});
export type PlannedTerm = Schema.Schema.Type<typeof PlannedTermSchema>;

export const PlanningScenarioSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  id: PlanningScenarioIdSchema,
  title: Schema.NonEmptyString,
  programmeVersionId: ProgrammeVersionIdSchema,
  dataRevision: DataRevisionSchema,
  completedCourseVersionIds: Schema.Array(CourseVersionIdSchema),
  terms: Schema.Array(PlannedTermSchema),
});
export type PlanningScenario = Schema.Schema.Type<typeof PlanningScenarioSchema>;

export const ViewFilterSchema = Schema.Struct({
  field: Schema.NonEmptyString,
  operator: Schema.Literals(['equals', 'includes', 'in', 'greater-than-or-equal']),
  value: Schema.Union([Schema.String, Schema.Number, Schema.Array(Schema.String)]),
});
export type ViewFilter = Schema.Schema.Type<typeof ViewFilterSchema>;

export const ViewSortSchema = Schema.Struct({
  field: Schema.NonEmptyString,
  direction: Schema.Literals(['ascending', 'descending']),
});
export type ViewSort = Schema.Schema.Type<typeof ViewSortSchema>;

export const ViewParameterSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  value: Schema.String,
});
export type ViewParameter = Schema.Schema.Type<typeof ViewParameterSchema>;

export const WorkbenchViewSpecSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  id: nonEmptyBrandedString('WorkbenchViewId'),
  title: Schema.NonEmptyString,
  entity: Schema.Literals(['programme-version', 'planning-scenario', 'course-version']),
  filters: Schema.Array(ViewFilterSchema),
  relationTraversal: Schema.Array(Schema.NonEmptyString),
  groupBy: Schema.Array(Schema.NonEmptyString),
  sort: Schema.Array(ViewSortSchema),
  fields: Schema.Array(Schema.NonEmptyString),
  presentation: Schema.Literals(['table', 'cards', 'roadmap', 'graph', 'matrix']),
  parameters: Schema.Array(ViewParameterSchema),
});
export type WorkbenchViewSpec = Schema.Schema.Type<typeof WorkbenchViewSpecSchema>;

export const FindingSeveritySchema = Schema.Literals(['info', 'warning', 'error']);
export type FindingSeverity = Schema.Schema.Type<typeof FindingSeveritySchema>;

export const EvaluationFindingSchema = Schema.Struct({
  code: Schema.Literals([
    'required-course-missing',
    'choice-requirement-unmet',
    'minimum-credits-unmet',
    'term-credit-limit-exceeded',
    'recommended-term-changed',
  ]),
  severity: FindingSeveritySchema,
  title: Schema.NonEmptyString,
  detail: Schema.NonEmptyString,
  requirementGroupId: Schema.NullOr(RequirementGroupIdSchema),
  courseVersionId: Schema.NullOr(CourseVersionIdSchema),
  termId: Schema.NullOr(StudyTermIdSchema),
  evidenceRefs: Schema.Array(Schema.NonEmptyString),
});
export type EvaluationFinding = Schema.Schema.Type<typeof EvaluationFindingSchema>;

export interface EvaluationPolicy {
  readonly maximumCreditsPerTerm: number;
}

export interface ScenarioEvaluation {
  readonly totalPlannedCredits: number;
  readonly termCredits: Readonly<Record<string, number>>;
  readonly findings: ReadonlyArray<EvaluationFinding>;
  readonly isFeasible: boolean;
}

export type KernelError =
  | {
      readonly _tag: 'UnknownCourse';
      readonly courseVersionId: string;
    }
  | {
      readonly _tag: 'UnknownTerm';
      readonly termId: string;
    }
  | {
      readonly _tag: 'CourseAlreadyPlaced';
      readonly courseVersionId: string;
    }
  | {
      readonly _tag: 'CourseNotPlaced';
      readonly courseVersionId: string;
    }
  | {
      readonly _tag: 'UnknownRequirement';
      readonly requirementGroupId: string;
    }
  | {
      readonly _tag: 'InvalidRequirementOption';
      readonly requirementGroupId: string;
      readonly courseVersionId: string;
    };

export type KernelResult<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: KernelError };

const ok = <A>(value: A): KernelResult<A> => ({ ok: true, value });
const fail = <A = never>(error: KernelError): KernelResult<A> => ({ ok: false, error });

export const decodeProgrammeVersion = Schema.decodeUnknownSync(ProgrammeVersionSchema);
export const decodePlanningScenario = Schema.decodeUnknownSync(PlanningScenarioSchema);
export const decodeWorkbenchViewSpec = Schema.decodeUnknownSync(WorkbenchViewSpecSchema);

const termSeasonAt = (startSeason: 'autumn' | 'spring', index: number): 'autumn' | 'spring' => {
  if (startSeason === 'autumn') return index % 2 === 0 ? 'autumn' : 'spring';
  return index % 2 === 0 ? 'spring' : 'autumn';
};

const academicYearAt = (
  cohortStartYear: number,
  startSeason: 'autumn' | 'spring',
  index: number,
): number => {
  if (startSeason === 'autumn') return cohortStartYear + Math.floor((index + 1) / 2);
  return cohortStartYear + Math.floor(index / 2);
};

const makeTerms = (programme: ProgrammeVersion): ReadonlyArray<PlannedTerm> =>
  Array.from({ length: programme.durationTerms }, (_, index) => {
    const season = termSeasonAt(programme.startSeason, index);
    const academicYear = academicYearAt(programme.cohortStartYear, programme.startSeason, index);
    return {
      term: {
        id: `term:${index + 1}` as StudyTermId,
        index,
        academicYear,
        season,
        label: `${season === 'autumn' ? 'Autumn' : 'Spring'} ${academicYear}`,
      },
      courses: [],
    };
  });

const courseOptions = (programme: ProgrammeVersion): ReadonlyMap<string, CourseOption> => {
  const entries: Array<readonly [string, CourseOption]> = [];
  for (const requirement of programme.requirements) {
    if (requirement.kind === 'required-course') {
      entries.push([requirement.course.courseVersionId, requirement.course]);
    }
    if (requirement.kind === 'choose-n') {
      for (const option of requirement.options) {
        entries.push([option.courseVersionId, option]);
      }
    }
  }
  return new Map(entries);
};

export const listCourseOptions = (programme: ProgrammeVersion): ReadonlyArray<CourseOption> => [
  ...courseOptions(programme).values(),
];

const requirementForCourse = (
  programme: ProgrammeVersion,
  courseVersionId: string,
): ProgrammeRequirement | undefined =>
  programme.requirements.find((requirement) => {
    if (requirement.kind === 'required-course') {
      return requirement.course.courseVersionId === courseVersionId;
    }
    if (requirement.kind === 'choose-n') {
      return requirement.options.some((option) => option.courseVersionId === courseVersionId);
    }
    return requirement.eligibleCourseVersionIds.includes(courseVersionId as never);
  });

const placedCourseIds = (scenario: PlanningScenario): ReadonlySet<string> =>
  new Set(scenario.terms.flatMap((term) => term.courses.map((course) => course.courseVersionId)));

const completedOrPlacedCourseIds = (scenario: PlanningScenario): ReadonlySet<string> =>
  new Set([...scenario.completedCourseVersionIds, ...placedCourseIds(scenario)]);

const coursePlacement = (
  scenario: PlanningScenario,
  courseVersionId: string,
): { readonly term: PlannedTerm; readonly course: PlannedCourse } | undefined => {
  for (const term of scenario.terms) {
    const course = term.courses.find((candidate) => candidate.courseVersionId === courseVersionId);
    if (course) return { term, course };
  }
  return undefined;
};

const plannedCourseFrom = (
  programme: ProgrammeVersion,
  option: CourseOption,
  placementSource: 'baseline' | 'user',
): PlannedCourse => {
  const requirement = requirementForCourse(programme, option.courseVersionId);
  return {
    courseVersionId: option.courseVersionId,
    code: option.code,
    title: option.title,
    credits: option.credits,
    requirementGroupId: requirement?.id ?? null,
    placementSource,
  };
};

const addCourseToTerm = (
  terms: ReadonlyArray<PlannedTerm>,
  termIndex: number,
  course: PlannedCourse,
): ReadonlyArray<PlannedTerm> =>
  terms.map((term) =>
    term.term.index === termIndex ? { ...term, courses: [...term.courses, course] } : term,
  );

export interface GenerateScenarioOptions {
  readonly id: PlanningScenarioId;
  readonly title: string;
  readonly completedCourseVersionIds?: ReadonlyArray<
    Schema.Schema.Type<typeof CourseVersionIdSchema>
  >;
}

export const generateBaselineScenario = (
  programme: ProgrammeVersion,
  options: GenerateScenarioOptions,
): PlanningScenario => {
  let terms = makeTerms(programme);
  const selected = new Set<string>();

  const placeOption = (option: CourseOption): void => {
    if (selected.has(option.courseVersionId)) return;
    const termIndex = Math.min(
      Math.max(option.recommendedTermIndex ?? 0, 0),
      programme.durationTerms - 1,
    );
    terms = addCourseToTerm(terms, termIndex, plannedCourseFrom(programme, option, 'baseline'));
    selected.add(option.courseVersionId);
  };

  for (const requirement of programme.requirements) {
    if (requirement.kind === 'required-course') placeOption(requirement.course);
    if (requirement.kind === 'choose-n') {
      const defaults = new Set(requirement.defaultCourseVersionIds);
      for (const option of requirement.options) {
        if (defaults.has(option.courseVersionId)) placeOption(option);
      }
    }
  }

  return decodePlanningScenario({
    schemaVersion: 1,
    id: options.id,
    title: options.title,
    programmeVersionId: programme.id,
    dataRevision: programme.dataRevision,
    completedCourseVersionIds: options.completedCourseVersionIds ?? [],
    terms,
  });
};

export const cloneScenario = (
  scenario: PlanningScenario,
  id: PlanningScenarioId,
  title: string,
): PlanningScenario => decodePlanningScenario({ ...scenario, id, title });

export const renameScenario = (scenario: PlanningScenario, title: string): PlanningScenario =>
  decodePlanningScenario({ ...scenario, title });

export const placeCourse = (
  programme: ProgrammeVersion,
  scenario: PlanningScenario,
  courseVersionId: string,
  termId: string,
): KernelResult<PlanningScenario> => {
  const option = courseOptions(programme).get(courseVersionId);
  if (!option) return fail({ _tag: 'UnknownCourse', courseVersionId });
  if (!scenario.terms.some((term) => term.term.id === termId)) {
    return fail({ _tag: 'UnknownTerm', termId });
  }
  if (placedCourseIds(scenario).has(courseVersionId)) {
    return fail({ _tag: 'CourseAlreadyPlaced', courseVersionId });
  }

  return ok(
    decodePlanningScenario({
      ...scenario,
      terms: scenario.terms.map((term) =>
        term.term.id === termId
          ? {
              ...term,
              courses: [...term.courses, plannedCourseFrom(programme, option, 'user')],
            }
          : term,
      ),
    }),
  );
};

export const moveCourse = (
  scenario: PlanningScenario,
  courseVersionId: string,
  targetTermId: string,
): KernelResult<PlanningScenario> => {
  const placement = coursePlacement(scenario, courseVersionId);
  if (!placement) return fail({ _tag: 'CourseNotPlaced', courseVersionId });
  if (!scenario.terms.some((term) => term.term.id === targetTermId)) {
    return fail({ _tag: 'UnknownTerm', termId: targetTermId });
  }

  return ok(
    decodePlanningScenario({
      ...scenario,
      terms: scenario.terms.map((term) => {
        const withoutCourse = term.courses.filter(
          (course) => course.courseVersionId !== courseVersionId,
        );
        if (term.term.id !== targetTermId) return { ...term, courses: withoutCourse };
        return {
          ...term,
          courses: [...withoutCourse, { ...placement.course, placementSource: 'user' as const }],
        };
      }),
    }),
  );
};

export const removeCourse = (
  scenario: PlanningScenario,
  courseVersionId: string,
): KernelResult<PlanningScenario> => {
  if (!placedCourseIds(scenario).has(courseVersionId)) {
    return fail({ _tag: 'CourseNotPlaced', courseVersionId });
  }
  return ok(
    decodePlanningScenario({
      ...scenario,
      terms: scenario.terms.map((term) => ({
        ...term,
        courses: term.courses.filter((course) => course.courseVersionId !== courseVersionId),
      })),
    }),
  );
};

export const selectCourseForRequirement = (
  programme: ProgrammeVersion,
  scenario: PlanningScenario,
  requirementGroupId: string,
  courseVersionId: string,
  targetTermId: string,
): KernelResult<PlanningScenario> => {
  const requirement = programme.requirements.find(
    (candidate) => candidate.id === requirementGroupId,
  );
  if (!requirement || requirement.kind !== 'choose-n') {
    return fail({ _tag: 'UnknownRequirement', requirementGroupId });
  }

  const option = requirement.options.find(
    (candidate) => candidate.courseVersionId === courseVersionId,
  );
  if (!option) {
    return fail({
      _tag: 'InvalidRequirementOption',
      requirementGroupId,
      courseVersionId,
    });
  }
  if (!scenario.terms.some((term) => term.term.id === targetTermId)) {
    return fail({ _tag: 'UnknownTerm', termId: targetTermId });
  }

  const optionIds = new Set(requirement.options.map((candidate) => candidate.courseVersionId));
  return ok(
    decodePlanningScenario({
      ...scenario,
      terms: scenario.terms.map((term) => {
        const courses = term.courses.filter((course) => !optionIds.has(course.courseVersionId));
        if (term.term.id !== targetTermId) return { ...term, courses };
        return {
          ...term,
          courses: [...courses, plannedCourseFrom(programme, option, 'user')],
        };
      }),
    }),
  );
};

export const creditsInTerm = (term: PlannedTerm): number =>
  term.courses.reduce((sum, course) => sum + course.credits, 0);

export const totalPlannedCredits = (scenario: PlanningScenario): number =>
  scenario.terms.reduce((sum, term) => sum + creditsInTerm(term), 0);

export const evaluateScenario = (
  programme: ProgrammeVersion,
  scenario: PlanningScenario,
  policy: EvaluationPolicy,
): ScenarioEvaluation => {
  const satisfiedCourseIds = completedOrPlacedCourseIds(scenario);
  const findings: EvaluationFinding[] = [];

  for (const requirement of programme.requirements) {
    if (requirement.kind === 'required-course') {
      if (!satisfiedCourseIds.has(requirement.course.courseVersionId)) {
        findings.push({
          code: 'required-course-missing',
          severity: 'error',
          title: `Missing ${requirement.course.code}`,
          detail: `${requirement.course.title} is required by ${requirement.title}.`,
          requirementGroupId: requirement.id,
          courseVersionId: requirement.course.courseVersionId,
          termId: null,
          evidenceRefs: requirement.evidenceRefs,
        });
      }

      const placement = coursePlacement(scenario, requirement.course.courseVersionId);
      if (
        placement &&
        requirement.course.recommendedTermIndex !== null &&
        placement.term.term.index !== requirement.course.recommendedTermIndex
      ) {
        findings.push({
          code: 'recommended-term-changed',
          severity: 'info',
          title: `${requirement.course.code} moved from its recommended term`,
          detail: `The course is planned in ${placement.term.term.label}; the source roadmap recommends term ${requirement.course.recommendedTermIndex + 1}.`,
          requirementGroupId: requirement.id,
          courseVersionId: requirement.course.courseVersionId,
          termId: placement.term.term.id,
          evidenceRefs: requirement.evidenceRefs,
        });
      }
    }

    if (requirement.kind === 'choose-n') {
      const selectedCount = requirement.options.filter((option) =>
        satisfiedCourseIds.has(option.courseVersionId),
      ).length;
      if (selectedCount < requirement.choose) {
        findings.push({
          code: 'choice-requirement-unmet',
          severity: 'error',
          title: `${requirement.title} is incomplete`,
          detail: `Choose ${requirement.choose}; the current scenario satisfies ${selectedCount}.`,
          requirementGroupId: requirement.id,
          courseVersionId: null,
          termId: null,
          evidenceRefs: requirement.evidenceRefs,
        });
      }
    }

    if (requirement.kind === 'minimum-credits') {
      const eligible = new Set(requirement.eligibleCourseVersionIds);
      let credits = 0;
      for (const term of scenario.terms) {
        for (const course of term.courses) {
          if (eligible.size === 0 || eligible.has(course.courseVersionId))
            credits += course.credits;
        }
      }
      if (credits < requirement.minimumCredits) {
        findings.push({
          code: 'minimum-credits-unmet',
          severity: 'error',
          title: `${requirement.title} is incomplete`,
          detail: `The scenario includes ${credits} of ${requirement.minimumCredits} required credits.`,
          requirementGroupId: requirement.id,
          courseVersionId: null,
          termId: null,
          evidenceRefs: requirement.evidenceRefs,
        });
      }
    }
  }

  const termCredits: Record<string, number> = {};
  for (const term of scenario.terms) {
    const credits = creditsInTerm(term);
    termCredits[term.term.id] = credits;
    if (credits > policy.maximumCreditsPerTerm) {
      findings.push({
        code: 'term-credit-limit-exceeded',
        severity: 'warning',
        title: `${term.term.label} exceeds the workload policy`,
        detail: `${credits} credits are planned; the configured maximum is ${policy.maximumCreditsPerTerm}.`,
        requirementGroupId: null,
        courseVersionId: null,
        termId: term.term.id,
        evidenceRefs: [],
      });
    }
  }

  return {
    totalPlannedCredits: totalPlannedCredits(scenario),
    termCredits,
    findings,
    isFeasible: !findings.some((finding) => finding.severity === 'error'),
  };
};

export const serializeScenario = (scenario: PlanningScenario): string =>
  JSON.stringify(scenario, null, 2);

export const restoreScenario = (serialized: string): PlanningScenario => {
  const parsed = JSON.parse(serialized) as unknown;
  if (typeof parsed === 'object' && parsed !== null && !('schemaVersion' in parsed)) {
    return decodePlanningScenario({ ...parsed, schemaVersion: 1 });
  }
  return decodePlanningScenario(parsed);
};
