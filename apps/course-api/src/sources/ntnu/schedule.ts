import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';

export interface NtnuScheduleCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
  readonly courseCode: string;
  readonly courseVersion: string;
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
  readonly timezone: 'Europe/Oslo';
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface NtnuScheduleAttribution {
  readonly provider: 'ntnu-course-schedule';
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly requestUrl: string;
  readonly contentHash: string;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface NtnuScheduleRoom {
  readonly id: string | null;
  readonly building: string | null;
  readonly room: string | null;
  readonly url: string | null;
}

export interface NtnuScheduleStaffMember {
  readonly username: string | null;
  readonly name: string | null;
  readonly url: string | null;
}

export interface ValidatedNtnuScheduleOccurrence {
  readonly courseCode: string;
  readonly courseVersion: string;
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
  readonly timezone: 'Europe/Oslo';
  readonly activityCode: string;
  readonly tpId: string;
  readonly artermin: string;
  readonly status: string;
  readonly acronym: string | null;
  readonly name: string | null;
  readonly title: string | null;
  readonly summary: string | null;
  readonly week: number | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly rooms: ReadonlyArray<NtnuScheduleRoom>;
  readonly staff: ReadonlyArray<NtnuScheduleStaffMember>;
  readonly studyProgramKeys: ReadonlyArray<string>;
  readonly sourceRecordId: string;
  readonly attribution: NtnuScheduleAttribution;
}

export interface NtnuScheduleCoverage {
  readonly activityIdentity: 'provider-recorded';
  readonly dateTime: 'dated-occurrences';
  readonly timezone: 'capture-declared';
  readonly activityType: 'provider-prose';
  readonly activitySelection: 'unknown';
  readonly exceptions: 'status-only';
  readonly campus: 'unknown';
  readonly location: 'rooms-when-published';
}

export type NtnuScheduleRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata';

export interface NtnuScheduleRejection {
  readonly code: NtnuScheduleRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export interface NtnuScheduleParseResult {
  readonly accepted: ReadonlyArray<ValidatedNtnuScheduleOccurrence>;
  readonly rejected: ReadonlyArray<NtnuScheduleRejection>;
  readonly coverage: NtnuScheduleCoverage;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const Sha256Schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));
const NullableStringSchema = Schema.NullOr(Schema.String);

const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  requestUrl: Schema.String.pipe(Schema.check(Schema.isStartsWith('https://www.ntnu.no/'))),
  courseCode: Schema.NonEmptyString,
  courseVersion: Schema.NonEmptyString,
  academicYear: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
  season: Schema.Literals(['spring', 'autumn']),
  timezone: Schema.Literals(['Europe/Oslo']),
  evidenceKind: Schema.Literals(['source-fact', 'fixture']),
});

const RoomSchema = Schema.Struct({
  id: NullableStringSchema,
  building: NullableStringSchema,
  room: NullableStringSchema,
  url: NullableStringSchema,
});

const StaffMemberSchema = Schema.Struct({
  username: NullableStringSchema,
  name: NullableStringSchema,
  url: NullableStringSchema,
});

const OccurrenceSchema = Schema.Struct({
  courseCode: Schema.NonEmptyString,
  activityCode: Schema.NonEmptyString,
  tpId: Schema.NonEmptyString,
  artermin: Schema.NonEmptyString,
  status: Schema.NonEmptyString,
  acronym: NullableStringSchema,
  name: NullableStringSchema,
  title: NullableStringSchema,
  summary: NullableStringSchema,
  week: Schema.NullOr(Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 53 })))),
  from: Schema.Int,
  to: Schema.Int,
  rooms: Schema.Array(RoomSchema),
  staff: Schema.Array(StaffMemberSchema),
  studyProgramKeys: Schema.Array(Schema.String),
});

const ResponseSchema = Schema.Struct({
  schedules: Schema.Array(Schema.Unknown),
});

const coverage: NtnuScheduleCoverage = Object.freeze({
  activityIdentity: 'provider-recorded',
  dateTime: 'dated-occurrences',
  timezone: 'capture-declared',
  activityType: 'provider-prose',
  activitySelection: 'unknown',
  exceptions: 'status-only',
  campus: 'unknown',
  location: 'rooms-when-published',
});

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly code?: NtnuScheduleRejectionCode } => {
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
  code: NtnuScheduleRejectionCode,
  message: string,
  raw: unknown,
): NtnuScheduleParseResult => ({
  accepted: [],
  rejected: [{ code, message, raw }],
  coverage,
});

/**
 * Boundary parser for dated occurrences published by NTNU's schedules resource.
 * It retains provider-recorded facts and makes unsupported timetable semantics
 * explicit through the coverage attached to every result.
 */
export const parseNtnuCourseSchedule = (
  input: unknown | Uint8Array,
  capture: NtnuScheduleCaptureMetadata,
): NtnuScheduleParseResult => {
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
    return rejectOne(
      'invalid-capture-metadata',
      'NTNU schedule capture metadata failed validation.',
      capture,
    );
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined) {
    return rejectOne(decoded.code, 'NTNU schedule response could not be decoded.', input);
  }

  const responseResult = Schema.decodeUnknownResult(ResponseSchema)(decoded.value);
  if (Result.isFailure(responseResult)) {
    return rejectOne(
      'invalid-response-shape',
      'NTNU schedule response failed boundary validation.',
      decoded.value,
    );
  }

  const captured = captureResult.success;
  const expectedArtermin = `${captured.academicYear}_${captured.season === 'spring' ? 'VÅR' : 'HØST'}`;
  const accepted: ValidatedNtnuScheduleOccurrence[] = [];
  const acceptedSourceRecordIds = new Set<string>();
  const rejected: NtnuScheduleRejection[] = [];

  for (const rawOccurrence of responseResult.success.schedules) {
    const occurrenceResult = Schema.decodeUnknownResult(OccurrenceSchema)(rawOccurrence);
    if (Result.isFailure(occurrenceResult)) {
      rejected.push({
        code: 'invalid-response-shape',
        message: 'An NTNU schedule occurrence failed boundary validation.',
        raw: rawOccurrence,
      });
      continue;
    }

    const occurrence = occurrenceResult.success;
    if (occurrence.courseCode !== captured.courseCode) {
      rejected.push({
        code: 'invalid-response-shape',
        message: 'An NTNU schedule occurrence did not match the captured course code.',
        raw: rawOccurrence,
      });
      continue;
    }
    if (occurrence.artermin !== expectedArtermin) {
      rejected.push({
        code: 'invalid-response-shape',
        message: 'An NTNU schedule occurrence did not match the captured academic period.',
        raw: rawOccurrence,
      });
      continue;
    }
    if (occurrence.to <= occurrence.from) {
      rejected.push({
        code: 'invalid-response-shape',
        message: 'An NTNU schedule occurrence ended at or before it started.',
        raw: rawOccurrence,
      });
      continue;
    }

    const startsAtDate = new Date(occurrence.from);
    const endsAtDate = new Date(occurrence.to);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      rejected.push({
        code: 'invalid-response-shape',
        message: 'An NTNU schedule occurrence had an epoch outside the ISO date range.',
        raw: rawOccurrence,
      });
      continue;
    }

    const startsAt = startsAtDate.toISOString();
    const endsAt = endsAtDate.toISOString();

    const sourceRecordId = `ntnu-course-schedule:${occurrence.tpId}:${startsAt}`;
    if (acceptedSourceRecordIds.has(sourceRecordId)) {
      rejected.push({
        code: 'invalid-response-shape',
        message: 'An NTNU schedule occurrence duplicated a source record identity.',
        raw: rawOccurrence,
      });
      continue;
    }
    acceptedSourceRecordIds.add(sourceRecordId);
    const attribution: NtnuScheduleAttribution = {
      provider: 'ntnu-course-schedule',
      sourceRecordId,
      retrievedAt: captured.retrievedAt,
      requestUrl: captured.requestUrl,
      contentHash: captured.contentHash,
      evidenceKind: captured.evidenceKind,
    };
    accepted.push({
      courseCode: occurrence.courseCode,
      courseVersion: captured.courseVersion,
      academicYear: captured.academicYear,
      season: captured.season,
      timezone: captured.timezone,
      activityCode: occurrence.activityCode,
      tpId: occurrence.tpId,
      artermin: occurrence.artermin,
      status: occurrence.status,
      acronym: occurrence.acronym,
      name: occurrence.name,
      title: occurrence.title,
      summary: occurrence.summary,
      week: occurrence.week,
      startsAt,
      endsAt,
      rooms: occurrence.rooms,
      staff: occurrence.staff,
      studyProgramKeys: occurrence.studyProgramKeys,
      sourceRecordId,
      attribution,
    });
  }

  return { accepted, rejected, coverage };
};
