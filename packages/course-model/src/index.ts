import * as Schema from 'effect/Schema';

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
const EvidenceIds = Schema.Array(NonEmptyString);
const AttributedEvidenceIds = EvidenceIds.pipe(Schema.minItems(1));

export const EvidenceKindSchema = Schema.Literal('source-fact', 'inference', 'fixture');
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

export const makeFactSchema = <A, I, R>(valueSchema: Schema.Schema<A, I, R>) =>
  Schema.Union(
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
      ).pipe(Schema.minItems(2)),
      evidenceIds: EvidenceIds,
    }),
  );

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

export const CourseLevelSchema = Schema.Literal(
  'bachelor',
  'master',
  'phd',
  'continuing-education',
  'unknown',
);
export type CourseLevel = Schema.Schema.Type<typeof CourseLevelSchema>;

export const SeasonSchema = Schema.Literal('spring', 'summer', 'autumn', 'full-year');
export type Season = Schema.Schema.Type<typeof SeasonSchema>;

export const DeliveryModeSchema = Schema.Literal('in-person', 'online', 'hybrid');
export type DeliveryMode = Schema.Schema.Type<typeof DeliveryModeSchema>;

export const OfferingSchema = Schema.Struct({
  academicYear: Schema.Number.pipe(Schema.int(), Schema.between(2000, 2200)),
  season: SeasonSchema,
  campuses: Schema.Array(NonEmptyString),
  deliveryModes: Schema.Array(DeliveryModeSchema),
});
export type Offering = Schema.Schema.Type<typeof OfferingSchema>;

export const AssessmentFormSchema = Schema.Literal(
  'written-exam',
  'oral-exam',
  'home-exam',
  'project',
  'portfolio',
  'practical',
  'assignment',
  'other',
);
export type AssessmentForm = Schema.Schema.Type<typeof AssessmentFormSchema>;

export const AssessmentPartSchema = Schema.Struct({
  form: AssessmentFormSchema,
  description: NonEmptyString,
  weightPercent: Schema.NullOr(Schema.Number.pipe(Schema.between(0, 100))),
  duration: Schema.NullOr(NonEmptyString),
});
export type AssessmentPart = Schema.Schema.Type<typeof AssessmentPartSchema>;

export const WorkFormSchema = Schema.Literal(
  'lectures',
  'exercises',
  'laboratory',
  'seminar',
  'project',
  'self-study',
  'other',
);
export type WorkForm = Schema.Schema.Type<typeof WorkFormSchema>;

export const CollaborationSchema = Schema.Literal('individual', 'group', 'mixed');
export type Collaboration = Schema.Schema.Type<typeof CollaborationSchema>;

export const AttendanceSchema = Schema.Literal('required', 'not-required');
export type Attendance = Schema.Schema.Type<typeof AttendanceSchema>;

export const OnlineParticipationSchema = Schema.Literal('available', 'not-available');
export type OnlineParticipation = Schema.Schema.Type<typeof OnlineParticipationSchema>;

export const GradeBucketSchema = Schema.Struct({
  grade: NonEmptyString,
  count: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  percentage: Schema.Number.pipe(Schema.between(0, 100)),
});
export type GradeBucket = Schema.Schema.Type<typeof GradeBucketSchema>;

export const GradePeriodSchema = Schema.Struct({
  fromYear: Schema.Number.pipe(Schema.int(), Schema.between(2000, 2200)),
  toYear: Schema.Number.pipe(Schema.int(), Schema.between(2000, 2200)),
});
export type GradePeriod = Schema.Schema.Type<typeof GradePeriodSchema>;

const StringFactSchema = makeFactSchema(NonEmptyString);
const NumberFactSchema = makeFactSchema(Schema.Number);
const PercentageFactSchema = makeFactSchema(Schema.Number.pipe(Schema.between(0, 100)));

export const GradeOutcomesSchema = Schema.Struct({
  period: makeFactSchema(GradePeriodSchema),
  sampleSize: makeFactSchema(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  distribution: makeFactSchema(Schema.Array(GradeBucketSchema)),
  failureRatePercent: PercentageFactSchema,
  averageGrade: StringFactSchema,
  medianGrade: StringFactSchema,
});
export type GradeOutcomes = Schema.Schema.Type<typeof GradeOutcomesSchema>;

export const SourceStatusSchema = Schema.Struct({
  provider: NonEmptyString,
  status: Schema.Literal('available', 'unavailable', 'failed'),
  observedAt: Schema.NullOr(Schema.DateFromString),
  warning: Schema.NullOr(NonEmptyString),
});
export type SourceStatus = Schema.Schema.Type<typeof SourceStatusSchema>;

export const CourseInsightSchema = Schema.Struct({
  courseKey: NonEmptyString,
  institutionCode: Schema.Literal('NTNU'),
  code: NonEmptyString,
  title: StringFactSchema,
  credits: makeFactSchema(Schema.Number.pipe(Schema.between(0, 60))),
  level: makeFactSchema(CourseLevelSchema),
  teachingLanguage: StringFactSchema,
  offerings: makeFactSchema(Schema.Array(OfferingSchema)),
  content: StringFactSchema,
  learningOutcomes: StringFactSchema,
  teachingMethods: StringFactSchema,
  workForms: makeFactSchema(Schema.Array(WorkFormSchema)),
  assessment: makeFactSchema(Schema.Array(AssessmentPartSchema)),
  obligatoryActivities: makeFactSchema(Schema.Array(NonEmptyString)),
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
  credits: makeFactSchema(Schema.Number.pipe(Schema.between(0, 60))),
  level: makeFactSchema(CourseLevelSchema),
  offerings: makeFactSchema(Schema.Array(OfferingSchema)),
  assessmentSignals: makeFactSchema(Schema.Array(AssessmentFormSchema)),
  workFormSignals: makeFactSchema(Schema.Array(WorkFormSchema)),
  enrichment: Schema.Literal('basic', 'enriching', 'enriched', 'partial'),
  evidence: Schema.Array(EvidenceSchema),
});
export type CourseSearchItem = Schema.Schema.Type<typeof CourseSearchItemSchema>;

export const decodeCourseInsight = Schema.decodeUnknownSync(CourseInsightSchema);
export const decodeCourseSearchItem = Schema.decodeUnknownSync(CourseSearchItemSchema);

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
