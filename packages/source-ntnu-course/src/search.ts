import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';

export interface NtnuSearchCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
  readonly queryString: string;
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
}

export interface NtnuSearchAttribution {
  readonly provider: 'ntnu-course-search';
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly requestUrl: string;
  readonly contentHash: string;
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
  readonly numFound: number;
  readonly hasMoreResults: boolean;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
);
const Sha256Schema = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));

const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  requestUrl: Schema.String.pipe(Schema.startsWith('https://www.ntnu.no/')),
  queryString: Schema.String,
  academicYear: Schema.Number.pipe(Schema.int(), Schema.between(2000, 2200)),
  season: Schema.Literal('spring', 'autumn'),
});

const SearchCourseSchema = Schema.Struct({
  courseCode: Schema.String.pipe(Schema.minLength(1)),
  courseVersion: Schema.NullOr(Schema.String),
  courseName: Schema.String.pipe(Schema.minLength(1)),
  examOnly: Schema.Boolean,
  hasMultimedia: Schema.Boolean,
  courseUrl: Schema.String.pipe(Schema.minLength(1)),
  location: Schema.NullOr(Schema.String),
});

const SearchResponseSchema = Schema.Struct({
  courses: Schema.Array(SearchCourseSchema),
  numFound: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
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
  numFound: 0,
  hasMoreResults: false,
});

export const parseNtnuCourseSearch = (
  input: unknown | Uint8Array,
  capture: NtnuSearchCaptureMetadata,
): NtnuSearchParseResult => {
  const captureResult = Schema.decodeUnknownEither(CaptureSchema)(capture);
  if (Either.isLeft(captureResult)) {
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

  const responseResult = Schema.decodeUnknownEither(SearchResponseSchema)(decoded.value);
  if (Either.isLeft(responseResult)) {
    return rejectOne(
      'invalid-response-shape',
      'NTNU search response failed boundary validation.',
      decoded.value,
    );
  }

  const response = responseResult.right;
  const query = captureResult.right.queryString.trim().toUpperCase();

  const accepted = response.courses.map((course): ValidatedNtnuSearchHit => {
    const sourceRecordId = `ntnu-course-search:${course.courseCode}`;
    const attribution: NtnuSearchAttribution = {
      provider: 'ntnu-course-search',
      sourceRecordId,
      retrievedAt: captureResult.right.retrievedAt,
      requestUrl: captureResult.right.requestUrl,
      contentHash: captureResult.right.contentHash,
    };
    return {
      courseCode: course.courseCode,
      courseVersion: course.courseVersion,
      courseName: course.courseName,
      examOnly: course.examOnly,
      hasMultimedia: course.hasMultimedia,
      courseUrl: course.courseUrl,
      location: course.location,
      exactMatch: course.courseCode.toUpperCase() === query,
      academicYear: captureResult.right.academicYear,
      season: captureResult.right.season,
      sourceRecordId,
      attribution,
    };
  });

  return {
    accepted,
    rejected: [],
    numFound: response.numFound,
    hasMoreResults: response.hasMoreResults,
  };
};
