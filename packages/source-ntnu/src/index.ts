import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';

export interface NtnuCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
}

export interface NtnuSourceAttribution {
  readonly provider: 'ntnu-studyplan';
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly sourcePeriod: string;
  readonly datasetRevision: string;
  readonly contentHash: string;
  readonly requestUrl: string;
}

export interface NtnuAttributedField {
  readonly value: string | number | boolean | null;
  readonly attribution: NtnuSourceAttribution;
}

export interface NtnuCurriculumCourse {
  readonly code: string;
  readonly version: string | null;
  readonly title: string;
  readonly credits: number | null;
  readonly choiceCode: string;
  readonly choiceName: string;
  readonly choiceDescription: string | null;
  readonly planelement: boolean;
}

export interface NtnuCurriculumGroup {
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly courses: ReadonlyArray<NtnuCurriculumCourse>;
}

export interface NtnuCurriculumPeriod {
  readonly termIndex: number;
  readonly groups: ReadonlyArray<NtnuCurriculumGroup>;
}

export interface ValidatedNtnuCurriculum {
  readonly programmeCode: string;
  readonly title: string;
  readonly cohortStartYear: number;
  readonly startSeason: 'autumn' | 'spring';
  readonly durationTerms: number;
  readonly sourceUpdatedAt: string;
  readonly sourceRecordId: string;
  readonly attribution: NtnuSourceAttribution;
  readonly fields: Readonly<Record<string, NtnuAttributedField>>;
  readonly periods: ReadonlyArray<NtnuCurriculumPeriod>;
  readonly raw: unknown;
}

export type NtnuRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata'
  | 'unsupported-study-direction';

export interface NtnuRejection {
  readonly sourceRecordId: string;
  readonly code: NtnuRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export interface NtnuParseResult {
  readonly accepted: ReadonlyArray<ValidatedNtnuCurriculum>;
  readonly rejected: ReadonlyArray<NtnuRejection>;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  requestUrl: Schema.String.pipe(Schema.check(Schema.isStartsWith('https://www.ntnu.no/'))),
});
const ChoiceSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  description: Schema.NullOr(Schema.String),
});
const CourseSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  version: Schema.NullOr(Schema.String),
  name: Schema.NonEmptyString,
  credit: Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isPattern(/^\d+(?:\.\d+)?$/)))),
  planelement: Schema.Boolean,
  studyChoice: ChoiceSchema,
});
const GroupSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  description: Schema.NullOr(Schema.String),
  deadlinedate: Schema.NullOr(Schema.String),
  relperiod: Schema.Number,
  courses: Schema.Array(CourseSchema),
  waypoint: Schema.Boolean,
});
const PeriodSchema = Schema.Struct({
  periodNumber: Schema.String.pipe(Schema.check(Schema.isPattern(/^\d+$/))),
  direction: Schema.Struct({
    code: Schema.NullOr(Schema.String),
    name: Schema.NullOr(Schema.String),
    studyDirectionDesignationCode: Schema.NullOr(Schema.String),
    studyDirectionDesignationName: Schema.NullOr(Schema.String),
    studyWaypoints: Schema.Array(Schema.Unknown),
    courseGroups: Schema.Array(GroupSchema),
    studyDirection: Schema.NullOr(Schema.String),
  }),
});
const ResponseSchema = Schema.Struct({
  settings: Schema.Struct({
    programmeCode: Schema.String,
    year: Schema.String.pipe(Schema.check(Schema.isPattern(/^\d{4}$/))),
  }),
  studyplan: Schema.Struct({
    code: Schema.NonEmptyString,
    name: Schema.NonEmptyString,
    year: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 }))),
    startTerm: Schema.Literals(['HØST', 'VÅR']),
    updated: Schema.NonEmptyString,
    studyPeriods: Schema.Array(PeriodSchema),
  }),
  publishedYears: Schema.Array(Schema.Int),
});

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly code?: NtnuRejectionCode } => {
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

export const parseNtnuCurriculum = (
  input: unknown | Uint8Array,
  capture: NtnuCaptureMetadata,
): NtnuParseResult => {
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
    return {
      accepted: [],
      rejected: [
        {
          sourceRecordId: 'ntnu-studyplan:unknown',
          code: 'invalid-capture-metadata',
          message: 'NTNU capture metadata failed validation.',
          raw: capture,
        },
      ],
    };
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined) {
    return {
      accepted: [],
      rejected: [
        {
          sourceRecordId: 'ntnu-studyplan:unknown',
          code: decoded.code,
          message: 'NTNU response could not be decoded.',
          raw: input,
        },
      ],
    };
  }
  const responseResult = Schema.decodeUnknownResult(ResponseSchema)(decoded.value);
  if (Result.isFailure(responseResult)) {
    return {
      accepted: [],
      rejected: [
        {
          sourceRecordId: 'ntnu-studyplan:unknown',
          code: 'invalid-response-shape',
          message: 'NTNU study-plan response failed boundary validation.',
          raw: decoded.value,
        },
      ],
    };
  }

  const response = responseResult.success;
  const sourceRecordId = `ntnu-studyplan:${response.studyplan.code}:${response.studyplan.year}`;
  if (
    response.studyplan.studyPeriods.some((period) => period.direction.studyWaypoints.length > 0)
  ) {
    return {
      accepted: [],
      rejected: [
        {
          sourceRecordId,
          code: 'unsupported-study-direction',
          message: 'This bounded adapter does not silently choose among study directions.',
          raw: decoded.value,
        },
      ],
    };
  }

  const attribution: NtnuSourceAttribution = {
    provider: 'ntnu-studyplan',
    sourceRecordId,
    retrievedAt: captureResult.success.retrievedAt,
    sourcePeriod: String(response.studyplan.year),
    datasetRevision: captureResult.success.contentHash,
    contentHash: captureResult.success.contentHash,
    requestUrl: captureResult.success.requestUrl,
  };
  const fields: Record<string, NtnuAttributedField> = {};
  const addField = (path: string, value: string | number | boolean | null): void => {
    fields[path] = { value, attribution };
  };
  addField('studyplan.code', response.studyplan.code);
  addField('studyplan.name', response.studyplan.name);
  addField('studyplan.year', response.studyplan.year);
  addField('studyplan.startTerm', response.studyplan.startTerm);
  addField('studyplan.updated', response.studyplan.updated);

  const periods = response.studyplan.studyPeriods.map((period, periodIndex) => {
    addField(`studyplan.studyPeriods[${periodIndex}].periodNumber`, period.periodNumber);
    return {
      termIndex: Number(period.periodNumber) - 1,
      groups: period.direction.courseGroups.map((group, groupIndex) => {
        const groupPath = `studyplan.studyPeriods[${periodIndex}].courseGroups[${groupIndex}]`;
        addField(`${groupPath}.code`, group.code);
        addField(`${groupPath}.name`, group.name);
        addField(`${groupPath}.description`, group.description);
        return {
          code: group.code,
          title: group.name,
          description: group.description,
          courses: group.courses.map((course, courseIndex) => {
            const coursePath = `${groupPath}.courses[${courseIndex}]`;
            addField(`${coursePath}.code`, course.code);
            addField(`${coursePath}.version`, course.version);
            addField(`${coursePath}.name`, course.name);
            addField(`${coursePath}.credit`, course.credit);
            addField(`${coursePath}.planelement`, course.planelement);
            addField(`${coursePath}.studyChoice.code`, course.studyChoice.code);
            addField(`${coursePath}.studyChoice.name`, course.studyChoice.name);
            addField(`${coursePath}.studyChoice.description`, course.studyChoice.description);
            return {
              code: course.code,
              version: course.version,
              title: course.name,
              credits: course.credit === null ? null : Number(course.credit),
              choiceCode: course.studyChoice.code,
              choiceName: course.studyChoice.name,
              choiceDescription: course.studyChoice.description,
              planelement: course.planelement,
            };
          }),
        };
      }),
    };
  });

  return {
    accepted: [
      {
        programmeCode: response.studyplan.code,
        title: response.studyplan.name,
        cohortStartYear: response.studyplan.year,
        startSeason: response.studyplan.startTerm === 'HØST' ? 'autumn' : 'spring',
        durationTerms: response.studyplan.studyPeriods.length,
        sourceUpdatedAt: response.studyplan.updated,
        sourceRecordId,
        attribution,
        fields,
        periods,
        raw: response,
      },
    ],
    rejected: [],
  };
};
