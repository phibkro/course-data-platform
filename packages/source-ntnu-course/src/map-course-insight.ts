import { known, unavailable, unknown, type Fact } from '@course-data/course-model';

import type { ValidatedNtnuCourseDetail } from './detail';
import type { ValidatedNtnuSearchHit } from './search';

const academicPeriod = (academicYear: number, season: 'spring' | 'autumn'): string =>
  `${academicYear}/${academicYear + 1} · ${season}`;

export interface EncodedEvidence {
  readonly id: string;
  readonly provider: string;
  readonly kind: 'source-fact' | 'inference' | 'fixture';
  readonly recordId: string;
  readonly sourceUrl: string | null;
  readonly sourcePeriod: string | null;
  readonly observedAt: string;
  readonly excerpt: string | null;
  readonly inferenceRule: string | null;
}

export interface EncodedSourceStatus {
  readonly provider: string;
  readonly status: 'available' | 'unavailable' | 'failed';
  readonly observedAt: string | null;
  readonly warning: string | null;
}

export interface NtnuOffering {
  readonly academicYear: number;
  readonly season: 'spring' | 'summer' | 'autumn' | 'full-year';
  readonly campuses: ReadonlyArray<string>;
  readonly deliveryModes: ReadonlyArray<'in-person' | 'online' | 'hybrid'>;
}

export interface NtnuAssessmentPart {
  readonly form:
    | 'written-exam'
    | 'oral-exam'
    | 'home-exam'
    | 'project'
    | 'portfolio'
    | 'practical'
    | 'assignment'
    | 'other';
  readonly description: string;
  readonly weightPercent: number | null;
  readonly duration: string | null;
}

export interface NtnuCourseInsightFields {
  readonly courseKey: string;
  readonly institutionCode: 'NTNU';
  readonly code: string;
  readonly title: Fact<string>;
  readonly credits: Fact<number>;
  readonly level: Fact<'bachelor' | 'master' | 'phd' | 'continuing-education' | 'unknown'>;
  readonly teachingLanguage: Fact<string>;
  readonly offerings: Fact<ReadonlyArray<NtnuOffering>>;
  readonly content: Fact<string>;
  readonly learningOutcomes: Fact<string>;
  readonly teachingMethods: Fact<string>;
  readonly workForms: Fact<
    ReadonlyArray<
      'lectures' | 'exercises' | 'laboratory' | 'seminar' | 'project' | 'self-study' | 'other'
    >
  >;
  readonly assessment: Fact<ReadonlyArray<NtnuAssessmentPart>>;
  readonly obligatoryActivities: Fact<ReadonlyArray<string>>;
  readonly collaboration: Fact<'individual' | 'group' | 'mixed'>;
  readonly attendance: Fact<'required' | 'not-required'>;
  readonly onlineParticipation: Fact<'available' | 'not-available'>;
  readonly prerequisites: Fact<string>;
  readonly accessRestrictions: Fact<string>;
  readonly evidence: ReadonlyArray<EncodedEvidence>;
  readonly sourceStatuses: ReadonlyArray<EncodedSourceStatus>;
}

/**
 * Pure mapping from validated NTNU search + course-detail records into the
 * subset of CourseInsight fields these two providers own. `detail` is
 * nullable to preserve partial success: when the detail page fetch failed,
 * search-derived fields stay known while detail-derived fields fall back to
 * `unavailable` and the ntnu-course-page source status reports the failure.
 */
export const mapNtnuToCourseInsightFields = (
  courseKey: string,
  search: ValidatedNtnuSearchHit,
  detail: ValidatedNtnuCourseDetail | null,
  detailFailureWarning: string | null,
): NtnuCourseInsightFields => {
  const searchEvidenceId = `evidence:${search.sourceRecordId}`;
  const searchEvidence: EncodedEvidence = {
    id: searchEvidenceId,
    provider: search.attribution.provider,
    kind: search.attribution.evidenceKind,
    recordId: search.sourceRecordId,
    sourceUrl: search.courseUrl,
    sourcePeriod: academicPeriod(search.academicYear, search.season),
    observedAt: search.attribution.retrievedAt,
    excerpt: search.courseName,
    inferenceRule: null,
  };

  const evidence: EncodedEvidence[] = [searchEvidence];
  const sourceStatuses: EncodedSourceStatus[] = [
    {
      provider: search.attribution.provider,
      status: 'available',
      observedAt: search.attribution.retrievedAt,
      warning: null,
    },
  ];

  const campusValues =
    search.location === null
      ? []
      : search.location
          .split(',')
          .map((campus) => campus.trim())
          .filter((campus) => campus.length > 0);
  const offerings: Fact<ReadonlyArray<NtnuOffering>> =
    campusValues.length === 0
      ? unknown('The NTNU catalogue did not identify a campus for this offering.')
      : known(
          [
            {
              academicYear: search.academicYear,
              season: search.season,
              campuses: campusValues,
              // hasMultimedia flags that lecture recordings exist, not that remote
              // participation is possible. A campus label also does not prove that
              // every activity is in-person, so mode stays unclassified.
              deliveryModes: [],
            },
          ],
          [searchEvidenceId],
        );

  if (detail === null) {
    sourceStatuses.push({
      provider: 'ntnu-course-page',
      status: 'failed',
      observedAt: null,
      warning: detailFailureWarning ?? 'NTNU course-detail page could not be retrieved or parsed.',
    });

    const detailUnavailable = <A>(): Fact<A> =>
      unavailable('NTNU course-detail page was not available for this course.');

    return {
      courseKey,
      institutionCode: 'NTNU',
      code: search.courseCode,
      title: known(search.courseName, [searchEvidenceId]),
      credits: detailUnavailable(),
      level: unknown('NTNU pages in this adapter do not expose an explicit study-level field.'),
      teachingLanguage: detailUnavailable(),
      offerings,
      content: detailUnavailable(),
      learningOutcomes: detailUnavailable(),
      teachingMethods: detailUnavailable(),
      workForms: detailUnavailable(),
      assessment: detailUnavailable(),
      obligatoryActivities: detailUnavailable(),
      collaboration: detailUnavailable(),
      attendance: detailUnavailable(),
      onlineParticipation: detailUnavailable(),
      prerequisites: detailUnavailable(),
      accessRestrictions: detailUnavailable(),
      evidence,
      sourceStatuses,
    };
  }

  const factEvidenceId = `evidence:${detail.sourceRecordId}:fact`;
  const inferenceEvidenceId = `evidence:${detail.sourceRecordId}:inference`;
  evidence.push(
    {
      id: factEvidenceId,
      provider: detail.attribution.provider,
      kind: detail.attribution.evidenceKind,
      recordId: detail.sourceRecordId,
      sourceUrl: detail.attribution.requestUrl,
      sourcePeriod: academicPeriod(search.academicYear, search.season),
      observedAt: detail.attribution.retrievedAt,
      excerpt: null,
      inferenceRule: null,
    },
    {
      id: inferenceEvidenceId,
      provider: detail.attribution.provider,
      kind: 'inference',
      recordId: detail.sourceRecordId,
      sourceUrl: detail.attribution.requestUrl,
      sourcePeriod: academicPeriod(search.academicYear, search.season),
      observedAt: detail.attribution.retrievedAt,
      excerpt: null,
      inferenceRule:
        'Classified from keyword matching over the assessment, teaching-methods, and page text.',
    },
  );
  sourceStatuses.push({
    provider: detail.attribution.provider,
    status: 'available',
    observedAt: detail.attribution.retrievedAt,
    warning: null,
  });

  const fromField = (field: ValidatedNtnuCourseDetail['content']): Fact<string> =>
    field.state === 'known' ? known(field.value, [factEvidenceId]) : unavailable(field.reason);

  const assessment: Fact<ReadonlyArray<NtnuAssessmentPart>> =
    detail.assessmentText.state !== 'known'
      ? unavailable(detail.assessmentText.reason)
      : known(
          (detail.assessmentFormGuesses.length > 0
            ? detail.assessmentFormGuesses
            : (['other'] as const)
          ).map((form) => ({
            form,
            description: detail.assessmentText.state === 'known' ? detail.assessmentText.value : '',
            weightPercent: null,
            duration: null,
          })),
          [inferenceEvidenceId],
        );

  const obligatoryActivities: Fact<ReadonlyArray<string>> =
    detail.obligatoryActivities.state === 'known'
      ? known(detail.obligatoryActivities.items, [factEvidenceId])
      : unavailable(detail.obligatoryActivities.reason);

  const collaboration: Fact<'individual' | 'group' | 'mixed'> =
    detail.collaborationSignal === null
      ? unknown(
          'No individual/group keywords were found in the assessment or teaching-methods text.',
        )
      : known(detail.collaborationSignal, [inferenceEvidenceId]);

  const attendance: Fact<'required' | 'not-required'> =
    detail.attendanceSignal === null
      ? unknown('No explicit attendance-requirement statement was found on the page.')
      : known(detail.attendanceSignal, [inferenceEvidenceId]);

  const onlineParticipation: Fact<'available' | 'not-available'> =
    detail.onlineParticipationSignal === null
      ? unknown('No explicit remote-participation statement was found on the page.')
      : known(detail.onlineParticipationSignal, [inferenceEvidenceId]);

  const workForms: Fact<
    ReadonlyArray<
      'lectures' | 'exercises' | 'laboratory' | 'seminar' | 'project' | 'self-study' | 'other'
    >
  > =
    detail.teachingMethods.state !== 'known'
      ? unavailable(detail.teachingMethods.reason)
      : detail.workFormSignals.length > 0
        ? known(detail.workFormSignals, [inferenceEvidenceId])
        : unknown('No recognizable work-form keywords were found in the teaching-methods text.');

  return {
    courseKey,
    institutionCode: 'NTNU',
    code: search.courseCode,
    title: known(search.courseName, [searchEvidenceId]),
    credits:
      detail.credits === null
        ? unknown('Studiepoeng was not found on the course-detail page.')
        : known(detail.credits, [factEvidenceId]),
    level: unknown('NTNU pages in this adapter do not expose an explicit study-level field.'),
    teachingLanguage:
      detail.teachingLanguage === null
        ? unknown('Undervisningsspråk was not found on the course-detail page.')
        : known(detail.teachingLanguage, [factEvidenceId]),
    offerings,
    content: fromField(detail.content),
    learningOutcomes: fromField(detail.learningOutcomes),
    teachingMethods: fromField(detail.teachingMethods),
    workForms,
    assessment,
    obligatoryActivities,
    collaboration,
    attendance,
    onlineParticipation,
    prerequisites: fromField(detail.prerequisites),
    accessRestrictions: fromField(detail.accessRestrictions),
    evidence,
    sourceStatuses,
  };
};
