import {
  known,
  unavailable,
  unknown,
  type AssessmentPart,
  type Fact,
  type ObligatoryActivity,
} from '@course-data/course-model';

import type { ValidatedNtnuCourseDetail } from './detail';

const requirementUnknown = () =>
  unknown<'required' | 'optional' | 'choice' | 'conditional'>(
    'The NTNU assessment component does not publish an explicit requirement or choice rule.',
  );

const workloadPatternUnknown = () =>
  unknown<'distributed' | 'concentrated' | 'recurring' | 'milestone'>(
    'Workload timing is not inferred from the assessment form.',
  );

export const mapNtnuAssessment = (
  detail: ValidatedNtnuCourseDetail,
  factEvidenceId: string,
  inferenceEvidenceId: string,
): Fact<ReadonlyArray<AssessmentPart>> => {
  if (detail.assessmentParts.state === 'known') {
    return known(
      detail.assessmentParts.items.map((part) => ({
        form: part.form,
        description: part.description,
        requirement: requirementUnknown(),
        weightPercent:
          part.weightPercent === null
            ? unknown('The ordinary assessment component did not publish a valid positive weight.')
            : known(part.weightPercent, [factEvidenceId]),
        duration:
          part.duration === null
            ? unknown('The ordinary assessment component did not publish a duration.')
            : known(part.duration, [factEvidenceId]),
        workloadPattern: workloadPatternUnknown(),
      })),
      [factEvidenceId, inferenceEvidenceId],
    );
  }

  if (detail.assessmentText.state !== 'known') {
    return unavailable(detail.assessmentText.reason);
  }

  return known(
    (detail.assessmentFormGuesses.length > 0
      ? detail.assessmentFormGuesses
      : (['other'] as const)
    ).map((form) => ({
      form,
      description: detail.assessmentText.state === 'known' ? detail.assessmentText.value : '',
      requirement: requirementUnknown(),
      weightPercent: unknown(
        'No structured ordinary assessment component was available for this inferred form.',
      ),
      duration: unknown(
        'No structured ordinary assessment component was available for this inferred form.',
      ),
      workloadPattern: workloadPatternUnknown(),
    })),
    [inferenceEvidenceId],
  );
};

export const mapNtnuObligatoryActivities = (
  detail: ValidatedNtnuCourseDetail,
  factEvidenceId: string,
  inferenceEvidenceId: string,
): Fact<ReadonlyArray<ObligatoryActivity>> =>
  detail.obligatoryActivities.state === 'known'
    ? known(
        detail.obligatoryActivities.items.map((activity) => ({
          description: activity.description,
          form:
            activity.formGuess === null
              ? unknown('The obligatory activity form could not be classified from source text.')
              : known(activity.formGuess, [inferenceEvidenceId]),
          workloadPattern: workloadPatternUnknown(),
        })),
        [factEvidenceId],
      )
    : unavailable(detail.obligatoryActivities.reason);
