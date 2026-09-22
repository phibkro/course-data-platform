import { Type, type Static, type TSchema } from '@sinclair/typebox';

const EvidenceIdsDto = Type.Array(Type.String({ minLength: 1 }));
const AttributedEvidenceIdsDto = Type.Array(Type.String({ minLength: 1 }), { minItems: 1 });
const DateTimeStringDto = Type.String({
  pattern:
    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:[.][0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$',
});

const FactDto = <T extends TSchema>(value: T) =>
  Type.Union([
    Type.Object({
      state: Type.Literal('known'),
      value,
      evidenceIds: AttributedEvidenceIdsDto,
    }),
    Type.Object({
      state: Type.Literal('unknown'),
      reason: Type.String({ minLength: 1 }),
      evidenceIds: EvidenceIdsDto,
    }),
    Type.Object({
      state: Type.Literal('unavailable'),
      reason: Type.String({ minLength: 1 }),
      evidenceIds: EvidenceIdsDto,
    }),
    Type.Object({
      state: Type.Literal('suppressed'),
      reason: Type.String({ minLength: 1 }),
      evidenceIds: EvidenceIdsDto,
    }),
    Type.Object({
      state: Type.Literal('conflicting'),
      reason: Type.String({ minLength: 1 }),
      candidates: Type.Array(
        Type.Object({
          value,
          evidenceIds: AttributedEvidenceIdsDto,
        }),
        { minItems: 2 },
      ),
      evidenceIds: EvidenceIdsDto,
    }),
  ]);

const EvidenceDto = Type.Object({
  id: Type.String({ minLength: 1 }),
  provider: Type.String({ minLength: 1 }),
  kind: Type.Union([
    Type.Literal('source-fact'),
    Type.Literal('inference'),
    Type.Literal('fixture'),
  ]),
  recordId: Type.String({ minLength: 1 }),
  sourceUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  sourcePeriod: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  observedAt: DateTimeStringDto,
  excerpt: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  inferenceRule: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

const CourseDecisionLevelDto = Type.Union([
  Type.Literal('bachelor'),
  Type.Literal('master'),
  Type.Literal('phd'),
  Type.Literal('continuing-education'),
  Type.Literal('unknown'),
]);

const OfferingDto = Type.Object({
  academicYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
  season: Type.Union([
    Type.Literal('spring'),
    Type.Literal('summer'),
    Type.Literal('autumn'),
    Type.Literal('full-year'),
  ]),
  campuses: Type.Array(Type.String({ minLength: 1 })),
  deliveryModes: Type.Array(
    Type.Union([Type.Literal('in-person'), Type.Literal('online'), Type.Literal('hybrid')]),
  ),
});

const AssessmentFormDto = Type.Union([
  Type.Literal('written-exam'),
  Type.Literal('oral-exam'),
  Type.Literal('home-exam'),
  Type.Literal('project'),
  Type.Literal('portfolio'),
  Type.Literal('practical'),
  Type.Literal('assignment'),
  Type.Literal('other'),
]);

const AssessmentRequirementDto = Type.Union([
  Type.Literal('required'),
  Type.Literal('optional'),
  Type.Literal('choice'),
  Type.Literal('conditional'),
]);

const WorkloadPatternDto = Type.Union([
  Type.Literal('distributed'),
  Type.Literal('concentrated'),
  Type.Literal('recurring'),
  Type.Literal('milestone'),
]);

const AssessmentPartDto = Type.Object({
  form: AssessmentFormDto,
  description: Type.String({ minLength: 1 }),
  requirement: FactDto(AssessmentRequirementDto),
  weightPercent: FactDto(Type.Number({ exclusiveMinimum: 0, maximum: 100 })),
  duration: FactDto(Type.String({ minLength: 1 })),
  workloadPattern: FactDto(WorkloadPatternDto),
});

const ObligatoryActivityDto = Type.Object({
  description: Type.String({ minLength: 1 }),
  form: FactDto(AssessmentFormDto),
  workloadPattern: FactDto(WorkloadPatternDto),
});

const WorkFormDto = Type.Union([
  Type.Literal('lectures'),
  Type.Literal('exercises'),
  Type.Literal('laboratory'),
  Type.Literal('seminar'),
  Type.Literal('project'),
  Type.Literal('self-study'),
  Type.Literal('other'),
]);

const GradeBucketDto = Type.Object({
  grade: Type.String({ minLength: 1 }),
  count: Type.Integer({ minimum: 0 }),
  percentage: Type.Number({ minimum: 0, maximum: 100 }),
});

const GradeOutcomesDto = Type.Object({
  period: FactDto(
    Type.Object({
      fromYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
      toYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
    }),
  ),
  sampleSize: FactDto(Type.Integer({ minimum: 0 })),
  distribution: FactDto(Type.Array(GradeBucketDto)),
  failureRatePercent: FactDto(Type.Number({ minimum: 0, maximum: 100 })),
  averageGrade: FactDto(Type.String({ minLength: 1 })),
  medianGrade: FactDto(Type.String({ minLength: 1 })),
});

const ExamParticipationDto = Type.Object({
  period: FactDto(
    Type.Object({
      fromYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
      toYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
    }),
  ),
  registered: FactDto(Type.Integer({ minimum: 0 })),
  attended: FactDto(Type.Integer({ minimum: 0 })),
  passed: FactDto(Type.Integer({ minimum: 0 })),
  failed: FactDto(Type.Integer({ minimum: 0 })),
  passedAfterRepeat: FactDto(Type.Integer({ minimum: 0 })),
});

export const SourceStatusDto = Type.Object({
  provider: Type.String({ minLength: 1 }),
  status: Type.Union([
    Type.Literal('available'),
    Type.Literal('unavailable'),
    Type.Literal('failed'),
  ]),
  observedAt: Type.Union([DateTimeStringDto, Type.Null()]),
  warning: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

export const ProblemDto = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer(),
  detail: Type.String(),
  requestId: Type.String(),
});

export const CourseSearchQueryDto = Type.Object({
  query: Type.Optional(Type.String({ maxLength: 200 })),
  term: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
  page: Type.Optional(Type.Number({ minimum: 1, maximum: 100, multipleOf: 1 })),
  sort: Type.Optional(
    Type.Union([
      Type.Literal('relevance'),
      Type.Literal('title-asc'),
      Type.Literal('title-desc'),
      Type.Literal('code-asc'),
      Type.Literal('code-desc'),
    ]),
  ),
  campuses: Type.Optional(
    Type.String({
      pattern: '^(trondheim|gjovik|alesund)(,(trondheim|gjovik|alesund))*$',
    }),
  ),
  levels: Type.Optional(
    Type.String({
      pattern: '^(bachelor|master|phd|other)(,(bachelor|master|phd|other))*$',
    }),
  ),
  continuingEducation: Type.Optional(Type.Union([Type.Literal('true'), Type.Literal('false')])),
  open: Type.Optional(Type.Union([Type.Literal('true'), Type.Literal('false')])),
  english: Type.Optional(Type.Union([Type.Literal('true'), Type.Literal('false')])),
});

export const CourseSearchPageSize = 20;

export const CourseSearchItemDto = Type.Object({
  courseKey: Type.String({ minLength: 1 }),
  institutionCode: Type.Literal('NTNU'),
  code: Type.String({ minLength: 1 }),
  title: FactDto(Type.String({ minLength: 1 })),
  credits: FactDto(Type.Number({ minimum: 0, maximum: 60 })),
  level: FactDto(CourseDecisionLevelDto),
  offerings: FactDto(Type.Array(OfferingDto)),
  assessmentSignals: FactDto(Type.Array(AssessmentFormDto)),
  workFormSignals: FactDto(Type.Array(WorkFormDto)),
  enrichment: Type.Union([
    Type.Literal('basic'),
    Type.Literal('enriching'),
    Type.Literal('enriched'),
    Type.Literal('partial'),
  ]),
  evidence: Type.Array(EvidenceDto),
});

export const CourseSearchResponseDto = Type.Object({
  items: Type.Array(CourseSearchItemDto, { maxItems: CourseSearchPageSize }),
  sourceStatuses: Type.Array(SourceStatusDto),
  meta: Type.Object({
    count: Type.Integer({ minimum: 0 }),
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1 }),
    pageSize: Type.Literal(CourseSearchPageSize),
    hasMore: Type.Boolean(),
    exactMatchCode: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  }),
});

export const CourseGradeSummariesRequestDto = Type.Object({
  courseCodes: Type.Array(
    Type.String({
      minLength: 2,
      maxLength: 20,
      pattern: '^[A-Za-zÆØÅæøå0-9]+$',
    }),
    { minItems: 1, maxItems: 40, uniqueItems: true },
  ),
});

export const CourseGradeSummaryDto = Type.Object({
  courseCode: Type.String({ minLength: 2, maxLength: 20 }),
  period: FactDto(
    Type.Object({
      fromYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
      toYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
    }),
  ),
  sampleSize: FactDto(Type.Integer({ minimum: 0 })),
  distribution: FactDto(Type.Array(GradeBucketDto)),
  failureRatePercent: FactDto(Type.Number({ minimum: 0, maximum: 100 })),
  gradingScale: FactDto(
    Type.Union([Type.Literal('letter'), Type.Literal('pass-fail'), Type.Literal('mixed')]),
  ),
  evidence: Type.Array(EvidenceDto),
});

export const CourseGradeSummariesResponseDto = Type.Object({
  items: Type.Array(CourseGradeSummaryDto),
  sourceStatuses: Type.Array(SourceStatusDto),
  meta: Type.Object({
    count: Type.Integer({ minimum: 0 }),
    fromYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
    toYear: Type.Integer({ minimum: 2000, maximum: 2200 }),
  }),
});

export const CourseDecisionSignalsRequestDto = Type.Object({
  courseCodes: Type.Array(
    Type.String({
      minLength: 2,
      maxLength: 20,
      pattern: '^[A-Za-zÆØÅæøå0-9]+$',
    }),
    { minItems: 1, maxItems: 40, uniqueItems: true },
  ),
  term: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
});

export const CourseDecisionSignalsDto = Type.Object({
  courseCode: Type.String({ minLength: 2, maxLength: 20 }),
  credits: FactDto(Type.Number({ minimum: 0, maximum: 60 })),
  assessment: FactDto(Type.Array(AssessmentPartDto)),
  workFormSignals: FactDto(Type.Array(WorkFormDto)),
  obligatoryActivities: FactDto(Type.Array(ObligatoryActivityDto)),
  collaboration: FactDto(
    Type.Union([Type.Literal('individual'), Type.Literal('group'), Type.Literal('mixed')]),
  ),
  attendance: FactDto(Type.Union([Type.Literal('required'), Type.Literal('not-required')])),
  onlineParticipation: FactDto(
    Type.Union([Type.Literal('available'), Type.Literal('not-available')]),
  ),
  sourceStatus: SourceStatusDto,
  evidence: Type.Array(EvidenceDto),
});

export const CourseDecisionSignalsResponseDto = Type.Object({
  items: Type.Array(CourseDecisionSignalsDto),
  meta: Type.Object({
    count: Type.Integer({ minimum: 0 }),
  }),
});

export const CourseScheduleRequestDto = Type.Object({
  courseCodes: Type.Array(
    Type.String({
      minLength: 2,
      maxLength: 20,
      pattern: '^[A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9]*[0-9][A-Za-zÆØÅæøå0-9]*(?:-[0-9]+)?$',
    }),
    { minItems: 1, maxItems: 12, uniqueItems: true },
  ),
  term: Type.String({ pattern: '^[0-9]{4}-(spring|autumn)$' }),
  week: Type.Integer({ minimum: 1, maximum: 53 }),
});

export const CourseScheduleEvidenceDto = Type.Object({
  provider: Type.Literal('ntnu-course-schedule'),
  kind: Type.Union([Type.Literal('source-fact'), Type.Literal('fixture')]),
  sourceRecordId: Type.String({ minLength: 1 }),
  sourceUrl: Type.String({ minLength: 1 }),
  observedAt: DateTimeStringDto,
});

export const CourseScheduleActivityStreamDto = Type.Object({
  activityCode: Type.String({ minLength: 1 }),
  title: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  summary: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

export const CourseScheduleOccurrenceDto = Type.Object({
  id: Type.String({ minLength: 1 }),
  courseCode: Type.String({ minLength: 2, maxLength: 20 }),
  activityCode: Type.String({ minLength: 1 }),
  title: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  summary: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  status: Type.String({ minLength: 1 }),
  startsAt: DateTimeStringDto,
  endsAt: DateTimeStringDto,
  rooms: Type.Array(
    Type.Object({
      building: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
      room: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
      url: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    }),
  ),
  evidence: CourseScheduleEvidenceDto,
});

export const CourseScheduleItemDto = Type.Object({
  courseCode: Type.String({ minLength: 2, maxLength: 20 }),
  sourceStatus: SourceStatusDto,
  activityStreams: Type.Array(CourseScheduleActivityStreamDto),
  occurrences: Type.Array(CourseScheduleOccurrenceDto),
});

export const CourseScheduleResponseDto = Type.Object({
  items: Type.Array(CourseScheduleItemDto),
  meta: Type.Object({
    count: Type.Integer({ minimum: 0 }),
    term: Type.String({ pattern: '^[0-9]{4}-(spring|autumn)$' }),
    week: Type.Integer({ minimum: 1, maximum: 53 }),
    timezone: Type.Literal('Europe/Oslo'),
    limitations: Type.Object({
      activitySelection: Type.Literal('all-published-activities'),
      activityGrouping: Type.Literal('unavailable'),
      exceptionSemantics: Type.Literal('provider-status-unverified'),
    }),
  }),
});

export const CourseInsightParamsDto = Type.Object({
  courseCode: Type.String({ minLength: 2, maxLength: 20 }),
});

export const CourseInsightQueryDto = Type.Object({
  term: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
});

export const CourseInsightDto = Type.Object({
  courseKey: Type.String({ minLength: 1 }),
  institutionCode: Type.Literal('NTNU'),
  code: Type.String({ minLength: 1 }),
  title: FactDto(Type.String({ minLength: 1 })),
  credits: FactDto(Type.Number({ minimum: 0, maximum: 60 })),
  level: FactDto(CourseDecisionLevelDto),
  teachingLanguage: FactDto(Type.String({ minLength: 1 })),
  offerings: FactDto(Type.Array(OfferingDto)),
  content: FactDto(Type.String({ minLength: 1 })),
  learningOutcomes: FactDto(Type.String({ minLength: 1 })),
  teachingMethods: FactDto(Type.String({ minLength: 1 })),
  workForms: FactDto(Type.Array(WorkFormDto)),
  assessment: FactDto(Type.Array(AssessmentPartDto)),
  obligatoryActivities: FactDto(Type.Array(ObligatoryActivityDto)),
  collaboration: FactDto(
    Type.Union([Type.Literal('individual'), Type.Literal('group'), Type.Literal('mixed')]),
  ),
  attendance: FactDto(Type.Union([Type.Literal('required'), Type.Literal('not-required')])),
  onlineParticipation: FactDto(
    Type.Union([Type.Literal('available'), Type.Literal('not-available')]),
  ),
  prerequisites: FactDto(Type.String({ minLength: 1 })),
  accessRestrictions: FactDto(Type.String({ minLength: 1 })),
  gradeOutcomes: GradeOutcomesDto,
  examParticipation: ExamParticipationDto,
  sourceStatuses: Type.Array(SourceStatusDto),
  evidence: Type.Array(EvidenceDto),
});

export const CourseInsightResponseDto = Type.Object({
  item: CourseInsightDto,
  meta: Type.Object({
    partial: Type.Boolean(),
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
export type SourceStatusDtoType = Static<typeof SourceStatusDto>;
export type CourseScheduleRequestDtoType = Static<typeof CourseScheduleRequestDto>;
export type CourseScheduleEvidenceDtoType = Static<typeof CourseScheduleEvidenceDto>;
export type CourseScheduleActivityStreamDtoType = Static<typeof CourseScheduleActivityStreamDto>;
export type CourseScheduleOccurrenceDtoType = Static<typeof CourseScheduleOccurrenceDto>;
export type CourseScheduleItemDtoType = Static<typeof CourseScheduleItemDto>;
export type CourseScheduleResponseDtoType = Static<typeof CourseScheduleResponseDto>;
export type CourseInsightParamsDtoType = Static<typeof CourseInsightParamsDto>;
export type CourseInsightQueryDtoType = Static<typeof CourseInsightQueryDto>;
export type CourseInsightDtoType = Static<typeof CourseInsightDto>;
export type CourseInsightResponseDtoType = Static<typeof CourseInsightResponseDto>;
