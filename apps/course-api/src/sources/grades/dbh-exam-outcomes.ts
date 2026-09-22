import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';

const DBH_TABLE_ID = 905;

export interface DbhExamOutcomesCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
  readonly courseCode: string;
  readonly fromYear: number;
  readonly toYear: number;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface DbhExamOutcomesAttribution {
  readonly provider: 'dbh';
  readonly tableId: 905;
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
  readonly requestedPeriod: { readonly fromYear: number; readonly toYear: number };
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface ValidatedDbhExamOutcomeRow {
  readonly year: number;
  readonly semester: 1 | 3;
  readonly registeredCount: number;
  readonly attendedCount: number;
  readonly passedCount: number;
  readonly passedRepeatCount: number;
  readonly failedCount: number;
}

export interface ValidatedDbhExamOutcomes {
  readonly courseCode: string;
  readonly sourceRecordId: string;
  readonly attribution: DbhExamOutcomesAttribution;
  readonly rows: ReadonlyArray<ValidatedDbhExamOutcomeRow>;
}

export type DbhExamOutcomesRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata'
  | 'row-schema-invalid'
  | 'row-period-unrequested'
  | 'row-course-unrequested';

export interface DbhExamOutcomesRejection {
  readonly code: DbhExamOutcomesRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export interface DbhExamOutcomesParseResult {
  readonly accepted: ValidatedDbhExamOutcomes | null;
  readonly rejected: ReadonlyArray<DbhExamOutcomesRejection>;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const Sha256Schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));
const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  requestUrl: Schema.NonEmptyString,
  courseCode: Schema.NonEmptyString,
  fromYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  toYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  evidenceKind: Schema.Literals(['source-fact', 'fixture']),
});
const CountSchema = Schema.String.pipe(Schema.check(Schema.isPattern(/^\d+$/)));
const ResponseSchema = Schema.Array(Schema.Unknown);
const RowSchema = Schema.Struct({
  Emnekode: Schema.NonEmptyString,
  Årstall: Schema.String.pipe(Schema.check(Schema.isPattern(/^\d{4}$/))),
  Semester: Schema.Literals(['1', '3']),
  'Oppmeldt totalt': CountSchema,
  'Møtt til eksamen': CountSchema,
  Bestått: CountSchema,
  'Beståtte gjentak': CountSchema,
  'Antall kandidater stryk': CountSchema,
});

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly code?: DbhExamOutcomesRejectionCode } => {
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
  code: DbhExamOutcomesRejectionCode,
  message: string,
  raw: unknown,
): DbhExamOutcomesParseResult => ({
  accepted: null,
  rejected: [{ code, message, raw }],
});

/**
 * Boundary parser for DBH/HK-dir table 905 ("Eksamensdata"), grouped by
 * year, semester, and versioned course code. Valid rows survive malformed or
 * out-of-scope neighbours; no provider value reaches the domain unvalidated.
 */
export const parseDbhExamOutcomes = (
  input: unknown | Uint8Array,
  capture: DbhExamOutcomesCaptureMetadata,
): DbhExamOutcomesParseResult => {
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
    return rejectAll(
      'invalid-capture-metadata',
      'DBH exam-outcome capture metadata failed validation.',
      capture,
    );
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined) {
    return rejectAll(decoded.code, 'DBH exam-outcome response could not be decoded.', input);
  }

  const responseResult = Schema.decodeUnknownResult(ResponseSchema)(decoded.value);
  if (Result.isFailure(responseResult)) {
    return rejectAll(
      'invalid-response-shape',
      'DBH exam-outcome response must be an array.',
      decoded.value,
    );
  }

  const captured = captureResult.success;
  const courseCode = captured.courseCode.trim().toUpperCase();
  const rows: ValidatedDbhExamOutcomeRow[] = [];
  const rejected: DbhExamOutcomesRejection[] = [];

  for (const candidate of responseResult.success) {
    const rowResult = Schema.decodeUnknownResult(RowSchema)(candidate);
    if (Result.isFailure(rowResult)) {
      rejected.push({
        code: 'row-schema-invalid',
        message: 'A DBH exam-outcome row failed boundary validation.',
        raw: candidate,
      });
      continue;
    }

    const row = rowResult.success;
    const year = Number(row.Årstall);
    if (year < captured.fromYear || year > captured.toYear) {
      rejected.push({
        code: 'row-period-unrequested',
        message: 'A DBH exam-outcome row was outside the requested year window.',
        raw: candidate,
      });
      continue;
    }
    if (!row.Emnekode.trim().toUpperCase().startsWith(`${courseCode}-`)) {
      rejected.push({
        code: 'row-course-unrequested',
        message: 'A DBH exam-outcome row did not match the requested course code.',
        raw: candidate,
      });
      continue;
    }

    rows.push({
      year,
      semester: Number(row.Semester) as 1 | 3,
      registeredCount: Number(row['Oppmeldt totalt']),
      attendedCount: Number(row['Møtt til eksamen']),
      passedCount: Number(row.Bestått),
      passedRepeatCount: Number(row['Beståtte gjentak']),
      failedCount: Number(row['Antall kandidater stryk']),
    });
  }

  const sourceRecordId = `dbh:${DBH_TABLE_ID}:${courseCode}:${captured.fromYear}-${captured.toYear}`;
  return {
    accepted: {
      courseCode,
      sourceRecordId,
      attribution: {
        provider: 'dbh',
        tableId: DBH_TABLE_ID,
        sourceRecordId,
        retrievedAt: captured.retrievedAt,
        contentHash: captured.contentHash,
        requestUrl: captured.requestUrl,
        requestedPeriod: { fromYear: captured.fromYear, toYear: captured.toYear },
        evidenceKind: captured.evidenceKind,
      },
      rows,
    },
    rejected,
  };
};
