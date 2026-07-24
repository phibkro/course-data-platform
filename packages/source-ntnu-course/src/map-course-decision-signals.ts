import {
  decodeCourseDecisionSignals,
  known,
  unavailable,
  unknown,
  type CourseDecisionSignals,
} from '@course-data/course-model';

import type { ValidatedNtnuCourseDetail } from './detail';
import { mapNtnuAssessment, mapNtnuObligatoryActivities } from './map-assessment';

const academicPeriod = (academicYear: number, season: 'spring' | 'autumn'): string =>
  `${academicYear}/${academicYear + 1} · ${season}`;

export const mapNtnuDetailToCourseDecisionSignals = (
  courseCode: string,
  academicYear: number,
  season: 'spring' | 'autumn',
  detail: ValidatedNtnuCourseDetail | null,
  detailFailureWarning: string | null,
): CourseDecisionSignals => {
  if (detail === null) {
    const reason = 'NTNU course-detail page was not available for this course.';
    return decodeCourseDecisionSignals({
      courseCode,
      assessment: unavailable(reason),
      workFormSignals: unavailable(reason),
      obligatoryActivities: unavailable(reason),
      collaboration: unavailable(reason),
      attendance: unavailable(reason),
      onlineParticipation: unavailable(reason),
      sourceStatus: {
        provider: 'ntnu-course-page',
        status: 'failed',
        observedAt: null,
        warning:
          detailFailureWarning ?? 'NTNU course-detail page could not be retrieved or parsed.',
      },
      evidence: [],
    });
  }

  const factEvidenceId = `evidence:${detail.sourceRecordId}:fact`;
  const inferenceEvidenceId = `evidence:${detail.sourceRecordId}:inference`;
  const period = academicPeriod(academicYear, season);
  const evidence = [
    {
      id: factEvidenceId,
      provider: detail.attribution.provider,
      kind: detail.attribution.evidenceKind,
      recordId: detail.sourceRecordId,
      sourceUrl: detail.attribution.requestUrl,
      sourcePeriod: period,
      observedAt: detail.attribution.retrievedAt,
      excerpt: null,
      inferenceRule: null,
    },
    {
      id: inferenceEvidenceId,
      provider: detail.attribution.provider,
      kind: 'inference' as const,
      recordId: detail.sourceRecordId,
      sourceUrl: detail.attribution.requestUrl,
      sourcePeriod: period,
      observedAt: detail.attribution.retrievedAt,
      excerpt: null,
      inferenceRule:
        'Classified from keyword matching over the assessment, teaching-methods, and obligatory-activities sections.',
    },
  ];

  const assessment = mapNtnuAssessment(detail, factEvidenceId, inferenceEvidenceId);

  const workFormSignals =
    detail.teachingMethods.state !== 'known'
      ? unavailable<ReadonlyArray<(typeof detail.workFormSignals)[number]>>(
          detail.teachingMethods.reason,
        )
      : detail.workFormSignals.length > 0
        ? known(detail.workFormSignals, [inferenceEvidenceId])
        : unknown<ReadonlyArray<(typeof detail.workFormSignals)[number]>>(
            'No recognizable work-form keywords were found in the teaching-methods text.',
          );

  const obligatoryActivities = mapNtnuObligatoryActivities(
    detail,
    factEvidenceId,
    inferenceEvidenceId,
  );

  const collaboration =
    detail.collaborationSignal === null
      ? unknown<'individual' | 'group' | 'mixed'>(
          'No individual/group keywords were found in the assessment or teaching-methods text.',
        )
      : known(detail.collaborationSignal, [inferenceEvidenceId]);

  const attendance =
    detail.attendanceSignal === null
      ? unknown<'required' | 'not-required'>(
          'No explicit attendance-requirement statement was found on the page.',
        )
      : known(detail.attendanceSignal, [inferenceEvidenceId]);

  const onlineParticipation =
    detail.onlineParticipationSignal === null
      ? unknown<'available' | 'not-available'>(
          'No explicit remote-participation statement was found on the page.',
        )
      : known(detail.onlineParticipationSignal, [inferenceEvidenceId]);

  return decodeCourseDecisionSignals({
    courseCode,
    assessment,
    workFormSignals,
    obligatoryActivities,
    collaboration,
    attendance,
    onlineParticipation,
    sourceStatus: {
      provider: detail.attribution.provider,
      status: 'available',
      observedAt: detail.attribution.retrievedAt,
      warning: null,
    },
    evidence,
  });
};
