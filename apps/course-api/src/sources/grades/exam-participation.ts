import {
  known,
  suppressed,
  unavailable,
  type Fact,
} from '../../course-decision/model/course-insight';

import type { EncodedEvidence, EncodedSourceStatus, GradePeriod } from './grade-outcomes';
import type { ValidatedDbhExamOutcomeRow, ValidatedDbhExamOutcomes } from './dbh-exam-outcomes';

export interface ExamParticipationFields {
  readonly period: Fact<GradePeriod>;
  readonly registered: Fact<number>;
  readonly attended: Fact<number>;
  readonly passed: Fact<number>;
  readonly failed: Fact<number>;
  readonly passedAfterRepeat: Fact<number>;
  readonly evidence: ReadonlyArray<EncodedEvidence>;
  readonly sourceStatuses: ReadonlyArray<EncodedSourceStatus>;
}

type CountField =
  | 'registeredCount'
  | 'attendedCount'
  | 'passedCount'
  | 'failedCount'
  | 'passedRepeatCount';

const unavailableParticipation = (
  reason: string,
  sourceStatus: EncodedSourceStatus,
): ExamParticipationFields => ({
  period: unavailable(reason),
  registered: unavailable(reason),
  attended: unavailable(reason),
  passed: unavailable(reason),
  failed: unavailable(reason),
  passedAfterRepeat: unavailable(reason),
  evidence: [],
  sourceStatuses: [sourceStatus],
});

const aggregateCount = (
  rows: ReadonlyArray<ValidatedDbhExamOutcomeRow>,
  field: CountField,
  label: string,
  evidenceId: string,
): Fact<number> => {
  // DBH returns zero both for a true zero and for a GDPR-protected count below
  // three. An aggregate containing such a cell has no exact public value.
  if (rows.some((row) => row[field] === 0)) {
    return suppressed(
      `DBH/HK-dir returned an ambiguous zero for ${label}; public values below three are privacy-protected.`,
      [evidenceId],
    );
  }
  return known(
    rows.reduce((sum, row) => sum + row[field], 0),
    [evidenceId],
  );
};

export const mapDbhToExamParticipation = (
  exams: ValidatedDbhExamOutcomes | null,
  rejectedRows = 0,
): ExamParticipationFields => {
  if (exams === null) {
    return unavailableParticipation('DBH/HK-dir exam participation could not be retrieved.', {
      provider: 'dbh-table-905',
      status: 'failed',
      observedAt: null,
      warning: 'DBH/HK-dir table-905 request failed or was unreachable.',
    });
  }
  if (exams.rows.length === 0) {
    return unavailableParticipation(
      'DBH/HK-dir exposed no exam-participation rows for this course in the selected period.',
      {
        provider: 'dbh-table-905',
        status: 'unavailable',
        observedAt: exams.attribution.retrievedAt,
        warning:
          rejectedRows === 0
            ? null
            : `${rejectedRows} malformed or out-of-scope DBH table-905 row(s) were excluded.`,
      },
    );
  }

  const years = exams.rows.map((row) => row.year);
  const period = { fromYear: Math.min(...years), toYear: Math.max(...years) };
  const evidenceId = `evidence:${exams.sourceRecordId}`;
  const evidence: EncodedEvidence = {
    id: evidenceId,
    provider: exams.attribution.provider,
    kind: exams.attribution.evidenceKind,
    recordId: exams.sourceRecordId,
    sourceUrl: exams.attribution.requestUrl,
    sourcePeriod: `${period.fromYear}-${period.toYear}`,
    observedAt: exams.attribution.retrievedAt,
    excerpt: null,
    inferenceRule: null,
  };

  return {
    period: known(period, [evidenceId]),
    registered: aggregateCount(exams.rows, 'registeredCount', 'exam registrations', evidenceId),
    attended: aggregateCount(exams.rows, 'attendedCount', 'exam attendance', evidenceId),
    passed: aggregateCount(exams.rows, 'passedCount', 'passed exams', evidenceId),
    failed: aggregateCount(exams.rows, 'failedCount', 'failed exams', evidenceId),
    passedAfterRepeat: aggregateCount(
      exams.rows,
      'passedRepeatCount',
      'passed repeat exams',
      evidenceId,
    ),
    evidence: [evidence],
    sourceStatuses: [
      {
        provider: 'dbh-table-905',
        status: 'available',
        observedAt: exams.attribution.retrievedAt,
        warning:
          rejectedRows === 0
            ? null
            : `${rejectedRows} malformed or out-of-scope DBH table-905 row(s) were excluded.`,
      },
    ],
  };
};
