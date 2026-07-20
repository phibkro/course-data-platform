import * as Schema from 'effect/Schema';

export const InstitutionIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('InstitutionId'),
);
export type InstitutionId = Schema.Schema.Type<typeof InstitutionIdSchema>;

export const CourseIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.brand('CourseId'));
export type CourseId = Schema.Schema.Type<typeof CourseIdSchema>;

export const CourseVersionIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('CourseVersionId'),
);
export type CourseVersionId = Schema.Schema.Type<typeof CourseVersionIdSchema>;

export const AcademicYearSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(2000, 2200),
  Schema.brand('AcademicYear'),
);
export type AcademicYear = Schema.Schema.Type<typeof AcademicYearSchema>;

export const CourseLevelSchema = Schema.Literal(
  'bachelor',
  'master',
  'phd',
  'continuing-education',
  'unknown',
);
export type CourseLevel = Schema.Schema.Type<typeof CourseLevelSchema>;

export const SourceReferenceSchema = Schema.Struct({
  provider: Schema.String.pipe(Schema.minLength(1)),
  recordId: Schema.String.pipe(Schema.minLength(1)),
  retrievedAt: Schema.DateFromString,
});
export type SourceReference = Schema.Schema.Type<typeof SourceReferenceSchema>;

export const CourseSummarySchema = Schema.Struct({
  id: CourseVersionIdSchema,
  courseId: CourseIdSchema,
  institutionId: InstitutionIdSchema,
  institutionShortName: Schema.String.pipe(Schema.minLength(1)),
  code: Schema.String.pipe(Schema.minLength(1)),
  title: Schema.String.pipe(Schema.minLength(1)),
  academicYear: AcademicYearSchema,
  credits: Schema.NullOr(Schema.Number.pipe(Schema.between(0, 60))),
  level: CourseLevelSchema,
  teachingLanguage: Schema.NullOr(Schema.String.pipe(Schema.minLength(2))),
  source: SourceReferenceSchema,
});
export type CourseSummary = Schema.Schema.Type<typeof CourseSummarySchema>;

export const decodeCourseSummary = Schema.decodeUnknownSync(CourseSummarySchema);
export const decodeInstitutionId = Schema.decodeUnknownSync(InstitutionIdSchema);
export const decodeAcademicYear = Schema.decodeUnknownSync(AcademicYearSchema);

export const makeCourseSummary = (input: Schema.Schema.Encoded<typeof CourseSummarySchema>) =>
  decodeCourseSummary(input);
