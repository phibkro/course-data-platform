import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';

export interface NtnuSearchCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
  readonly queryString: string;
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface NtnuSearchAttribution {
  readonly provider: 'ntnu-course-search';
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly requestUrl: string;
  readonly contentHash: string;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface ValidatedNtnuSearchHit {
  readonly courseCode: string;
  readonly courseVersion: string | null;
  readonly courseName: string;
  readonly examOnly: boolean;
  readonly hasMultimedia: boolean;
  readonly courseUrl: string;
  readonly location: string | null;
  readonly exactMatch: boolean;
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
  readonly sourceRecordId: string;
  readonly attribution: NtnuSearchAttribution;
}

export type NtnuSearchRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata';

export interface NtnuSearchRejection {
  readonly code: NtnuSearchRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export interface NtnuSearchParseResult {
  readonly accepted: ReadonlyArray<ValidatedNtnuSearchHit>;
  readonly rejected: ReadonlyArray<NtnuSearchRejection>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const Sha256Schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));

const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  requestUrl: Schema.String.pipe(Schema.check(Schema.isStartsWith('https://www.ntnu.no/'))),
  queryString: Schema.String,
  academicYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  season: Schema.Literals(['spring', 'autumn']),
  evidenceKind: Schema.Literals(['source-fact', 'fixture']),
});

const SearchCourseSchema = Schema.Struct({
  courseCode: Schema.NonEmptyString,
  courseVersion: Schema.NullOr(Schema.String),
  courseName: Schema.NonEmptyString,
  examOnly: Schema.Boolean,
  hasMultimedia: Schema.Boolean,
  courseUrl: Schema.String.pipe(
    Schema.check(Schema.isStartsWith('https://www.ntnu.no/studier/emner/')),
  ),
  location: Schema.NullOr(Schema.String),
});

const SearchResponseSchema = Schema.Struct({
  courses: Schema.Array(Schema.Unknown),
  numFound: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  pageNr: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  pageSize: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  hasMoreResults: Schema.Boolean,
});

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly code?: NtnuSearchRejectionCode } => {
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
  code: NtnuSearchRejectionCode,
  message: string,
  raw: unknown,
): NtnuSearchParseResult => ({
  accepted: [],
  rejected: [{ code, message, raw }],
  total: 0,
  page: 1,
  pageSize: 1,
  hasMore: false,
});

export const parseNtnuCourseSearch = (
  input: unknown | Uint8Array,
  capture: NtnuSearchCaptureMetadata,
): NtnuSearchParseResult => {
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
    return rejectOne(
      'invalid-capture-metadata',
      'NTNU search capture metadata failed validation.',
      capture,
    );
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined) {
    return rejectOne(decoded.code, 'NTNU search response could not be decoded.', input);
  }

  const responseResult = Schema.decodeUnknownResult(SearchResponseSchema)(decoded.value);
  if (Result.isFailure(responseResult)) {
    return rejectOne(
      'invalid-response-shape',
      'NTNU search response failed boundary validation.',
      decoded.value,
    );
  }

  const response = responseResult.success;
  const query = captureResult.success.queryString.trim().toUpperCase();

  const accepted: ValidatedNtnuSearchHit[] = [];
  const rejected: NtnuSearchRejection[] = [];
  for (const rawCourse of response.courses) {
    const courseResult = Schema.decodeUnknownResult(SearchCourseSchema)(rawCourse);
    if (Result.isFailure(courseResult)) {
      rejected.push({
        code: 'invalid-response-shape',
        message: 'An NTNU search result row failed boundary validation.',
        raw: rawCourse,
      });
      continue;
    }

    const course = courseResult.success;
    const sourceRecordId = [
      'ntnu-course-search',
      course.courseCode,
      course.courseVersion ?? 'unknown-version',
      `${captureResult.success.academicYear}-${captureResult.success.season}`,
    ].join(':');
    const attribution: NtnuSearchAttribution = {
      provider: 'ntnu-course-search',
      sourceRecordId,
      retrievedAt: captureResult.success.retrievedAt,
      requestUrl: captureResult.success.requestUrl,
      contentHash: captureResult.success.contentHash,
      evidenceKind: captureResult.success.evidenceKind,
    };
    accepted.push({
      courseCode: course.courseCode,
      courseVersion: course.courseVersion,
      courseName: course.courseName,
      examOnly: course.examOnly,
      hasMultimedia: course.hasMultimedia,
      courseUrl: course.courseUrl,
      location: course.location,
      exactMatch: course.courseCode.toUpperCase() === query,
      academicYear: captureResult.success.academicYear,
      season: captureResult.success.season,
      sourceRecordId,
      attribution,
    });
  }

  return {
    accepted,
    rejected,
    total: response.numFound,
    page: response.pageNr,
    pageSize: response.pageSize,
    hasMore: response.hasMoreResults,
  };
};
