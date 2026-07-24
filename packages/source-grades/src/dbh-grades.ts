import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';

const DBH_TABLE_ID = 308;

export interface DbhGradesCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly courseCode: string;
  readonly fromYear: number;
  readonly toYear: number;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface DbhGradesAttribution {
  readonly provider: 'dbh';
  readonly tableId: 308;
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly period: { readonly fromYear: number; readonly toYear: number };
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface ValidatedDbhGradeRow {
  readonly grade: string;
  readonly candidateCount: number;
}

export interface ValidatedDbhGrades {
  readonly sourceRecordId: string;
  readonly attribution: DbhGradesAttribution;
  readonly rows: ReadonlyArray<ValidatedDbhGradeRow>;
}

export type DbhGradesRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata'
  | 'row-schema-invalid';

export interface DbhGradesRejection {
  readonly code: DbhGradesRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export type DbhGradesParseResult =
  | { readonly accepted: ValidatedDbhGrades; readonly rejected: null }
  | { readonly accepted: null; readonly rejected: DbhGradesRejection };

const IsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const Sha256Schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));
const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  courseCode: Schema.NonEmptyString,
  fromYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  toYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  evidenceKind: Schema.Literals(['source-fact', 'fixture']),
});
const ResponseSchema = Schema.Array(Schema.Unknown);
const RowSchema = Schema.Struct({
  Karakter: Schema.NonEmptyString,
  'Antall kandidater totalt': Schema.String.pipe(Schema.check(Schema.isPattern(/^\d+$/))),
});

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly code?: DbhGradesRejectionCode } => {
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

const reject = (
  code: DbhGradesRejectionCode,
  message: string,
  raw: unknown,
): DbhGradesParseResult => ({
  accepted: null,
  rejected: { code, message, raw },
});

/**
 * Boundary parser for DBH/HK-dir table 308 ("Karakterer"), grouped by
 * `Karakter` and pre-filtered to one course by the caller's request body.
 * Pure: capture metadata (including the requested year window) is injected.
 */
export const parseDbhGrades = (
  input: unknown | Uint8Array,
  capture: DbhGradesCaptureMetadata,
): DbhGradesParseResult => {
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
    return reject('invalid-capture-metadata', 'DBH capture metadata failed validation.', capture);
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined) {
    return reject(decoded.code, 'DBH response could not be decoded.', input);
  }

  const responseResult = Schema.decodeUnknownResult(ResponseSchema)(decoded.value);
  if (Result.isFailure(responseResult)) {
    return reject('invalid-response-shape', 'DBH response must be an array.', decoded.value);
  }

  // The live table-308 response is a plain row array (unlike tables 208/347,
  // which prefix a status entry): no status/table-id header to validate here.
  const rows: ValidatedDbhGradeRow[] = [];
  for (const candidate of responseResult.success) {
    const rowResult = Schema.decodeUnknownResult(RowSchema)(candidate);
    if (Result.isFailure(rowResult)) {
      return reject('row-schema-invalid', 'A DBH grade row failed boundary validation.', candidate);
    }
    rows.push({
      grade: rowResult.success.Karakter.trim().toUpperCase(),
      candidateCount: Number(rowResult.success['Antall kandidater totalt']),
    });
  }

  const capturedFields = captureResult.success;
  const sourceRecordId = `dbh:${DBH_TABLE_ID}:${capturedFields.courseCode}:${capturedFields.fromYear}-${capturedFields.toYear}`;
  const attribution: DbhGradesAttribution = {
    provider: 'dbh',
    tableId: DBH_TABLE_ID,
    sourceRecordId,
    retrievedAt: capturedFields.retrievedAt,
    contentHash: capturedFields.contentHash,
    period: { fromYear: capturedFields.fromYear, toYear: capturedFields.toYear },
    evidenceKind: capturedFields.evidenceKind,
  };

  return { accepted: { sourceRecordId, attribution, rows }, rejected: null };
};
