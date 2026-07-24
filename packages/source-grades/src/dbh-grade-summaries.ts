import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';

import type { DbhGradesAttribution, ValidatedDbhGradeRow } from './dbh-grades';

const DBH_TABLE_ID = 308;
const MAX_COURSE_CODES = 40;

export interface DbhGradeSummariesCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly courseCodes: ReadonlyArray<string>;
  readonly fromYear: number;
  readonly toYear: number;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface ValidatedDbhCourseGrades {
  readonly courseCode: string;
  readonly sourceRecordId: string;
  readonly attribution: DbhGradesAttribution;
  readonly rows: ReadonlyArray<ValidatedDbhGradeRow>;
}

export type DbhGradeSummariesRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata'
  | 'row-schema-invalid'
  | 'row-course-unrequested';

export interface DbhGradeSummariesRejection {
  readonly code: DbhGradeSummariesRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export interface DbhGradeSummariesParseResult {
  readonly accepted: ReadonlyArray<ValidatedDbhCourseGrades>;
  readonly rejected: ReadonlyArray<DbhGradeSummariesRejection>;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const Sha256Schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));
const CourseCodesSchema = Schema.Array(Schema.NonEmptyString).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(MAX_COURSE_CODES)),
);
const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  courseCodes: CourseCodesSchema,
  fromYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  toYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  evidenceKind: Schema.Literals(['source-fact', 'fixture']),
});
const ResponseSchema = Schema.Array(Schema.Unknown);
const RowSchema = Schema.Struct({
  Emnekode: Schema.NonEmptyString,
  Karakter: Schema.NonEmptyString,
  'Antall kandidater totalt': Schema.String.pipe(Schema.check(Schema.isPattern(/^\d+$/))),
});

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly code?: DbhGradeSummariesRejectionCode } => {
  if (input instanceof Uint8Array) {
    try {
      input = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return { code: 'invalid-response-bytes' };
    }
  }
  if (typeof input === 'string') {
    try {
      return { value: JSON.parse(input) as unknown };
    } catch {
      return { code: 'invalid-response-json' };
    }
  }
  return { value: input };
};

const rejectAll = (
  code: DbhGradeSummariesRejectionCode,
  message: string,
  raw: unknown,
): DbhGradeSummariesParseResult => ({
  accepted: [],
  rejected: [{ code, message, raw }],
});

export const parseDbhGradeSummaries = (
  input: unknown | Uint8Array,
  capture: DbhGradeSummariesCaptureMetadata,
): DbhGradeSummariesParseResult => {
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
    return rejectAll(
      'invalid-capture-metadata',
      'DBH grade-summary capture metadata failed validation.',
      capture,
    );
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined) {
    return rejectAll(decoded.code, 'DBH grade-summary response could not be decoded.', input);
  }

  const responseResult = Schema.decodeUnknownResult(ResponseSchema)(decoded.value);
  if (Result.isFailure(responseResult)) {
    return rejectAll(
      'invalid-response-shape',
      'DBH grade-summary response must be an array.',
      decoded.value,
    );
  }

  const captured = captureResult.success;
  const requestedCodes = [
    ...new Set(captured.courseCodes.map((code) => code.trim().toUpperCase())),
  ];
  const rowsByCourse = new Map<string, ValidatedDbhGradeRow[]>();
  const rejected: DbhGradeSummariesRejection[] = [];

  for (const candidate of responseResult.success) {
    const rowResult = Schema.decodeUnknownResult(RowSchema)(candidate);
    if (Result.isFailure(rowResult)) {
      rejected.push({
        code: 'row-schema-invalid',
        message: 'A DBH grade-summary row failed boundary validation.',
        raw: candidate,
      });
      continue;
    }

    const row = rowResult.success;
    const providerCourseCode = row.Emnekode.trim().toUpperCase();
    const courseCode = requestedCodes.find((code) => providerCourseCode.startsWith(`${code}-`));
    if (courseCode === undefined) {
      rejected.push({
        code: 'row-course-unrequested',
        message: 'A DBH grade-summary row did not match a requested course code.',
        raw: candidate,
      });
      continue;
    }

    const rows = rowsByCourse.get(courseCode) ?? [];
    rows.push({
      grade: row.Karakter.trim().toUpperCase(),
      candidateCount: Number(row['Antall kandidater totalt']),
    });
    rowsByCourse.set(courseCode, rows);
  }

  return {
    accepted: requestedCodes.flatMap((courseCode) => {
      const rows = rowsByCourse.get(courseCode);
      if (rows === undefined) return [];
      const sourceRecordId = `dbh:${DBH_TABLE_ID}:${courseCode}:${captured.fromYear}-${captured.toYear}`;
      return [
        {
          courseCode,
          sourceRecordId,
          attribution: {
            provider: 'dbh',
            tableId: DBH_TABLE_ID,
            sourceRecordId,
            retrievedAt: captured.retrievedAt,
            contentHash: captured.contentHash,
            period: { fromYear: captured.fromYear, toYear: captured.toYear },
            evidenceKind: captured.evidenceKind,
          },
          rows,
        },
      ];
    }),
    rejected,
  };
};
