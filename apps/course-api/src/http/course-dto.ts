import type {
  CourseDecisionSignalsDtoType,
  CourseGradeSummaryDtoType,
  CourseInsightDtoType,
  CourseSearchItemDtoType,
} from '@course-data/course-contracts';

import type {
  CourseDecisionSignals,
  CourseGradeSummary,
  CourseInsight,
  CourseSearchItem,
  Fact,
  Offering,
} from '../course-decision/model/course-insight';

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
  examParticipation: {
    period: mapFact(insight.examParticipation.period, (period) => period),
    registered: mapFact(insight.examParticipation.registered, Number),
    attended: mapFact(insight.examParticipation.attended, Number),
    passed: mapFact(insight.examParticipation.passed, Number),
    failed: mapFact(insight.examParticipation.failed, Number),
    passedAfterRepeat: mapFact(insight.examParticipation.passedAfterRepeat, Number),
  },
  sourceStatuses: insight.sourceStatuses.map(mapSourceStatus),
  evidence: insight.evidence.map(mapEvidence),
});
