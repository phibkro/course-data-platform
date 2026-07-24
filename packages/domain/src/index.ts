import * as Schema from 'effect/Schema';

export const InstitutionIdSchema = Schema.NonEmptyString.pipe(Schema.brand('InstitutionId'));
export type InstitutionId = Schema.Schema.Type<typeof InstitutionIdSchema>;

export const CourseIdSchema = Schema.NonEmptyString.pipe(Schema.brand('CourseId'));
export type CourseId = Schema.Schema.Type<typeof CourseIdSchema>;

export const CourseVersionIdSchema = Schema.NonEmptyString.pipe(Schema.brand('CourseVersionId'));
export type CourseVersionId = Schema.Schema.Type<typeof CourseVersionIdSchema>;

export const AcademicYearSchema = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 2000, maximum: 2200 })),
  Schema.brand('AcademicYear'),
);
export type AcademicYear = Schema.Schema.Type<typeof AcademicYearSchema>;

export const CourseLevelSchema = Schema.Literals([
  'bachelor',
  'master',
  'phd',
  'continuing-education',
  'unknown',
]);
export type CourseLevel = Schema.Schema.Type<typeof CourseLevelSchema>;

export const SourceReferenceSchema = Schema.Struct({
  provider: Schema.NonEmptyString,
  recordId: Schema.NonEmptyString,
  retrievedAt: Schema.DateFromString,
});
export type SourceReference = Schema.Schema.Type<typeof SourceReferenceSchema>;

export const CourseSummarySchema = Schema.Struct({
  id: CourseVersionIdSchema,
  courseId: CourseIdSchema,
  institutionId: InstitutionIdSchema,
  institutionShortName: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  academicYear: AcademicYearSchema,
  credits: Schema.NullOr(
    Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 60 }))),
  ),
  level: CourseLevelSchema,
  teachingLanguage: Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isMinLength(2)))),
  source: SourceReferenceSchema,
});
export type CourseSummary = Schema.Schema.Type<typeof CourseSummarySchema>;

export const decodeCourseSummary = Schema.decodeUnknownSync(CourseSummarySchema);
export const decodeInstitutionId = Schema.decodeUnknownSync(InstitutionIdSchema);
export const decodeAcademicYear = Schema.decodeUnknownSync(AcademicYearSchema);

export const makeCourseSummary = (input: Schema.Codec.Encoded<typeof CourseSummarySchema>) =>
  decodeCourseSummary(input);
