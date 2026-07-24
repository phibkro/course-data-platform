import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';

export interface GradesNoCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
  readonly courseCode: string;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface GradesNoAttribution {
  readonly provider: 'grades-no';
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly requestUrl: string;
  readonly contentHash: string;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export type GradesNoSemester = 'AUTUMN' | 'SPRING' | 'SUMMER';

export interface ValidatedGradesNoPeriod {
  readonly year: number;
  readonly semester: GradesNoSemester;
  readonly attendeeCount: number;
  readonly letterCounts: {
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly d: number;
    readonly e: number;
    readonly f: number;
  };
  readonly passedCount: number | null;
  readonly averageGrade: number | null;
  readonly sourceRecordId: string;
  readonly attribution: GradesNoAttribution;
}

export type GradesNoRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata';

export interface GradesNoRejection {
  readonly code: GradesNoRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export interface GradesNoParseResult {
  readonly accepted: ReadonlyArray<ValidatedGradesNoPeriod>;
  readonly rejected: ReadonlyArray<GradesNoRejection>;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const Sha256Schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));
const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  requestUrl: Schema.String.pipe(Schema.check(Schema.isStartsWith('https://api.grades.no/'))),
  courseCode: Schema.NonEmptyString,
  evidenceKind: Schema.Literals(['source-fact', 'fixture']),
});

const NonNegativeInt = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)));

const RecordSchema = Schema.Struct({
  year: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  semester: Schema.Literals(['AUTUMN', 'SPRING', 'SUMMER']),
  attendee_count: NonNegativeInt,
  a: NonNegativeInt,
  b: NonNegativeInt,
  c: NonNegativeInt,
  d: NonNegativeInt,
  e: NonNegativeInt,
  f: NonNegativeInt,
  passed: Schema.NullOr(NonNegativeInt),
  average_grade: Schema.NullOr(Schema.Number),
});
const ResponseSchema = Schema.Array(RecordSchema);

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly code?: GradesNoRejectionCode } => {
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

const rejectOne = (
  code: GradesNoRejectionCode,
  message: string,
  raw: unknown,
): GradesNoParseResult => ({ accepted: [], rejected: [{ code, message, raw }] });

/**
 * Boundary parser for the grades.no per-course grades list
 * (`GET /api/v2/courses/{code}/grades/`). Pure: takes the raw response and
 * externally-injected capture metadata, produces no side effects.
 */
export const parseGradesNoResponse = (
  input: unknown | Uint8Array,
  capture: GradesNoCaptureMetadata,
): GradesNoParseResult => {
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
    return rejectOne(
      'invalid-capture-metadata',
      'grades.no capture metadata failed validation.',
      capture,
    );
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined) {
    return rejectOne(decoded.code, 'grades.no response could not be decoded.', input);
  }

  const responseResult = Schema.decodeUnknownResult(ResponseSchema)(decoded.value);
  if (Result.isFailure(responseResult)) {
    return rejectOne(
      'invalid-response-shape',
      'grades.no response failed boundary validation.',
      decoded.value,
    );
  }

  const capturedFields = captureResult.success;
  const accepted = responseResult.success.map((record): ValidatedGradesNoPeriod => {
    const sourceRecordId = `grades-no:${capturedFields.courseCode}:${record.year}-${record.semester}`;
    const attribution: GradesNoAttribution = {
      provider: 'grades-no',
      sourceRecordId,
      retrievedAt: capturedFields.retrievedAt,
      requestUrl: capturedFields.requestUrl,
      contentHash: capturedFields.contentHash,
      evidenceKind: capturedFields.evidenceKind,
    };
    return {
      year: record.year,
      semester: record.semester,
      attendeeCount: record.attendee_count,
      letterCounts: {
        a: record.a,
        b: record.b,
        c: record.c,
        d: record.d,
        e: record.e,
        f: record.f,
      },
      // grades.no uses 0 for ordinary A-F periods and a positive count for
      // pass/fail periods. Treating zero as a pass/fail marker would erase
      // every letter distribution in the live payload.
      passedCount: record.passed !== null && record.passed > 0 ? record.passed : null,
      averageGrade:
        record.average_grade !== null && record.average_grade > 0 ? record.average_grade : null,
      sourceRecordId,
      attribution,
    };
  });

  return { accepted, rejected: [] };
};
