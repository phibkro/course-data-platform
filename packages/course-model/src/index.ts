import * as Schema from 'effect/Schema';

const NonEmptyString = Schema.NonEmptyString;
const EvidenceIds = Schema.Array(NonEmptyString);
const AttributedEvidenceIds = EvidenceIds.pipe(Schema.check(Schema.isMinLength(1)));

export const EvidenceKindSchema = Schema.Literals(['source-fact', 'inference', 'fixture']);
export type EvidenceKind = Schema.Schema.Type<typeof EvidenceKindSchema>;

export const EvidenceSchema = Schema.Struct({
  id: NonEmptyString,
  provider: NonEmptyString,
  kind: EvidenceKindSchema,
  recordId: NonEmptyString,
  sourceUrl: Schema.NullOr(NonEmptyString),
  sourcePeriod: Schema.NullOr(NonEmptyString),
  observedAt: Schema.DateFromString,
  excerpt: Schema.NullOr(NonEmptyString),
  inferenceRule: Schema.NullOr(NonEmptyString),
});
export type Evidence = Schema.Schema.Type<typeof EvidenceSchema>;

export const makeFactSchema = <S extends Schema.Constraint>(valueSchema: S) =>
  Schema.Union([
    Schema.Struct({
      state: Schema.Literal('known'),
      value: valueSchema,
      evidenceIds: AttributedEvidenceIds,
    }),
    Schema.Struct({
      state: Schema.Literal('unknown'),
      reason: NonEmptyString,
      evidenceIds: EvidenceIds,
    }),
    Schema.Struct({
      state: Schema.Literal('unavailable'),
      reason: NonEmptyString,
      evidenceIds: EvidenceIds,
    }),
    Schema.Struct({
      state: Schema.Literal('suppressed'),
      reason: NonEmptyString,
      evidenceIds: EvidenceIds,
    }),
    Schema.Struct({
      state: Schema.Literal('conflicting'),
      reason: NonEmptyString,
      candidates: Schema.Array(
        Schema.Struct({
          value: valueSchema,
          evidenceIds: AttributedEvidenceIds,
        }),
      ).pipe(Schema.check(Schema.isMinLength(2))),
      evidenceIds: EvidenceIds,
    }),
  ]);

export type Fact<A> =
  | {
      readonly state: 'known';
      readonly value: A;
      readonly evidenceIds: ReadonlyArray<string>;
    }
  | {
      readonly state: 'unknown' | 'unavailable' | 'suppressed';
      readonly reason: string;
      readonly evidenceIds: ReadonlyArray<string>;
    }
  | {
      readonly state: 'conflicting';
      readonly reason: string;
      readonly candidates: ReadonlyArray<{
        readonly value: A;
        readonly evidenceIds: ReadonlyArray<string>;
      }>;
      readonly evidenceIds: ReadonlyArray<string>;
    };

export const CourseLevelSchema = Schema.Literals([
  'bachelor',
  'master',
  'phd',
  'continuing-education',
  'unknown',
]);
export type CourseLevel = Schema.Schema.Type<typeof CourseLevelSchema>;

export const SeasonSchema = Schema.Literals(['spring', 'summer', 'autumn', 'full-year']);
export type Season = Schema.Schema.Type<typeof SeasonSchema>;

export const DeliveryModeSchema = Schema.Literals(['in-person', 'online', 'hybrid']);
export type DeliveryMode = Schema.Schema.Type<typeof DeliveryModeSchema>;

export const OfferingSchema = Schema.Struct({
  academicYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  season: SeasonSchema,
  campuses: Schema.Array(NonEmptyString),
  deliveryModes: Schema.Array(DeliveryModeSchema),
});
export type Offering = Schema.Schema.Type<typeof OfferingSchema>;

export const AssessmentFormSchema = Schema.Literals([
  'written-exam',
  'oral-exam',
  'home-exam',
  'project',
  'portfolio',
  'practical',
  'assignment',
  'other',
]);
export type AssessmentForm = Schema.Schema.Type<typeof AssessmentFormSchema>;

export const AssessmentRequirementSchema = Schema.Literals([
  'required',
  'optional',
  'choice',
  'conditional',
]);
export type AssessmentRequirement = Schema.Schema.Type<typeof AssessmentRequirementSchema>;

export const WorkloadPatternSchema = Schema.Literals([
  'distributed',
  'concentrated',
  'recurring',
  'milestone',
]);
export type WorkloadPattern = Schema.Schema.Type<typeof WorkloadPatternSchema>;

export const AssessmentPartSchema = Schema.Struct({
  form: AssessmentFormSchema,
  description: NonEmptyString,
  requirement: makeFactSchema(AssessmentRequirementSchema),
  weightPercent: makeFactSchema(
    Schema.Number.pipe(
      Schema.check(Schema.isGreaterThan(0)),
      Schema.check(Schema.isLessThanOrEqualTo(100)),
    ),
  ),
  duration: makeFactSchema(NonEmptyString),
  workloadPattern: makeFactSchema(WorkloadPatternSchema),
});
export type AssessmentPart = Schema.Schema.Type<typeof AssessmentPartSchema>;

export const ObligatoryActivitySchema = Schema.Struct({
  description: NonEmptyString,
  form: makeFactSchema(AssessmentFormSchema),
  workloadPattern: makeFactSchema(WorkloadPatternSchema),
});
export type ObligatoryActivity = Schema.Schema.Type<typeof ObligatoryActivitySchema>;

export type AssessmentStructureFinding = {
  readonly code: 'optional-weighted-assessment' | 'assessment-weights-do-not-total-100';
  readonly path: string;
  readonly message: string;
};

/**
 * Assessment parts are graded contributions. Obligatory activities are a
 * separate type: required, approved/not-approved gates with no grade weight.
 * This evaluator therefore only needs to reject illegal states that can still
 * be expressed by partially known provider data.
 */
export const validateAssessmentStructure = (
  assessment: ReadonlyArray<AssessmentPart>,
): ReadonlyArray<AssessmentStructureFinding> => {
  const findings: Array<AssessmentStructureFinding> = [];

  assessment.forEach((part, index) => {
    if (
      part.requirement.state === 'known' &&
      part.requirement.value === 'optional' &&
      part.weightPercent.state === 'known'
    ) {
      findings.push({
        code: 'optional-weighted-assessment',
        path: `assessment[${index}]`,
        message: 'An optional course-work item cannot contribute to the final grade.',
      });
    }
  });

  if (
    assessment.length > 0 &&
    assessment.every(
      (part) =>
        part.requirement.state === 'known' &&
        part.requirement.value === 'required' &&
        part.weightPercent.state === 'known',
    )
  ) {
    const total = assessment.reduce(
      (sum, part) => sum + (part.weightPercent.state === 'known' ? part.weightPercent.value : 0),
      0,
    );
    if (Math.abs(total - 100) > 0.001) {
      findings.push({
        code: 'assessment-weights-do-not-total-100',
        path: 'assessment',
        message: `Required assessment weights total ${total}%, not 100%.`,
      });
    }
  }

  return findings;
};

export const WorkFormSchema = Schema.Literals([
  'lectures',
  'exercises',
  'laboratory',
  'seminar',
  'project',
  'self-study',
  'other',
]);
export type WorkForm = Schema.Schema.Type<typeof WorkFormSchema>;

export const CollaborationSchema = Schema.Literals(['individual', 'group', 'mixed']);
export type Collaboration = Schema.Schema.Type<typeof CollaborationSchema>;

export const AttendanceSchema = Schema.Literals(['required', 'not-required']);
export type Attendance = Schema.Schema.Type<typeof AttendanceSchema>;

export const OnlineParticipationSchema = Schema.Literals(['available', 'not-available']);
export type OnlineParticipation = Schema.Schema.Type<typeof OnlineParticipationSchema>;

export const GradeBucketSchema = Schema.Struct({
  grade: NonEmptyString,
  count: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  percentage: Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 100 }))),
});
export type GradeBucket = Schema.Schema.Type<typeof GradeBucketSchema>;

export const GradePeriodSchema = Schema.Struct({
  fromYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  toYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
});
export type GradePeriod = Schema.Schema.Type<typeof GradePeriodSchema>;

export const GradingScaleSchema = Schema.Literals(['letter', 'pass-fail', 'mixed']);
export type GradingScale = Schema.Schema.Type<typeof GradingScaleSchema>;

const StringFactSchema = makeFactSchema(NonEmptyString);
const PercentageFactSchema = makeFactSchema(
  Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 100 }))),
);

export const GradeOutcomesSchema = Schema.Struct({
  period: makeFactSchema(GradePeriodSchema),
  sampleSize: makeFactSchema(Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))),
  distribution: makeFactSchema(Schema.Array(GradeBucketSchema)),
  failureRatePercent: PercentageFactSchema,
  averageGrade: StringFactSchema,
  medianGrade: StringFactSchema,
});
export type GradeOutcomes = Schema.Schema.Type<typeof GradeOutcomesSchema>;

export const CourseGradeSummarySchema = Schema.Struct({
  courseCode: NonEmptyString,
  period: makeFactSchema(GradePeriodSchema),
  sampleSize: makeFactSchema(Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))),
  distribution: makeFactSchema(Schema.Array(GradeBucketSchema)),
  failureRatePercent: PercentageFactSchema,
  gradingScale: makeFactSchema(GradingScaleSchema),
  evidence: Schema.Array(EvidenceSchema),
});
export type CourseGradeSummary = Schema.Schema.Type<typeof CourseGradeSummarySchema>;

export const SourceStatusSchema = Schema.Struct({
  provider: NonEmptyString,
  status: Schema.Literals(['available', 'unavailable', 'failed']),
  observedAt: Schema.NullOr(Schema.DateFromString),
  warning: Schema.NullOr(NonEmptyString),
});
export type SourceStatus = Schema.Schema.Type<typeof SourceStatusSchema>;

export const CourseInsightSchema = Schema.Struct({
  courseKey: NonEmptyString,
  institutionCode: Schema.Literal('NTNU'),
  code: NonEmptyString,
  title: StringFactSchema,
  credits: makeFactSchema(
    Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 60 }))),
  ),
  level: makeFactSchema(CourseLevelSchema),
  teachingLanguage: StringFactSchema,
  offerings: makeFactSchema(Schema.Array(OfferingSchema)),
  content: StringFactSchema,
  learningOutcomes: StringFactSchema,
  teachingMethods: StringFactSchema,
  workForms: makeFactSchema(Schema.Array(WorkFormSchema)),
  assessment: makeFactSchema(Schema.Array(AssessmentPartSchema)),
  obligatoryActivities: makeFactSchema(Schema.Array(ObligatoryActivitySchema)),
  collaboration: makeFactSchema(CollaborationSchema),
  attendance: makeFactSchema(AttendanceSchema),
  onlineParticipation: makeFactSchema(OnlineParticipationSchema),
  prerequisites: StringFactSchema,
  accessRestrictions: StringFactSchema,
  gradeOutcomes: GradeOutcomesSchema,
  sourceStatuses: Schema.Array(SourceStatusSchema),
  evidence: Schema.Array(EvidenceSchema),
});
export type CourseInsight = Schema.Schema.Type<typeof CourseInsightSchema>;

export const CourseSearchItemSchema = Schema.Struct({
  courseKey: NonEmptyString,
  institutionCode: Schema.Literal('NTNU'),
  code: NonEmptyString,
  title: StringFactSchema,
  credits: makeFactSchema(
    Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 60 }))),
  ),
  level: makeFactSchema(CourseLevelSchema),
  offerings: makeFactSchema(Schema.Array(OfferingSchema)),
  assessmentSignals: makeFactSchema(Schema.Array(AssessmentFormSchema)),
  workFormSignals: makeFactSchema(Schema.Array(WorkFormSchema)),
  enrichment: Schema.Literals(['basic', 'enriching', 'enriched', 'partial']),
  evidence: Schema.Array(EvidenceSchema),
});
export type CourseSearchItem = Schema.Schema.Type<typeof CourseSearchItemSchema>;

export const CourseDecisionSignalsSchema = Schema.Struct({
  courseCode: NonEmptyString,
  assessment: makeFactSchema(Schema.Array(AssessmentPartSchema)),
  workFormSignals: makeFactSchema(Schema.Array(WorkFormSchema)),
  obligatoryActivities: makeFactSchema(Schema.Array(ObligatoryActivitySchema)),
  collaboration: makeFactSchema(CollaborationSchema),
  attendance: makeFactSchema(AttendanceSchema),
  onlineParticipation: makeFactSchema(OnlineParticipationSchema),
  sourceStatus: SourceStatusSchema,
  evidence: Schema.Array(EvidenceSchema),
});
export type CourseDecisionSignals = Schema.Schema.Type<typeof CourseDecisionSignalsSchema>;

const decodeCourseInsightSchema = Schema.decodeUnknownSync(CourseInsightSchema);
export const decodeCourseSearchItem = Schema.decodeUnknownSync(CourseSearchItemSchema);
export const decodeCourseGradeSummary = Schema.decodeUnknownSync(CourseGradeSummarySchema);
const decodeCourseDecisionSignalsSchema = Schema.decodeUnknownSync(CourseDecisionSignalsSchema);

const assertValidAssessmentStructure = (assessment: Fact<ReadonlyArray<AssessmentPart>>): void => {
  if (assessment.state !== 'known') return;
  const findings = validateAssessmentStructure(assessment.value);
  if (findings.length === 0) return;
  throw new TypeError(findings.map((finding) => `${finding.path}: ${finding.message}`).join('\n'));
};

export const decodeCourseInsight = (input: unknown): CourseInsight => {
  const insight = decodeCourseInsightSchema(input);
  assertValidAssessmentStructure(insight.assessment);
  return insight;
};

export const decodeCourseDecisionSignals = (input: unknown): CourseDecisionSignals => {
  const signals = decodeCourseDecisionSignalsSchema(input);
  assertValidAssessmentStructure(signals.assessment);
  return signals;
};

export const validateEvidenceReferences = (
  insight: CourseInsight,
): ReadonlyArray<{ readonly path: string; readonly evidenceId: string }> => {
  const availableIds = new Set(insight.evidence.map((item) => item.id));
  const missing: Array<{ path: string; evidenceId: string }> = [];

  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (value === null || typeof value !== 'object' || value instanceof Date) return;

    for (const [key, child] of Object.entries(value)) {
      if (key === 'evidenceIds' && Array.isArray(child)) {
        child.forEach((evidenceId) => {
          if (typeof evidenceId === 'string' && !availableIds.has(evidenceId)) {
            missing.push({ path: `${path}.${key}`, evidenceId });
          }
        });
      } else if (key !== 'evidence') {
        visit(child, `${path}.${key}`);
      }
    }
  };

  visit(insight, '$');
  return missing;
};

export const known = <A>(
  value: A,
  evidenceIds: readonly [string, ...ReadonlyArray<string>],
): Fact<A> => ({
  state: 'known',
  value,
  evidenceIds,
});

export const unknown = <A>(reason: string, evidenceIds: ReadonlyArray<string> = []): Fact<A> => ({
  state: 'unknown',
  reason,
  evidenceIds,
});

export const unavailable = <A>(
  reason: string,
  evidenceIds: ReadonlyArray<string> = [],
): Fact<A> => ({
  state: 'unavailable',
  reason,
  evidenceIds,
});

export const suppressed = <A>(
  reason: string,
  evidenceIds: ReadonlyArray<string> = [],
): Fact<A> => ({
  state: 'suppressed',
  reason,
  evidenceIds,
});
