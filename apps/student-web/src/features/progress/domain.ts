import { Result, Schema as S } from 'effect';

import {
  courseCodeSource,
  isCourseCode,
  ntnuCourseIdentity,
  type CourseIdentity,
} from '../../course-identity';

/**
 * Pure student-authored progress data. The bounded credit, retake, import, and
 * timeline techniques are adapted from MIT-licensed Karakter prior art
 * (courses.ts, parser.ts, snapshot.ts, and session.ts), not its UI, Rust/Wasm,
 * workers, or document data.
 */

const maximumResults = 2_000;
const maximumCourseCredits = 600;
const maximumTranscriptBytes = 2_000_000;
const minimumYear = 1900;
const maximumYear = 2100;
const minimumTargetCredits = 1;
const maximumImportReceipts = 200;
const maximumTimelineEntries = 50;
const maximumVocabularyLabels = 100;
const maximumVocabularyLabelBytes = 80;
const maximumReceiptDateBytes = 10;
const maximumTotalCredits = maximumResults * maximumCourseCredits;

export const progressLimits = {
  maximumResults,
  maximumCourseCredits,
  maximumTranscriptBytes,
  minimumYear,
  maximumYear,
  minimumTargetCredits,
  maximumImportReceipts,
  maximumTimelineEntries,
  maximumVocabularyLabels,
  maximumVocabularyLabelBytes,
} as const;

export const gradeValues = ['A', 'B', 'C', 'D', 'E', 'F', 'pass', 'fail', 'recognized'] as const;
export const termValues = [1, 2] as const;
export const retakeValues = ['latest', 'best'] as const;

const utf8 = new TextEncoder();
const courseStartPattern = new RegExp(`^${courseCodeSource}\\s`, 'iu');
const draftCreditsPattern = /^\+?(?:\d+(?:[,.]\d*)?|[,.]\d+)$/u;
const receiptDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

const normalizedText = (value: string): string => value.replace(/\s+/gu, ' ').trim();
const byteLength = (value: string): number => utf8.encode(value).byteLength;
const vocabularyKey = (value: string): string => normalizedText(value).toLowerCase();

const isHundredthCreditValue = (value: number, maximum: number, minimum = 0): boolean => {
  if (!Number.isFinite(value) || value < minimum || value > maximum) return false;
  const units = Math.round(value * 100);
  return Math.abs(value - units / 100) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 16;
};

const isReceiptDate = (value: string): boolean => {
  if (byteLength(value) > maximumReceiptDateBytes) return false;
  const match = receiptDatePattern.exec(value);
  if (match === null) return false;
  const year = match[1];
  const month = match[2];
  const day = match[3];
  if (year === undefined || month === undefined || day === undefined) return false;
  const iso = `${year}-${month}-${day}T00:00:00.000Z`;
  const date = new Date(iso);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const CreditSchema = S.Finite.check(
  S.isBetween({ minimum: 0, maximum: maximumCourseCredits }),
  S.makeFilter<number>((value) =>
    isHundredthCreditValue(value, maximumCourseCredits)
      ? undefined
      : 'Credits must be a non-negative value with at most two decimal places.',
  ),
);

export const TargetCreditsSchema = S.Finite.check(
  S.isBetween({ minimum: minimumTargetCredits, maximum: maximumCourseCredits }),
  S.makeFilter<number>((value) =>
    isHundredthCreditValue(value, maximumCourseCredits, minimumTargetCredits)
      ? undefined
      : `Target credits must be between ${minimumTargetCredits} and ${maximumCourseCredits} with at most two decimal places.`,
  ),
);

const YearSchema = S.Int.check(S.isBetween({ minimum: minimumYear, maximum: maximumYear }));
export const TermSchema = S.Literals(termValues);
export type Term = typeof TermSchema.Type;

export const GradeSchema = S.Literals(gradeValues);
export type Grade = typeof GradeSchema.Type;

export const CourseResultSchema = S.Struct({
  institution: S.String,
  code: S.String,
  name: S.String,
  year: YearSchema,
  term: TermSchema,
  credits: CreditSchema,
  grade: GradeSchema,
  included: S.Boolean,
});
export type CourseResult = typeof CourseResultSchema.Type;

export const CourseDraftFieldsSchema = S.Struct({
  institution: S.String,
  code: S.String,
  name: S.String,
  year: S.String,
  term: S.String,
  credits: S.String,
  grade: S.String,
  included: S.Boolean,
});

export interface CourseDraftFields {
  readonly institution: string;
  readonly code: string;
  readonly name: string;
  readonly year: string;
  readonly term: string;
  readonly credits: string;
  readonly grade: string;
  readonly included: boolean;
}

export type CourseDraftField = keyof CourseDraftFields;
export type CourseDraftErrors = Readonly<Partial<Record<CourseDraftField, string>>>;

export type CourseDraftValidation =
  | { readonly ok: true; readonly result: CourseResult }
  | { readonly ok: false; readonly errors: CourseDraftErrors };

export const PolicySchema = S.Struct({
  includeF: S.Boolean,
  retakes: S.Literals(retakeValues),
});
export type Policy = typeof PolicySchema.Type;

const ReceiptDateSchema = S.String.check(
  S.makeFilter<string>((value) =>
    isReceiptDate(value) ? undefined : 'An import receipt date must be an ISO calendar date.',
  ),
);
const ReceiptCountSchema = S.Int.check(S.isBetween({ minimum: 0, maximum: maximumResults }));
const ReceiptCreditsSchema = S.Finite.check(
  S.isBetween({ minimum: 0, maximum: maximumTotalCredits }),
  S.makeFilter<number>((value) =>
    isHundredthCreditValue(value, maximumTotalCredits)
      ? undefined
      : 'Receipt credits must have at most two decimal places.',
  ),
);
const ReceiptAverageSchema = S.Finite.check(S.isBetween({ minimum: 0, maximum: 5 }));

/** A bounded, dated record of a completed local transcript merge. */
export const ImportReceiptSchema = S.Struct({
  at: ReceiptDateSchema,
  importedResults: ReceiptCountSchema,
  totalResults: ReceiptCountSchema,
  average: S.NullOr(ReceiptAverageSchema),
  earnedCredits: ReceiptCreditsSchema,
});
export type ImportReceipt = typeof ImportReceiptSchema.Type;

export const ProgressStateSchema = S.Struct({
  version: S.Literal(2),
  results: S.Array(CourseResultSchema).check(S.isMaxLength(maximumResults)),
  policy: PolicySchema,
  targetCredits: TargetCreditsSchema,
  importReceipts: S.Array(ImportReceiptSchema).check(S.isMaxLength(maximumImportReceipts)),
});
export type ProgressState = typeof ProgressStateSchema.Type;

const LegacyProgressStateSchema = S.Struct({
  version: S.Literal(1),
  results: S.Array(CourseResultSchema).check(S.isMaxLength(maximumResults)),
  policy: PolicySchema,
});
type LegacyProgressState = typeof LegacyProgressStateSchema.Type;

const TotalCreditsSchema = S.Finite.check(S.isGreaterThanOrEqualTo(0));
export const TranscriptProposalSchema = S.Struct({
  results: S.Array(CourseResultSchema).check(S.isMaxLength(maximumResults)),
  warnings: S.Array(S.String).check(S.isMaxLength(maximumResults)),
  statedCredits: S.NullOr(TotalCreditsSchema),
});
export type TranscriptProposal = typeof TranscriptProposalSchema.Type;

export interface GradeCreditDistribution {
  readonly grade: Grade;
  readonly credits: number;
  readonly courses: number;
}

export interface SemesterAveragePoint {
  readonly year: number;
  readonly term: Term;
  readonly average: number | null;
  readonly gradedCredits: number;
  readonly weightedSum: number;
}

export interface ProgressSummary {
  readonly average: number | null;
  readonly weightedSum: number;
  readonly earnedCredits: number;
  readonly gradedCredits: number;
  readonly includedCourses: number;
  readonly supersededAttempts: number;
  /** Credits among selected, included attempts, including pass/fail outcomes. */
  readonly gradeCredits: Readonly<Record<Grade, number>>;
}

export const progressStorageKey = 'course-lens:progress';
export const progressBackupKind = 'course-lens-progress-backup';
export const progressBackupVersion = 2;

export const defaultPolicy: Policy = {
  includeF: true,
  retakes: 'latest',
};

export const emptyProgressState: ProgressState = {
  version: 2,
  results: [],
  policy: defaultPolicy,
  targetCredits: 180,
  importReceipts: [],
};

/** A fixed example so demos, snapshots, and tests never depend on the clock. */
export const exampleProgressState: ProgressState = {
  version: 2,
  results: [
    {
      institution: 'Example University',
      code: 'INF100',
      name: 'Introduction to programming',
      year: 2024,
      term: 2,
      credits: 10,
      grade: 'B',
      included: true,
    },
    {
      institution: 'Example University',
      code: 'MAT101',
      name: 'Discrete mathematics',
      year: 2024,
      term: 2,
      credits: 10,
      grade: 'C',
      included: true,
    },
    {
      institution: 'Example University',
      code: 'INF120',
      name: 'Object-oriented programming',
      year: 2025,
      term: 1,
      credits: 10,
      grade: 'A',
      included: true,
    },
    {
      institution: 'Example University',
      code: 'INF150',
      name: 'Databases',
      year: 2025,
      term: 1,
      credits: 10,
      grade: 'B',
      included: true,
    },
    {
      institution: 'Example University',
      code: 'INF200',
      name: 'Software project',
      year: 2025,
      term: 2,
      credits: 15,
      grade: 'B',
      included: true,
    },
    {
      institution: 'Example University',
      code: 'INF210',
      name: 'Human-computer interaction',
      year: 2025,
      term: 2,
      credits: 7.5,
      grade: 'pass',
      included: true,
    },
    {
      institution: 'Example University',
      code: 'INF220',
      name: 'Web development',
      year: 2026,
      term: 1,
      credits: 10,
      grade: 'A',
      included: true,
    },
    {
      institution: 'Example University',
      code: 'INF230',
      name: 'Algorithms',
      year: 2026,
      term: 1,
      credits: 7.5,
      grade: 'C',
      included: true,
    },
  ],
  policy: defaultPolicy,
  targetCredits: 180,
  importReceipts: [],
};

export type ProgressDecodeFailureReason =
  | 'invalid-json'
  | 'too-large'
  | 'missing-version'
  | 'unsupported-version'
  | 'invalid-shape';

export type ProgressDecodeResult =
  | { readonly ok: true; readonly state: ProgressState }
  | { readonly ok: false; readonly reason: ProgressDecodeFailureReason; readonly raw: string };

class ProgressDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgressDataError';
  }
}

const invalid = (message: string): never => {
  throw new ProgressDataError(message);
};

const isGrade = (value: string): value is Grade =>
  (gradeValues as ReadonlyArray<string>).includes(value);

const toCreditUnits = (credits: number, maximum = maximumCourseCredits, minimum = 0): number => {
  if (!isHundredthCreditValue(credits, maximum, minimum)) {
    invalid(`Credits must be between ${minimum} and ${maximum} with at most two decimal places.`);
  }
  return Math.round(credits * 100);
};

const assertText = (value: string, field: string, maximumBytes: number): void => {
  if (normalizedText(value).length === 0 || byteLength(value) > maximumBytes) {
    invalid(`${field} must be present and within its size limit.`);
  }
};

export const courseIdentityKey = (result: Pick<CourseResult, 'institution' | 'code'>): string =>
  JSON.stringify([
    normalizedText(result.institution).toUpperCase(),
    normalizedText(result.code).toUpperCase(),
  ]);

/** The stable identity of one result attempt, including its completed term. */
export const courseAttemptKey = (
  result: Pick<CourseResult, 'institution' | 'code' | 'year' | 'term'>,
): string => `${courseIdentityKey(result)}:${result.year}:${result.term}`;

const decodeCourseResult = S.decodeUnknownResult(CourseResultSchema, { onExcessProperty: 'error' });
const decodePolicy = S.decodeUnknownResult(PolicySchema, { onExcessProperty: 'error' });
const decodeTargetCredits = S.decodeUnknownResult(TargetCreditsSchema, {
  onExcessProperty: 'error',
});
const decodeImportReceipt = S.decodeUnknownResult(ImportReceiptSchema, {
  onExcessProperty: 'error',
});
const decodeState = S.decodeUnknownResult(ProgressStateSchema, { onExcessProperty: 'error' });
const decodeLegacyState = S.decodeUnknownResult(LegacyProgressStateSchema, {
  onExcessProperty: 'error',
});

export const validateCourseResult = (candidate: unknown): CourseResult => {
  const decoded = decodeCourseResult(candidate);
  if (Result.isFailure(decoded)) return invalid('A result has an invalid shape.');

  const result = decoded.success;
  assertText(result.institution, 'Institution', 100);
  assertText(result.code, 'Course code', 40);
  assertText(result.name, 'Course name', 500);
  if (!isCourseCode(normalizedText(result.code))) invalid('Course code is invalid.');
  toCreditUnits(result.credits);
  return result;
};

export const validatePolicy = (candidate: unknown): Policy => {
  const decoded = decodePolicy(candidate);
  if (Result.isFailure(decoded)) return invalid('The calculation policy is invalid.');
  return decoded.success;
};

export const validateTargetCredits = (candidate: unknown): number => {
  const decoded = decodeTargetCredits(candidate);
  if (Result.isFailure(decoded)) {
    return invalid(
      `Target credits must be between ${minimumTargetCredits} and ${maximumCourseCredits} with at most two decimal places.`,
    );
  }
  return decoded.success;
};

const validateImportReceipt = (candidate: unknown): ImportReceipt => {
  const decoded = decodeImportReceipt(candidate);
  if (Result.isFailure(decoded)) return invalid('An import receipt has an invalid shape.');
  return decoded.success;
};

export const courseResultToDraft = (result: CourseResult): CourseDraftFields => ({
  institution: result.institution,
  code: result.code,
  name: result.name,
  year: String(result.year),
  term: String(result.term),
  credits: String(result.credits),
  grade: result.grade,
  included: result.included,
});

const fieldText = (
  source: object | null,
  field: Extract<CourseDraftField, 'institution' | 'code' | 'name'>,
  label: string,
  maximumBytes: number,
  errors: Partial<Record<CourseDraftField, string>>,
): string | null => {
  const value =
    source !== null && Object.hasOwn(source, field) ? Reflect.get(source, field) : undefined;
  if (typeof value !== 'string') {
    errors[field] = `Enter a ${label.toLowerCase()}.`;
    return null;
  }
  const normalized = normalizedText(value);
  if (normalized.length === 0) {
    errors[field] = `Enter a ${label.toLowerCase()}.`;
    return null;
  }
  if (byteLength(value) > maximumBytes) {
    errors[field] = `${label} is too long.`;
    return null;
  }
  return normalized;
};

/**
 * Converts raw form fields into a normalized result without throwing for
 * expected editing errors. The same helper serves manual add, edit, and import
 * row correction.
 */
export const validateCourseDraft = (draft: unknown): CourseDraftValidation => {
  const source =
    typeof draft === 'object' && draft !== null && !Array.isArray(draft) ? draft : null;
  const errors: Partial<Record<CourseDraftField, string>> = {};

  const institution = fieldText(source, 'institution', 'Institution', 100, errors);
  const unnormalizedCode = fieldText(source, 'code', 'Course code', 40, errors);
  const name = fieldText(source, 'name', 'Course name', 500, errors);
  const code = unnormalizedCode === null ? null : unnormalizedCode.toUpperCase();
  if (code !== null && !isCourseCode(code)) {
    errors.code = 'Enter a valid course code.';
  }

  const rawYear = source !== null && 'year' in source ? source.year : undefined;
  const yearText = typeof rawYear === 'string' ? rawYear.trim() : '';
  const year = /^\d{4}$/u.test(yearText) ? Number(yearText) : null;
  if (year === null || year < minimumYear || year > maximumYear) {
    errors.year = `Enter a year between ${minimumYear} and ${maximumYear}.`;
  }

  const rawTerm = source !== null && 'term' in source ? source.term : undefined;
  const termText = typeof rawTerm === 'string' ? rawTerm.trim() : '';
  const term: Term | null = termText === '1' ? 1 : termText === '2' ? 2 : null;
  if (term === null) errors.term = 'Select term 1 or 2.';

  const rawCredits = source !== null && 'credits' in source ? source.credits : undefined;
  const creditsText = typeof rawCredits === 'string' ? rawCredits.trim() : '';
  const credits = draftCreditsPattern.test(creditsText)
    ? Number(creditsText.replace(',', '.'))
    : null;
  if (credits === null || !isHundredthCreditValue(credits, maximumCourseCredits)) {
    errors.credits = `Enter credits between 0 and ${maximumCourseCredits} with at most two decimal places.`;
  }

  const rawGrade = source !== null && 'grade' in source ? source.grade : undefined;
  const gradeText = typeof rawGrade === 'string' ? rawGrade.trim() : '';
  const grade: Grade | null = isGrade(gradeText) ? gradeText : null;
  if (grade === null) errors.grade = 'Select a supported grade.';

  const included = source !== null && 'included' in source ? source.included : undefined;
  if (typeof included !== 'boolean') errors.included = 'Choose whether to include this result.';
  if (
    institution === null ||
    code === null ||
    name === null ||
    year === null ||
    term === null ||
    credits === null ||
    grade === null ||
    typeof included !== 'boolean' ||
    Object.keys(errors).length > 0
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    result: {
      institution,
      code,
      name,
      year,
      term,
      credits: Math.round(credits * 100) / 100,
      grade,
      included,
    },
  };
};

export type TargetCreditsValidation =
  | { readonly ok: true; readonly targetCredits: number }
  | { readonly ok: false; readonly error: string };

/** Parses the text field used for the local credit target. */
export const validateTargetCreditsDraft = (value: string): TargetCreditsValidation => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!draftCreditsPattern.test(text)) {
    return { ok: false, error: 'Enter target credits as a number.' };
  }
  const targetCredits = Number(text.replace(',', '.'));
  if (!isHundredthCreditValue(targetCredits, maximumCourseCredits, minimumTargetCredits)) {
    return {
      ok: false,
      error: `Target credits must be between ${minimumTargetCredits} and ${maximumCourseCredits} with at most two decimal places.`,
    };
  }
  return { ok: true, targetCredits: Math.round(targetCredits * 100) / 100 };
};

interface PreparedResult {
  readonly result: CourseResult;
  readonly units: number;
}

const sameAttempt = (left: PreparedResult, right: PreparedResult): boolean =>
  left.units === right.units &&
  left.result.grade === right.result.grade &&
  normalizedText(left.result.name) === normalizedText(right.result.name);

/**
 * Validate every input before selection. Identical legacy duplicates remain
 * decodable, but conflicting facts for one attempt identity are never merged.
 */
const prepareResults = (results: ReadonlyArray<CourseResult>): ReadonlyArray<PreparedResult> => {
  if (!Array.isArray(results) || results.length > maximumResults) {
    invalid(`At most ${maximumResults} results can be calculated.`);
  }

  const attempts = new Map<string, PreparedResult>();
  for (const candidate of results) {
    const result = validateCourseResult(candidate);
    const prepared: PreparedResult = { result, units: toCreditUnits(result.credits) };
    const key = courseAttemptKey(result);
    const previous = attempts.get(key);
    if (previous !== undefined) {
      if (!sameAttempt(previous, prepared)) {
        invalid(
          `Conflicting results for ${normalizedText(result.code)} in the same semester cannot be calculated.`,
        );
      }
      if (prepared.result.included && !previous.result.included) attempts.set(key, prepared);
      continue;
    }
    attempts.set(key, prepared);
  }
  return [...attempts.values()];
};

const gradePoints = (grade: Grade): number | null => {
  switch (grade) {
    case 'A':
      return 5;
    case 'B':
      return 4;
    case 'C':
      return 3;
    case 'D':
      return 2;
    case 'E':
      return 1;
    case 'F':
      return 0;
    case 'pass':
    case 'fail':
    case 'recognized':
      return null;
  }
};

const isPassed = (grade: Grade): boolean => grade !== 'F' && grade !== 'fail';
const semesterOrdinal = (result: Pick<CourseResult, 'year' | 'term'>): number =>
  result.year * 2 + result.term;

const shouldReplace = (
  candidate: PreparedResult,
  current: PreparedResult,
  retakes: Policy['retakes'],
): boolean => {
  const candidatePoints = gradePoints(candidate.result.grade) ?? -1;
  const currentPoints = gradePoints(current.result.grade) ?? -1;
  if (retakes === 'best' && candidatePoints !== currentPoints)
    return candidatePoints > currentPoints;
  return semesterOrdinal(candidate.result) > semesterOrdinal(current.result);
};

const sortedResults = (results: ReadonlyArray<CourseResult>): ReadonlyArray<CourseResult> =>
  [...results].sort((left, right) => {
    const semesterDifference = semesterOrdinal(right) - semesterOrdinal(left);
    if (semesterDifference !== 0) return semesterDifference;
    const leftKey = courseIdentityKey(left);
    const rightKey = courseIdentityKey(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });

export interface NtnuResultCourse {
  readonly identity: CourseIdentity;
  readonly title: string;
  readonly latest: CourseResult;
  readonly results: ReadonlyArray<CourseResult>;
}

/**
 * Groups result attempts by the same canonical NTNU identity. Non-NTNU
 * institutions remain available in Progress but cannot enter the NTNU list.
 */
export const ntnuResultCourses = (
  results: ReadonlyArray<CourseResult>,
): ReadonlyArray<NtnuResultCourse> => {
  const grouped = new Map<string, { identity: CourseIdentity; results: Array<CourseResult> }>();
  for (const result of sortedResults(results)) {
    const identity = ntnuCourseIdentity(result.institution, result.code);
    if (identity === null) continue;
    const existing = grouped.get(identity.savedCourseId);
    if (existing === undefined) {
      grouped.set(identity.savedCourseId, { identity, results: [result] });
    } else {
      existing.results.push(result);
    }
  }
  return [...grouped.values()].map(({ identity, results: attempts }) => {
    const latest = attempts[0];
    if (latest === undefined) throw new Error('A grouped result course must contain an attempt.');
    return { identity, title: latest.name, latest, results: attempts };
  });
};

export interface AttemptPartition {
  readonly selected: ReadonlyArray<CourseResult>;
  readonly previous: ReadonlyArray<CourseResult>;
}

/**
 * Picks one visible attempt per course while retaining every non-selected
 * attempt. Included attempts take precedence over excluded ones; within that
 * group, the active retake rule chooses latest or best.
 */
export const partitionAttempts = (
  results: ReadonlyArray<CourseResult>,
  policy: Policy = defaultPolicy,
): AttemptPartition => {
  const checkedPolicy = validatePolicy(policy);
  const selected = new Map<string, PreparedResult>();
  const previous: Array<PreparedResult> = [];

  for (const candidate of prepareResults(results)) {
    const key = courseIdentityKey(candidate.result);
    const current = selected.get(key);
    if (current === undefined) {
      selected.set(key, candidate);
      continue;
    }

    const candidateWins =
      candidate.result.included !== current.result.included
        ? candidate.result.included
        : shouldReplace(candidate, current, checkedPolicy.retakes);
    if (candidateWins) {
      previous.push(current);
      selected.set(key, candidate);
    } else {
      previous.push(candidate);
    }
  }

  return {
    selected: sortedResults([...selected.values()].map(({ result }) => result)),
    previous: sortedResults(previous.map(({ result }) => result)),
  };
};

interface ProgressCalculation {
  readonly numerator: number;
  readonly denominator: number;
  readonly earnedUnits: number;
  readonly includedCourses: number;
  readonly supersededAttempts: number;
  readonly gradeCredits: Record<Grade, number>;
  readonly gradeCourses: Record<Grade, number>;
}

const emptyGradeCredits = (): Record<Grade, number> => ({
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
  F: 0,
  pass: 0,
  fail: 0,
  recognized: 0,
});

const calculateUnits = (
  results: ReadonlyArray<CourseResult>,
  policy: Policy,
): ProgressCalculation => {
  const checkedPolicy = validatePolicy(policy);
  const attempts = prepareResults(results);
  const partition = partitionAttempts(results, checkedPolicy);
  const earned = new Map<string, number>();
  let includedAttempts = 0;

  for (const attempt of attempts) {
    if (!attempt.result.included) continue;
    includedAttempts += 1;
    if (isPassed(attempt.result.grade)) {
      const key = courseIdentityKey(attempt.result);
      earned.set(key, Math.max(earned.get(key) ?? 0, attempt.units));
    }
  }

  const gradeCredits = emptyGradeCredits();
  const gradeCourses = emptyGradeCredits();
  let numerator = 0;
  let denominator = 0;
  let includedCourses = 0;
  for (const result of partition.selected) {
    if (!result.included) continue;
    const units = toCreditUnits(result.credits);
    includedCourses += 1;
    gradeCredits[result.grade] += units / 100;
    gradeCourses[result.grade] += 1;
    const points = gradePoints(result.grade);
    if (points !== null && (checkedPolicy.includeF || result.grade !== 'F')) {
      numerator += units * points;
      denominator += units;
    }
  }

  let earnedUnits = 0;
  for (const units of earned.values()) earnedUnits += units;

  return {
    numerator,
    denominator,
    earnedUnits,
    includedCourses,
    supersededAttempts: includedAttempts - includedCourses,
    gradeCredits,
    gradeCourses,
  };
};

/**
 * Calculates only from the student's local results. Credit arithmetic remains
 * in integer hundredths until this display-oriented summary is returned.
 */
export const calculateProgress = (
  results: ReadonlyArray<CourseResult>,
  policy: Policy = defaultPolicy,
): ProgressSummary => {
  const calculation = calculateUnits(results, policy);
  return {
    average: calculation.denominator === 0 ? null : calculation.numerator / calculation.denominator,
    weightedSum: calculation.numerator / 100,
    earnedCredits: calculation.earnedUnits / 100,
    gradedCredits: calculation.denominator / 100,
    includedCourses: calculation.includedCourses,
    supersededAttempts: calculation.supersededAttempts,
    gradeCredits: calculation.gradeCredits,
  };
};

/** Credits and course counts for every canonical grade among selected attempts. */
export const gradeCreditDistribution = (
  results: ReadonlyArray<CourseResult>,
  policy: Policy = defaultPolicy,
): ReadonlyArray<GradeCreditDistribution> => {
  const calculation = calculateUnits(results, policy);
  return gradeValues.map((grade) => ({
    grade,
    credits: calculation.gradeCredits[grade],
    courses: calculation.gradeCourses[grade],
  }));
};

/**
 * A chronological series whose final point always agrees with the selected
 * attempts and policy used by the progress summary.
 */
export const cumulativeSemesterAverageSeries = (
  results: ReadonlyArray<CourseResult>,
  policy: Policy = defaultPolicy,
): ReadonlyArray<SemesterAveragePoint> => {
  const checkedPolicy = validatePolicy(policy);
  const selected = partitionAttempts(results, checkedPolicy)
    .selected.filter((result) => result.included)
    .sort((left, right) => {
      const semesterDifference = semesterOrdinal(left) - semesterOrdinal(right);
      if (semesterDifference !== 0) return semesterDifference;
      const leftKey = courseIdentityKey(left);
      const rightKey = courseIdentityKey(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });

  const series: Array<SemesterAveragePoint> = [];
  let numerator = 0;
  let denominator = 0;
  let currentYear: number | null = null;
  let currentTerm: Term | null = null;

  const appendPoint = (): void => {
    if (currentYear === null || currentTerm === null) return;
    series.push({
      year: currentYear,
      term: currentTerm,
      average: denominator === 0 ? null : numerator / denominator,
      gradedCredits: denominator / 100,
      weightedSum: numerator / 100,
    });
  };

  for (const result of selected) {
    if (currentYear !== null && (result.year !== currentYear || result.term !== currentTerm)) {
      appendPoint();
    }
    currentYear = result.year;
    currentTerm = result.term;

    const points = gradePoints(result.grade);
    if (points !== null && (checkedPolicy.includeF || result.grade !== 'F')) {
      const units = toCreditUnits(result.credits);
      numerator += units * points;
      denominator += units;
    }
  }
  appendPoint();
  return series;
};

export type CourseResultField = Exclude<keyof CourseResult, 'included'>;
export type ImportMergeDisposition = 'new' | 'update' | 'unchanged' | 'previous';

export interface ImportMergeDifference {
  readonly attemptKey: string;
  readonly disposition: ImportMergeDisposition;
  /** Existing data for this exact attempt, when the import replaces or repeats it. */
  readonly prior: CourseResult | null;
  /** The effective row after preserving an existing inclusion decision. */
  readonly next: CourseResult;
  readonly changedFields: ReadonlyArray<CourseResultField>;
}

export interface ImportMergePreview {
  readonly results: ReadonlyArray<CourseResult>;
  readonly differences: ReadonlyArray<ImportMergeDifference>;
}

const comparableCourseFields: ReadonlyArray<CourseResultField> = [
  'institution',
  'code',
  'name',
  'year',
  'term',
  'credits',
  'grade',
];

const changedCourseFields = (
  previous: CourseResult,
  next: CourseResult,
): ReadonlyArray<CourseResultField> =>
  comparableCourseFields.filter((field) => previous[field] !== next[field]);

/**
 * Reports row-level merge dispositions before mutating state. A re-import of
 * the same attempt updates source facts but always preserves the student's
 * existing inclusion choice; a different term remains an earlier attempt.
 */
export const previewImportMerge = (
  existing: ReadonlyArray<CourseResult>,
  incoming: ReadonlyArray<CourseResult>,
  policy: Policy = defaultPolicy,
): ImportMergePreview => {
  const checkedPolicy = validatePolicy(policy);
  const merged = new Map<string, PreparedResult>();
  for (const prepared of prepareResults(existing))
    merged.set(courseAttemptKey(prepared.result), prepared);

  const pendingDifferences: Array<Omit<ImportMergeDifference, 'disposition'>> = [];
  for (const prepared of prepareResults(incoming)) {
    const key = courseAttemptKey(prepared.result);
    const prior = merged.get(key);
    const next =
      prior === undefined
        ? prepared.result
        : { ...prepared.result, included: prior.result.included };
    pendingDifferences.push({
      attemptKey: key,
      prior: prior?.result ?? null,
      next,
      changedFields: prior === undefined ? [] : changedCourseFields(prior.result, next),
    });
    merged.set(key, { result: next, units: prepared.units });
  }

  if (merged.size > maximumResults) invalid(`At most ${maximumResults} results can be retained.`);
  const results = sortedResults([...merged.values()].map(({ result }) => result));
  const previousAttemptKeys = new Set(
    partitionAttempts(results, checkedPolicy).previous.map((result) => courseAttemptKey(result)),
  );
  const differences: ReadonlyArray<ImportMergeDifference> = pendingDifferences.map(
    (difference): ImportMergeDifference => ({
      ...difference,
      disposition: previousAttemptKeys.has(difference.attemptKey)
        ? 'previous'
        : difference.prior === null
          ? 'new'
          : difference.changedFields.length === 0
            ? 'unchanged'
            : 'update',
    }),
  );
  calculateProgress(results, checkedPolicy);
  return { results, differences };
};

/** Existing callers that only need the merged rows retain this small API. */
export const mergeResults = (
  existing: ReadonlyArray<CourseResult>,
  incoming: ReadonlyArray<CourseResult>,
): ReadonlyArray<CourseResult> => previewImportMerge(existing, incoming).results;

export interface TranscriptVocabulary {
  readonly terms: Readonly<Record<string, Term>>;
  readonly grades: Readonly<Record<string, Grade>>;
  readonly totalLabels: ReadonlyArray<string>;
}

export const defaultTranscriptVocabulary: TranscriptVocabulary = {
  terms: {
    vår: 1,
    høst: 2,
    haust: 2,
    spring: 1,
    autumn: 2,
  },
  grades: {
    a: 'A',
    b: 'B',
    c: 'C',
    d: 'D',
    e: 'E',
    f: 'F',
    bestått: 'pass',
    passed: 'pass',
    pass: 'pass',
    greidd: 'pass',
    'ikke bestått': 'fail',
    failed: 'fail',
    innpasset: 'recognized',
    recognized: 'recognized',
  },
  totalLabels: ['Sum studiepoeng', 'Totalt studiepoeng', 'Total credits', 'Sum', 'Total', 'Totalt'],
};

const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint <= 0x1f || codePoint === 0x7f) return true;
  }
  return false;
};

const assertVocabularyLabel = (label: string, kind: string, seen: Set<string>): void => {
  const key = vocabularyKey(label);
  if (
    label !== normalizedText(label) ||
    label.length === 0 ||
    byteLength(label) > maximumVocabularyLabelBytes ||
    hasControlCharacter(label)
  ) {
    invalid(`The ${kind} vocabulary has an invalid literal.`);
  }
  if (seen.has(key)) invalid(`The ${kind} vocabulary has ambiguous literals.`);
  seen.add(key);
};

/**
 * Checks every literal before it becomes a regex alternative. Labels are
 * matched case-insensitively after whitespace normalization, so that is also
 * the ambiguity boundary.
 */
interface UncheckedTranscriptVocabulary {
  readonly terms?: unknown;
  readonly grades?: unknown;
  readonly totalLabels?: unknown;
}

export const validateTranscriptVocabulary = (candidate: unknown): TranscriptVocabulary => {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return invalid('Transcript vocabulary has an invalid shape.');
  }
  const source = candidate as UncheckedTranscriptVocabulary;
  const rawTerms = source.terms;
  const rawGrades = source.grades;
  const rawTotalLabels = source.totalLabels;
  if (
    typeof rawTerms !== 'object' ||
    rawTerms === null ||
    Array.isArray(rawTerms) ||
    typeof rawGrades !== 'object' ||
    rawGrades === null ||
    Array.isArray(rawGrades) ||
    !Array.isArray(rawTotalLabels)
  ) {
    return invalid('Transcript vocabulary has an invalid shape.');
  }

  const termEntries = Object.entries(rawTerms);
  const gradeEntries = Object.entries(rawGrades);
  if (
    termEntries.length === 0 ||
    termEntries.length > maximumVocabularyLabels ||
    gradeEntries.length === 0 ||
    gradeEntries.length > maximumVocabularyLabels ||
    rawTotalLabels.length === 0 ||
    rawTotalLabels.length > maximumVocabularyLabels
  ) {
    return invalid('Transcript vocabulary has an invalid number of literals.');
  }

  const termSeen = new Set<string>();
  const checkedTerms: Array<readonly [string, Term]> = [];
  for (const [label, value] of termEntries) {
    assertVocabularyLabel(label, 'term', termSeen);
    if (value !== 1 && value !== 2) invalid('The term vocabulary has an invalid mapping.');
    checkedTerms.push([label, value]);
  }

  const gradeSeen = new Set<string>();
  const checkedGrades: Array<readonly [string, Grade]> = [];
  for (const [label, value] of gradeEntries) {
    assertVocabularyLabel(label, 'grade', gradeSeen);
    if (typeof value !== 'string' || !isGrade(value)) {
      invalid('The grade vocabulary has an invalid mapping.');
    }
    checkedGrades.push([label, value]);
  }

  const totalSeen = new Set<string>();
  const totalLabels: Array<string> = [];
  for (const label of rawTotalLabels) {
    if (typeof label !== 'string') invalid('The total vocabulary has an invalid literal.');
    assertVocabularyLabel(label, 'total', totalSeen);
    totalLabels.push(label);
  }

  return {
    terms: Object.fromEntries(checkedTerms),
    grades: Object.fromEntries(checkedGrades),
    totalLabels,
  };
};

interface PreparedVocabulary {
  readonly vocabulary: TranscriptVocabulary;
  readonly terms: ReadonlyMap<string, Term>;
  readonly grades: ReadonlyMap<string, Grade>;
  readonly rowPattern: RegExp;
  readonly totalPattern: RegExp;
}

const regexEscape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const alternatives = (values: ReadonlyArray<string>): string =>
  [...values]
    .sort((left, right) => right.length - left.length)
    .map(regexEscape)
    .join('|');

const prepareVocabulary = (candidate: unknown): PreparedVocabulary => {
  const vocabulary = validateTranscriptVocabulary(candidate);
  const terms = new Map<string, Term>();
  for (const [label, term] of Object.entries(vocabulary.terms)) {
    terms.set(vocabularyKey(label), term);
  }
  const grades = new Map<string, Grade>();
  for (const [label, grade] of Object.entries(vocabulary.grades)) {
    grades.set(vocabularyKey(label), grade);
  }

  return {
    vocabulary,
    terms,
    grades,
    rowPattern: new RegExp(
      `^(${courseCodeSource})\\s+(.+?)\\s+(20\\d{2})\\s+(${alternatives(Object.keys(vocabulary.terms))})\\s+([\\d]+(?:[,.]\\d+)?|[-–])\\s+(${alternatives(Object.keys(vocabulary.grades))})\\s*$`,
      'iu',
    ),
    totalPattern: new RegExp(
      `^\\s*(?:${alternatives(vocabulary.totalLabels)})[ \\t]*:?[ \\t]+(\\d+(?:[,.]\\d+)?)[ \\t]*$`,
      'imu',
    ),
  };
};

const parseTotalCredits = (text: string, pattern: RegExp): number | null => {
  const match = pattern.exec(text);
  const rawCredits = match?.[1];
  if (rawCredits === undefined) return null;
  const credits = Number(rawCredits.replace(',', '.'));
  if (!isHundredthCreditValue(credits, maximumTotalCredits)) return null;
  return Math.round(credits * 100) / 100;
};

/**
 * Parse text already extracted from an NTNU or UiO FS-style transcript. It
 * never manufactures a zero for absent credits: an incomplete course-looking
 * row remains a warning for the student's review instead.
 */
export const parseTranscript = (
  text: string,
  institution: string,
  vocabulary: TranscriptVocabulary = defaultTranscriptVocabulary,
): TranscriptProposal => {
  if (typeof text !== 'string' || byteLength(text) > maximumTranscriptBytes) {
    invalid('Transcript text is unavailable or exceeds the import limit.');
  }

  const normalizedInstitution = normalizedText(institution);
  assertText(normalizedInstitution, 'Institution', 100);
  const preparedVocabulary = prepareVocabulary(vocabulary);
  const results: Array<CourseResult> = [];
  const warnings = new Set<string>();

  for (const sourceLine of text.split(/\r?\n/u)) {
    const line = normalizedText(sourceLine);
    if (line.length === 0) continue;

    const match = preparedVocabulary.rowPattern.exec(line);
    if (match === null) {
      if (courseStartPattern.test(line)) {
        warnings.add(
          'A course-looking row could not be read. Review the original transcript before saving.',
        );
      }
      continue;
    }

    const rawCode = match[1];
    const rawName = match[2];
    const rawYear = match[3];
    const rawTerm = match[4];
    const rawCredits = match[5];
    const rawGrade = match[6];
    if (
      rawCode === undefined ||
      rawName === undefined ||
      rawYear === undefined ||
      rawTerm === undefined ||
      rawCredits === undefined ||
      rawGrade === undefined
    ) {
      warnings.add(
        'A course-looking row could not be read. Review the original transcript before saving.',
      );
      continue;
    }

    if (rawCredits === '-' || rawCredits === '–') {
      warnings.add(
        'A course row has no credit value and was not imported. Review the original transcript.',
      );
      continue;
    }

    const term = preparedVocabulary.terms.get(vocabularyKey(rawTerm));
    const grade = preparedVocabulary.grades.get(vocabularyKey(rawGrade));
    const credits = Number(rawCredits.replace(',', '.'));
    if (
      term === undefined ||
      grade === undefined ||
      !isHundredthCreditValue(credits, maximumCourseCredits)
    ) {
      warnings.add(
        'A course-looking row has unsupported values and was not imported. Review the original transcript.',
      );
      continue;
    }

    results.push({
      institution: normalizedInstitution,
      code: rawCode.toUpperCase(),
      name: normalizedText(rawName),
      year: Number(rawYear),
      term,
      credits: Math.round(credits * 100) / 100,
      grade,
      included: true,
    });
  }

  if (results.length === 0) {
    invalid(
      'No supported course rows were found. Use a text-based NTNU or UiO FS-style transcript and review its layout.',
    );
  }

  const summary = calculateProgress(results, defaultPolicy);
  const statedCredits = parseTotalCredits(text, preparedVocabulary.totalPattern);
  if (statedCredits !== null && Math.abs(statedCredits - summary.earnedCredits) > 0.01) {
    warnings.add(
      'The stated credit total differs from the imported passed credits. Review the course list.',
    );
  }

  return {
    results,
    warnings: [...warnings].sort(),
    statedCredits,
  };
};

export const validateProgressState = (candidate: unknown): ProgressState => {
  const decoded = decodeState(candidate);
  if (Result.isFailure(decoded)) return invalid('Progress state has an invalid shape.');

  const state = decoded.success;
  validatePolicy(state.policy);
  validateTargetCredits(state.targetCredits);
  prepareResults(state.results);
  for (const receipt of state.importReceipts) validateImportReceipt(receipt);
  return state;
};

const migrateV1State = (legacy: LegacyProgressState): ProgressState => ({
  version: 2,
  results: legacy.results,
  policy: legacy.policy,
  targetCredits: 180,
  importReceipts: [],
});

const storedVersion = (value: unknown): number | null => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('version' in value)
  ) {
    return null;
  }
  const version = value.version;
  return typeof version === 'number' && Number.isSafeInteger(version) ? version : null;
};

const decodeParsedState = (parsed: unknown, raw: string): ProgressDecodeResult => {
  const version = storedVersion(parsed);
  if (version === null) return { ok: false, reason: 'missing-version', raw };
  if (version !== 1 && version !== 2) return { ok: false, reason: 'unsupported-version', raw };

  try {
    if (version === 1) {
      const legacy = decodeLegacyState(parsed);
      if (Result.isFailure(legacy)) return { ok: false, reason: 'invalid-shape', raw };
      return { ok: true, state: validateProgressState(migrateV1State(legacy.success)) };
    }

    const decoded = decodeState(parsed);
    if (Result.isFailure(decoded)) return { ok: false, reason: 'invalid-shape', raw };
    return { ok: true, state: validateProgressState(decoded.success) };
  } catch {
    return { ok: false, reason: 'invalid-shape', raw };
  }
};

const parseStoredJson = (
  raw: string,
): { readonly ok: true; readonly parsed: unknown } | { readonly ok: false } => {
  try {
    return { ok: true, parsed: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
};

/**
 * Stored local history is untrusted. Known version-one state is migrated
 * without dropping attempts; every other failure preserves its original bytes.
 */
export const decodeProgressState = (raw: string | null): ProgressDecodeResult => {
  if (raw === null || raw.trim().length === 0) return { ok: true, state: emptyProgressState };
  if (byteLength(raw) > maximumTranscriptBytes) return { ok: false, reason: 'too-large', raw };

  const parsed = parseStoredJson(raw);
  if (!parsed.ok) return { ok: false, reason: 'invalid-json', raw };
  return decodeParsedState(parsed.parsed, raw);
};

export const serializeProgressState = (state: ProgressState): string =>
  JSON.stringify(validateProgressState(state));

/** The current downloadable envelope is separate from browser storage. */
export const ProgressBackupSchema = S.Struct({
  kind: S.Literal(progressBackupKind),
  version: S.Literal(progressBackupVersion),
  state: ProgressStateSchema,
});
export type ProgressBackup = typeof ProgressBackupSchema.Type;

/** Emits a self-identifying versioned JSON backup. */
export const encodeProgressBackup = (state: ProgressState): string =>
  JSON.stringify({
    kind: progressBackupKind,
    version: progressBackupVersion,
    state: validateProgressState(state),
  });

/**
 * Reads current backup envelopes and legacy direct state payloads. The latter
 * makes previously downloaded version-one local state recoverable as a backup.
 */
export const decodeProgressBackup = (raw: string): ProgressDecodeResult => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, reason: 'invalid-json', raw: typeof raw === 'string' ? raw : '' };
  }
  if (byteLength(raw) > maximumTranscriptBytes) return { ok: false, reason: 'too-large', raw };

  const parsed = parseStoredJson(raw);
  if (!parsed.ok) return { ok: false, reason: 'invalid-json', raw };
  const payload = parsed.parsed;
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    !('kind' in payload) ||
    payload.kind !== progressBackupKind
  ) {
    return decodeParsedState(payload, raw);
  }

  const version = storedVersion(payload);
  if (version === null) return { ok: false, reason: 'missing-version', raw };
  if (version !== 1 && version !== 2) return { ok: false, reason: 'unsupported-version', raw };
  if (!('state' in payload)) return { ok: false, reason: 'invalid-shape', raw };
  return decodeParsedState(payload.state, raw);
};

const importReceipt = (
  at: string,
  importedResults: number,
  totalResults: number,
  summary: ProgressSummary,
): ImportReceipt =>
  validateImportReceipt({
    at,
    importedResults,
    totalResults,
    average: summary.average,
    earnedCredits: summary.earnedCredits,
  });

export type ProgressAction =
  | { readonly _tag: 'Import'; readonly results: ReadonlyArray<CourseResult>; readonly at: string }
  | { readonly _tag: 'Add'; readonly result: CourseResult }
  | {
      readonly _tag: 'Edit';
      readonly attemptKey: string;
      readonly result: CourseResult;
    }
  | { readonly _tag: 'Remove'; readonly attemptKey: string }
  | { readonly _tag: 'SetIncluded'; readonly attemptKey: string; readonly included: boolean }
  | { readonly _tag: 'SetPolicy'; readonly policy: Policy }
  | { readonly _tag: 'SetTargetCredits'; readonly targetCredits: number }
  | { readonly _tag: 'RestoreBackup'; readonly state: ProgressState };

const assertAttemptKey = (value: string): string => {
  if (typeof value !== 'string' || value.length === 0) invalid('A course attempt key is required.');
  return value;
};

const hasAttempt = (results: ReadonlyArray<CourseResult>, attemptKey: string): boolean =>
  results.some((result) => courseAttemptKey(result) === attemptKey);

/**
 * Applies one explicit state transition. Earlier attempts are always retained
 * in `results`; only explicit remove can discard them.
 */
export const reduceProgressState = (
  state: ProgressState,
  action: ProgressAction,
): ProgressState => {
  const current = validateProgressState(state);

  switch (action._tag) {
    case 'Import': {
      if (!Array.isArray(action.results) || action.results.length === 0) {
        invalid('An import must contain at least one result.');
      }
      const merged = previewImportMerge(current.results, action.results, current.policy).results;
      const summary = calculateProgress(merged, current.policy);
      const receipt = importReceipt(action.at, action.results.length, merged.length, summary);
      return {
        ...current,
        results: merged,
        importReceipts: [...current.importReceipts, receipt].slice(-maximumImportReceipts),
      };
    }
    case 'Add': {
      const result = validateCourseResult(action.result);
      const key = courseAttemptKey(result);
      if (hasAttempt(current.results, key)) {
        invalid('A result for the same course and semester already exists.');
      }
      if (current.results.length >= maximumResults)
        invalid(`At most ${maximumResults} results can be retained.`);
      return { ...current, results: sortedResults([...current.results, result]) };
    }
    case 'Edit': {
      const oldKey = assertAttemptKey(action.attemptKey);
      if (!hasAttempt(current.results, oldKey)) invalid('The course attempt no longer exists.');
      const result = validateCourseResult(action.result);
      const nextKey = courseAttemptKey(result);
      if (
        nextKey !== oldKey &&
        current.results.some((candidate) => courseAttemptKey(candidate) === nextKey)
      ) {
        invalid('A result for the same course and semester already exists.');
      }
      return {
        ...current,
        results: sortedResults(
          current.results.map((candidate) =>
            courseAttemptKey(candidate) === oldKey ? result : candidate,
          ),
        ),
      };
    }
    case 'Remove': {
      const key = assertAttemptKey(action.attemptKey);
      if (!hasAttempt(current.results, key)) invalid('The course attempt no longer exists.');
      return {
        ...current,
        results: current.results.filter((candidate) => courseAttemptKey(candidate) !== key),
      };
    }
    case 'SetIncluded': {
      const key = assertAttemptKey(action.attemptKey);
      if (typeof action.included !== 'boolean') invalid('Included must be a boolean.');
      if (!hasAttempt(current.results, key)) invalid('The course attempt no longer exists.');
      return {
        ...current,
        results: current.results.map((candidate) =>
          courseAttemptKey(candidate) === key
            ? { ...candidate, included: action.included }
            : candidate,
        ),
      };
    }
    case 'SetPolicy': {
      const policy = validatePolicy(action.policy);
      return { ...current, policy };
    }
    case 'SetTargetCredits':
      return { ...current, targetCredits: validateTargetCredits(action.targetCredits) };
    case 'RestoreBackup':
      return validateProgressState(action.state);
  }
};

export interface ProgressTimelineSnapshot {
  readonly results: ReadonlyArray<CourseResult>;
  readonly importReceipts: ReadonlyArray<ImportReceipt>;
}

export type ProgressTimelineEntryKind = 'import' | 'add' | 'edit' | 'remove' | 'restore';

export interface ProgressTimelineEntry {
  readonly kind: ProgressTimelineEntryKind;
  readonly attemptKey: string | null;
  readonly importedResults: number | null;
  readonly after: ProgressTimelineSnapshot;
}

/** Ephemeral undo/redo state. It is intentionally absent from ProgressState. */
export interface ProgressSession {
  readonly current: ProgressState;
  readonly baseline: ProgressTimelineSnapshot;
  readonly timeline: ReadonlyArray<ProgressTimelineEntry>;
  readonly cursor: number;
}

const stableResults = (results: ReadonlyArray<CourseResult>): ReadonlyArray<CourseResult> =>
  [...results].sort((left, right) => {
    const leftIdentity = courseIdentityKey(left);
    const rightIdentity = courseIdentityKey(right);
    if (leftIdentity !== rightIdentity) return leftIdentity < rightIdentity ? -1 : 1;
    const semesterDifference = semesterOrdinal(left) - semesterOrdinal(right);
    if (semesterDifference !== 0) return semesterDifference;
    return left.included === right.included ? 0 : left.included ? -1 : 1;
  });

const captureTimelineSnapshot = (state: ProgressState): ProgressTimelineSnapshot => ({
  results: stableResults(state.results),
  importReceipts: state.importReceipts,
});

const sameTimelineSnapshot = (
  left: ProgressTimelineSnapshot,
  right: ProgressTimelineSnapshot,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const sameProgressState = (left: ProgressState, right: ProgressState): boolean =>
  left.targetCredits === right.targetCredits &&
  left.policy.includeF === right.policy.includeF &&
  left.policy.retakes === right.policy.retakes &&
  sameTimelineSnapshot(captureTimelineSnapshot(left), captureTimelineSnapshot(right));

export const createProgressSession = (
  state: ProgressState = emptyProgressState,
): ProgressSession => {
  const current = validateProgressState(state);
  return {
    current,
    baseline: captureTimelineSnapshot(current),
    timeline: [],
    cursor: 0,
  };
};

const actionChangesTimeline = (action: ProgressAction): boolean => {
  switch (action._tag) {
    case 'Import':
    case 'Add':
    case 'Edit':
    case 'Remove':
    case 'RestoreBackup':
      return true;
    case 'SetIncluded':
    case 'SetPolicy':
    case 'SetTargetCredits':
      return false;
  }
};

const timelineEntry = (
  action: ProgressAction,
  after: ProgressTimelineSnapshot,
): ProgressTimelineEntry => {
  switch (action._tag) {
    case 'Import':
      return { kind: 'import', attemptKey: null, importedResults: action.results.length, after };
    case 'Add':
      return {
        kind: 'add',
        attemptKey: courseAttemptKey(action.result),
        importedResults: null,
        after,
      };
    case 'Edit':
      return {
        kind: 'edit',
        attemptKey: courseAttemptKey(action.result),
        importedResults: null,
        after,
      };
    case 'Remove':
      return { kind: 'remove', attemptKey: action.attemptKey, importedResults: null, after };
    case 'RestoreBackup':
      return { kind: 'restore', attemptKey: null, importedResults: null, after };
    case 'SetIncluded':
    case 'SetPolicy':
    case 'SetTargetCredits':
      return invalid('Only course changes can enter the progress timeline.');
  }
};

const withIncludedInSnapshot = (
  snapshot: ProgressTimelineSnapshot,
  attemptKey: string,
  included: boolean,
): ProgressTimelineSnapshot => ({
  ...snapshot,
  results: snapshot.results.map((result) =>
    courseAttemptKey(result) === attemptKey ? { ...result, included } : result,
  ),
});

/**
 * Adds only course-changing actions to undo history. Inclusion rewrites every
 * reachable course snapshot so it survives undo/redo; policy and target live
 * outside snapshots and therefore also survive cursor moves.
 */
export const dispatchProgressAction = (
  session: ProgressSession,
  action: ProgressAction,
): ProgressSession => {
  const current = validateProgressState(session.current);
  const next = reduceProgressState(current, action);
  if (sameProgressState(next, current)) return session;

  if (action._tag === 'SetIncluded') {
    const attemptKey = assertAttemptKey(action.attemptKey);
    return {
      ...session,
      current: next,
      baseline: withIncludedInSnapshot(session.baseline, attemptKey, action.included),
      timeline: session.timeline.map((entry) => ({
        ...entry,
        after: withIncludedInSnapshot(entry.after, attemptKey, action.included),
      })),
    };
  }

  if (!actionChangesTimeline(action)) return { ...session, current: next };

  const before = captureTimelineSnapshot(current);
  const after = captureTimelineSnapshot(next);
  if (sameTimelineSnapshot(before, after)) return { ...session, current: next };

  let baseline = session.baseline;
  let timeline = [...session.timeline.slice(0, session.cursor), timelineEntry(action, after)];
  let cursor = session.cursor + 1;
  if (timeline.length > maximumTimelineEntries) {
    const first = timeline[0];
    if (first === undefined) return invalid('Progress timeline is unexpectedly empty.');
    baseline = first.after;
    timeline = timeline.slice(1);
    cursor -= 1;
  }

  return { current: next, baseline, timeline, cursor };
};

/** Moves the cursor without creating a new event or touching persisted state. */
export const seekProgressSession = (session: ProgressSession, cursor: number): ProgressSession => {
  if (
    !Number.isInteger(cursor) ||
    cursor < 0 ||
    cursor > session.timeline.length ||
    cursor === session.cursor
  ) {
    return session;
  }

  const snapshot = cursor === 0 ? session.baseline : session.timeline[cursor - 1]?.after;
  if (snapshot === undefined) return session;
  const current = validateProgressState({
    ...session.current,
    results: snapshot.results,
    importReceipts: snapshot.importReceipts,
  });
  return { ...session, current, cursor };
};
