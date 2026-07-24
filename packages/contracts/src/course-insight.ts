import type {
  CourseDecisionSignals,
  CourseGradeSummary,
  CourseInsight,
  CourseSearchItem,
  Fact,
  Offering,
} from '@course-data/course-model';
import { type Static, type TSchema } from '@sinclair/typebox';
import { t } from 'elysia';

const EvidenceIdsDto = t.Array(t.String({ minLength: 1 }));
const AttributedEvidenceIdsDto = t.Array(t.String({ minLength: 1 }), { minItems: 1 });

const FactDto = <T extends TSchema>(value: T) =>
  t.Union([
    t.Object({
      state: t.Literal('known'),
      value,
      evidenceIds: AttributedEvidenceIdsDto,
    }),
    t.Object({
      state: t.Literal('unknown'),
      reason: t.String({ minLength: 1 }),
      evidenceIds: EvidenceIdsDto,
    }),
    t.Object({
      state: t.Literal('unavailable'),
      reason: t.String({ minLength: 1 }),
      evidenceIds: EvidenceIdsDto,
    }),
    t.Object({
      state: t.Literal('suppressed'),
      reason: t.String({ minLength: 1 }),
      evidenceIds: EvidenceIdsDto,
    }),
    t.Object({
      state: t.Literal('conflicting'),
      reason: t.String({ minLength: 1 }),
      candidates: t.Array(
        t.Object({
          value,
          evidenceIds: AttributedEvidenceIdsDto,
        }),
        { minItems: 2 },
      ),
      evidenceIds: EvidenceIdsDto,
    }),
  ]);

const EvidenceDto = t.Object({
  id: t.String({ minLength: 1 }),
  provider: t.String({ minLength: 1 }),
  kind: t.Union([t.Literal('source-fact'), t.Literal('inference'), t.Literal('fixture')]),
  recordId: t.String({ minLength: 1 }),
  sourceUrl: t.Union([t.String({ minLength: 1 }), t.Null()]),
  sourcePeriod: t.Union([t.String({ minLength: 1 }), t.Null()]),
  observedAt: t.String({ format: 'date-time' }),
  excerpt: t.Union([t.String({ minLength: 1 }), t.Null()]),
  inferenceRule: t.Union([t.String({ minLength: 1 }), t.Null()]),
});

const CourseDecisionLevelDto = t.Union([
  t.Literal('bachelor'),
  t.Literal('master'),
  t.Literal('phd'),
  t.Literal('continuing-education'),
  t.Literal('unknown'),
]);

const OfferingDto = t.Object({
  academicYear: t.Integer({ minimum: 2000, maximum: 2200 }),
  season: t.Union([
    t.Literal('spring'),
    t.Literal('summer'),
    t.Literal('autumn'),
    t.Literal('full-year'),
  ]),
  campuses: t.Array(t.String({ minLength: 1 })),
  deliveryModes: t.Array(
    t.Union([t.Literal('in-person'), t.Literal('online'), t.Literal('hybrid')]),
  ),
});

const AssessmentFormDto = t.Union([
  t.Literal('written-exam'),
  t.Literal('oral-exam'),
  t.Literal('home-exam'),
  t.Literal('project'),
  t.Literal('portfolio'),
  t.Literal('practical'),
  t.Literal('assignment'),
  t.Literal('other'),
]);

const AssessmentRequirementDto = t.Union([
  t.Literal('required'),
  t.Literal('optional'),
  t.Literal('choice'),
  t.Literal('conditional'),
]);

const WorkloadPatternDto = t.Union([
  t.Literal('distributed'),
  t.Literal('concentrated'),
  t.Literal('recurring'),
  t.Literal('milestone'),
]);

const AssessmentPartDto = t.Object({
  form: AssessmentFormDto,
  description: t.String({ minLength: 1 }),
  requirement: FactDto(AssessmentRequirementDto),
  weightPercent: FactDto(t.Number({ exclusiveMinimum: 0, maximum: 100 })),
  duration: FactDto(t.String({ minLength: 1 })),
  workloadPattern: FactDto(WorkloadPatternDto),
});

const ObligatoryActivityDto = t.Object({
  description: t.String({ minLength: 1 }),
  form: FactDto(AssessmentFormDto),
  workloadPattern: FactDto(WorkloadPatternDto),
});

const WorkFormDto = t.Union([
  t.Literal('lectures'),
  t.Literal('exercises'),
  t.Literal('laboratory'),
  t.Literal('seminar'),
  t.Literal('project'),
  t.Literal('self-study'),
  t.Literal('other'),
]);

const GradeBucketDto = t.Object({
  grade: t.String({ minLength: 1 }),
  count: t.Integer({ minimum: 0 }),
  percentage: t.Number({ minimum: 0, maximum: 100 }),
});

const GradeOutcomesDto = t.Object({
  period: FactDto(
    t.Object({
      fromYear: t.Integer({ minimum: 2000, maximum: 2200 }),
      toYear: t.Integer({ minimum: 2000, maximum: 2200 }),
    }),
  ),
  sampleSize: FactDto(t.Integer({ minimum: 0 })),
  distribution: FactDto(t.Array(GradeBucketDto)),
  failureRatePercent: FactDto(t.Number({ minimum: 0, maximum: 100 })),
  averageGrade: FactDto(t.String({ minLength: 1 })),
  medianGrade: FactDto(t.String({ minLength: 1 })),
});

const SourceStatusDto = t.Object({
  provider: t.String({ minLength: 1 }),
  status: t.Union([t.Literal('available'), t.Literal('unavailable'), t.Literal('failed')]),
  observedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
  warning: t.Union([t.String({ minLength: 1 }), t.Null()]),
});

export const CourseSearchQueryDto = t.Object({
  query: t.Optional(t.String({ maxLength: 200 })),
  term: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  sort: t.Optional(
    t.Union([
      t.Literal('relevance'),
      t.Literal('title-asc'),
      t.Literal('title-desc'),
      t.Literal('code-asc'),
      t.Literal('code-desc'),
    ]),
  ),
  campuses: t.Optional(
    t.String({
      pattern: '^(trondheim|gjovik|alesund)(,(trondheim|gjovik|alesund))*$',
    }),
  ),
  levels: t.Optional(
    t.String({
      pattern: '^(bachelor|master|phd|other)(,(bachelor|master|phd|other))*$',
    }),
  ),
  continuingEducation: t.Optional(t.Union([t.Literal('true'), t.Literal('false')])),
  open: t.Optional(t.Union([t.Literal('true'), t.Literal('false')])),
  english: t.Optional(t.Union([t.Literal('true'), t.Literal('false')])),
});

export const CourseSearchItemDto = t.Object({
  courseKey: t.String({ minLength: 1 }),
  institutionCode: t.Literal('NTNU'),
  code: t.String({ minLength: 1 }),
  title: FactDto(t.String({ minLength: 1 })),
  credits: FactDto(t.Number({ minimum: 0, maximum: 60 })),
  level: FactDto(CourseDecisionLevelDto),
  offerings: FactDto(t.Array(OfferingDto)),
  assessmentSignals: FactDto(t.Array(AssessmentFormDto)),
  workFormSignals: FactDto(t.Array(WorkFormDto)),
  enrichment: t.Union([
    t.Literal('basic'),
    t.Literal('enriching'),
    t.Literal('enriched'),
    t.Literal('partial'),
  ]),
  evidence: t.Array(EvidenceDto),
});

export const CourseSearchResponseDto = t.Object({
  items: t.Array(CourseSearchItemDto),
  sourceStatuses: t.Array(SourceStatusDto),
  meta: t.Object({
    count: t.Integer({ minimum: 0 }),
    total: t.Integer({ minimum: 0 }),
    page: t.Integer({ minimum: 1 }),
    pageSize: t.Integer({ minimum: 1 }),
    hasMore: t.Boolean(),
    exactMatchCode: t.Union([t.String({ minLength: 1 }), t.Null()]),
  }),
});

export const CourseGradeSummariesRequestDto = t.Object({
  courseCodes: t.Array(
    t.String({
      minLength: 2,
      maxLength: 20,
      pattern: '^[A-Za-zÆØÅæøå0-9]+$',
    }),
    { minItems: 1, maxItems: 40, uniqueItems: true },
  ),
});

export const CourseGradeSummaryDto = t.Object({
  courseCode: t.String({ minLength: 2, maxLength: 20 }),
  period: FactDto(
    t.Object({
      fromYear: t.Integer({ minimum: 2000, maximum: 2200 }),
      toYear: t.Integer({ minimum: 2000, maximum: 2200 }),
    }),
  ),
  sampleSize: FactDto(t.Integer({ minimum: 0 })),
  distribution: FactDto(t.Array(GradeBucketDto)),
  failureRatePercent: FactDto(t.Number({ minimum: 0, maximum: 100 })),
  gradingScale: FactDto(t.Union([t.Literal('letter'), t.Literal('pass-fail'), t.Literal('mixed')])),
  evidence: t.Array(EvidenceDto),
});

export const CourseGradeSummariesResponseDto = t.Object({
  items: t.Array(CourseGradeSummaryDto),
  sourceStatuses: t.Array(SourceStatusDto),
  meta: t.Object({
    count: t.Integer({ minimum: 0 }),
    fromYear: t.Integer({ minimum: 2000, maximum: 2200 }),
    toYear: t.Integer({ minimum: 2000, maximum: 2200 }),
  }),
});

export const CourseDecisionSignalsRequestDto = t.Object({
  courseCodes: t.Array(
    t.String({
      minLength: 2,
      maxLength: 20,
      pattern: '^[A-Za-zÆØÅæøå0-9]+$',
    }),
    { minItems: 1, maxItems: 40, uniqueItems: true },
  ),
  term: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
});

export const CourseDecisionSignalsDto = t.Object({
  courseCode: t.String({ minLength: 2, maxLength: 20 }),
  credits: FactDto(t.Number({ minimum: 0, maximum: 60 })),
  assessment: FactDto(t.Array(AssessmentPartDto)),
  workFormSignals: FactDto(t.Array(WorkFormDto)),
  obligatoryActivities: FactDto(t.Array(ObligatoryActivityDto)),
  collaboration: FactDto(
    t.Union([t.Literal('individual'), t.Literal('group'), t.Literal('mixed')]),
  ),
  attendance: FactDto(t.Union([t.Literal('required'), t.Literal('not-required')])),
  onlineParticipation: FactDto(t.Union([t.Literal('available'), t.Literal('not-available')])),
  sourceStatus: SourceStatusDto,
  evidence: t.Array(EvidenceDto),
});

export const CourseDecisionSignalsResponseDto = t.Object({
  items: t.Array(CourseDecisionSignalsDto),
  meta: t.Object({
    count: t.Integer({ minimum: 0 }),
  }),
});

export const CourseInsightParamsDto = t.Object({
  courseCode: t.String({ minLength: 2, maxLength: 20 }),
});

export const CourseInsightQueryDto = t.Object({
  term: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
});

export const CourseInsightDto = t.Object({
  courseKey: t.String({ minLength: 1 }),
  institutionCode: t.Literal('NTNU'),
  code: t.String({ minLength: 1 }),
  title: FactDto(t.String({ minLength: 1 })),
  credits: FactDto(t.Number({ minimum: 0, maximum: 60 })),
  level: FactDto(CourseDecisionLevelDto),
  teachingLanguage: FactDto(t.String({ minLength: 1 })),
  offerings: FactDto(t.Array(OfferingDto)),
  content: FactDto(t.String({ minLength: 1 })),
  learningOutcomes: FactDto(t.String({ minLength: 1 })),
  teachingMethods: FactDto(t.String({ minLength: 1 })),
  workForms: FactDto(t.Array(WorkFormDto)),
  assessment: FactDto(t.Array(AssessmentPartDto)),
  obligatoryActivities: FactDto(t.Array(ObligatoryActivityDto)),
  collaboration: FactDto(
    t.Union([t.Literal('individual'), t.Literal('group'), t.Literal('mixed')]),
  ),
  attendance: FactDto(t.Union([t.Literal('required'), t.Literal('not-required')])),
  onlineParticipation: FactDto(t.Union([t.Literal('available'), t.Literal('not-available')])),
  prerequisites: FactDto(t.String({ minLength: 1 })),
  accessRestrictions: FactDto(t.String({ minLength: 1 })),
  gradeOutcomes: GradeOutcomesDto,
  sourceStatuses: t.Array(SourceStatusDto),
  evidence: t.Array(EvidenceDto),
});

export const CourseInsightResponseDto = t.Object({
  item: CourseInsightDto,
  meta: t.Object({
    partial: t.Boolean(),
  }),
});

export type CourseSearchQueryDtoType = Static<typeof CourseSearchQueryDto>;
export type CourseSearchItemDtoType = Static<typeof CourseSearchItemDto>;
export type CourseSearchResponseDtoType = Static<typeof CourseSearchResponseDto>;
export type CourseGradeSummariesRequestDtoType = Static<typeof CourseGradeSummariesRequestDto>;
export type CourseGradeSummaryDtoType = Static<typeof CourseGradeSummaryDto>;
export type CourseGradeSummariesResponseDtoType = Static<typeof CourseGradeSummariesResponseDto>;
export type CourseDecisionSignalsRequestDtoType = Static<typeof CourseDecisionSignalsRequestDto>;
export type CourseDecisionSignalsDtoType = Static<typeof CourseDecisionSignalsDto>;
export type CourseDecisionSignalsResponseDtoType = Static<typeof CourseDecisionSignalsResponseDto>;
export type CourseInsightParamsDtoType = Static<typeof CourseInsightParamsDto>;
export type CourseInsightQueryDtoType = Static<typeof CourseInsightQueryDto>;
export type CourseInsightDtoType = Static<typeof CourseInsightDto>;
export type CourseInsightResponseDtoType = Static<typeof CourseInsightResponseDto>;

type ProtocolFact<A> =
  | {
      state: 'known';
      value: A;
      evidenceIds: string[];
    }
  | {
      state: 'unknown' | 'unavailable' | 'suppressed';
      reason: string;
      evidenceIds: string[];
    }
  | {
      state: 'conflicting';
      reason: string;
      candidates: Array<{ value: A; evidenceIds: string[] }>;
      evidenceIds: string[];
    };

const mapFact = <A, B>(fact: Fact<A>, mapValue: (value: A) => B): ProtocolFact<B> => {
  if (fact.state === 'known') {
    return {
      state: 'known',
      value: mapValue(fact.value),
      evidenceIds: [...fact.evidenceIds],
    };
  }
  if (fact.state === 'conflicting') {
    return {
      state: 'conflicting',
      reason: fact.reason,
      candidates: fact.candidates.map((candidate) => ({
        value: mapValue(candidate.value),
        evidenceIds: [...candidate.evidenceIds],
      })),
      evidenceIds: [...fact.evidenceIds],
    };
  }
  return {
    state: fact.state,
    reason: fact.reason,
    evidenceIds: [...fact.evidenceIds],
  };
};

const mapEvidence = (evidence: CourseInsight['evidence'][number]) => ({
  ...evidence,
  observedAt: evidence.observedAt.toISOString(),
});

const mapSourceStatus = (sourceStatus: CourseInsight['sourceStatuses'][number]) => ({
  ...sourceStatus,
  observedAt: sourceStatus.observedAt?.toISOString() ?? null,
});

const mapOffering = (offering: Offering) => ({
  ...offering,
  campuses: [...offering.campuses],
  deliveryModes: [...offering.deliveryModes],
});

const mapAssessmentPart = (
  part: CourseInsight['assessment'] extends Fact<ReadonlyArray<infer A>> ? A : never,
) => ({
  ...part,
  requirement: mapFact(part.requirement, (requirement) => requirement),
  weightPercent: mapFact(part.weightPercent, Number),
  duration: mapFact(part.duration, String),
  workloadPattern: mapFact(part.workloadPattern, (pattern) => pattern),
});

const mapObligatoryActivity = (
  activity: CourseInsight['obligatoryActivities'] extends Fact<ReadonlyArray<infer A>> ? A : never,
) => ({
  ...activity,
  form: mapFact(activity.form, (form) => form),
  workloadPattern: mapFact(activity.workloadPattern, (pattern) => pattern),
});

export const toCourseSearchItemDto = (item: CourseSearchItem): CourseSearchItemDtoType => ({
  courseKey: item.courseKey,
  institutionCode: item.institutionCode,
  code: item.code,
  title: mapFact(item.title, String),
  credits: mapFact(item.credits, Number),
  level: mapFact(item.level, (level) => level),
  offerings: mapFact(item.offerings, (offerings) => offerings.map(mapOffering)),
  assessmentSignals: mapFact(item.assessmentSignals, (signals) => [...signals]),
  workFormSignals: mapFact(item.workFormSignals, (signals) => [...signals]),
  enrichment: item.enrichment,
  evidence: item.evidence.map(mapEvidence),
});

export const toCourseGradeSummaryDto = (
  summary: CourseGradeSummary,
): CourseGradeSummaryDtoType => ({
  courseCode: summary.courseCode,
  period: mapFact(summary.period, (period) => period),
  sampleSize: mapFact(summary.sampleSize, Number),
  distribution: mapFact(summary.distribution, (distribution) =>
    distribution.map((bucket) => ({ ...bucket })),
  ),
  failureRatePercent: mapFact(summary.failureRatePercent, Number),
  gradingScale: mapFact(summary.gradingScale, (scale) => scale),
  evidence: summary.evidence.map(mapEvidence),
});

export const toCourseDecisionSignalsDto = (
  signals: CourseDecisionSignals,
): CourseDecisionSignalsDtoType => ({
  courseCode: signals.courseCode,
  credits: mapFact(signals.credits, Number),
  assessment: mapFact(signals.assessment, (assessment) => assessment.map(mapAssessmentPart)),
  workFormSignals: mapFact(signals.workFormSignals, (forms) => [...forms]),
  obligatoryActivities: mapFact(signals.obligatoryActivities, (activities) =>
    activities.map(mapObligatoryActivity),
  ),
  collaboration: mapFact(signals.collaboration, (collaboration) => collaboration),
  attendance: mapFact(signals.attendance, (attendance) => attendance),
  onlineParticipation: mapFact(signals.onlineParticipation, (availability) => availability),
  sourceStatus: {
    ...signals.sourceStatus,
    observedAt: signals.sourceStatus.observedAt?.toISOString() ?? null,
  },
  evidence: signals.evidence.map(mapEvidence),
});

export const toCourseInsightDto = (insight: CourseInsight): CourseInsightDtoType => ({
  ...insight,
  title: mapFact(insight.title, String),
  credits: mapFact(insight.credits, Number),
  level: mapFact(insight.level, (level) => level),
  teachingLanguage: mapFact(insight.teachingLanguage, String),
  offerings: mapFact(insight.offerings, (offerings) => offerings.map(mapOffering)),
  content: mapFact(insight.content, String),
  learningOutcomes: mapFact(insight.learningOutcomes, String),
  teachingMethods: mapFact(insight.teachingMethods, String),
  workForms: mapFact(insight.workForms, (workForms) => [...workForms]),
  assessment: mapFact(insight.assessment, (assessment) => assessment.map(mapAssessmentPart)),
  obligatoryActivities: mapFact(insight.obligatoryActivities, (activities) =>
    activities.map(mapObligatoryActivity),
  ),
  collaboration: mapFact(insight.collaboration, (collaboration) => collaboration),
  attendance: mapFact(insight.attendance, (attendance) => attendance),
  onlineParticipation: mapFact(insight.onlineParticipation, (availability) => availability),
  prerequisites: mapFact(insight.prerequisites, String),
  accessRestrictions: mapFact(insight.accessRestrictions, String),
  gradeOutcomes: {
    period: mapFact(insight.gradeOutcomes.period, (period) => period),
    sampleSize: mapFact(insight.gradeOutcomes.sampleSize, Number),
    distribution: mapFact(insight.gradeOutcomes.distribution, (distribution) =>
      distribution.map((bucket) => ({ ...bucket })),
    ),
    failureRatePercent: mapFact(insight.gradeOutcomes.failureRatePercent, Number),
    averageGrade: mapFact(insight.gradeOutcomes.averageGrade, String),
    medianGrade: mapFact(insight.gradeOutcomes.medianGrade, String),
  },
  sourceStatuses: insight.sourceStatuses.map(mapSourceStatus),
  evidence: insight.evidence.map(mapEvidence),
});
