import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';

export interface NtnuDetailCaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly requestUrl: string;
  readonly courseCode: string;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export interface NtnuDetailAttribution {
  readonly provider: 'ntnu-course-page';
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly requestUrl: string;
  readonly contentHash: string;
  readonly evidenceKind: 'source-fact' | 'fixture';
}

export type FieldState =
  | { readonly state: 'known'; readonly value: string }
  | { readonly state: 'unavailable'; readonly reason: string };

export type AssessmentFormGuess =
  | 'written-exam'
  | 'oral-exam'
  | 'home-exam'
  | 'project'
  | 'portfolio'
  | 'practical'
  | 'assignment'
  | 'other';

export interface ValidatedNtnuCourseDetail {
  readonly courseCode: string;
  readonly sourceRecordId: string;
  readonly attribution: NtnuDetailAttribution;
  readonly credits: number | null;
  readonly teachingLanguage: string | null;
  readonly content: FieldState;
  readonly learningOutcomes: FieldState;
  readonly teachingMethods: FieldState;
  readonly assessmentText: FieldState;
  readonly assessmentFormGuesses: ReadonlyArray<AssessmentFormGuess>;
  readonly obligatoryActivities:
    | { readonly state: 'known'; readonly items: ReadonlyArray<string> }
    | { readonly state: 'unavailable'; readonly reason: string };
  readonly prerequisites: FieldState;
  readonly accessRestrictions: FieldState;
  readonly collaborationSignal: 'individual' | 'group' | 'mixed' | null;
  readonly attendanceSignal: 'required' | 'not-required' | null;
  readonly onlineParticipationSignal: 'available' | 'not-available' | null;
  readonly workFormSignals: ReadonlyArray<
    'lectures' | 'exercises' | 'laboratory' | 'seminar' | 'project' | 'self-study'
  >;
}

export type NtnuDetailRejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-capture-metadata'
  | 'empty-response'
  | 'course-identity-mismatch';

export interface NtnuDetailRejection {
  readonly code: NtnuDetailRejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export type NtnuDetailParseResult =
  | { readonly accepted: ValidatedNtnuCourseDetail; readonly rejected: null }
  | { readonly accepted: null; readonly rejected: NtnuDetailRejection };

const IsoTimestampSchema = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
);
const Sha256Schema = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  requestUrl: Schema.String.pipe(Schema.startsWith('https://www.ntnu.no/studier/emner/')),
  courseCode: Schema.String.pipe(Schema.minLength(1)),
  evidenceKind: Schema.Literal('source-fact', 'fixture'),
});

const stripTags = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&aring;/g, 'å')
    .replace(/&oslash;/g, 'ø')
    .replace(/&aelig;/g, 'æ')
    .replace(/&Aring;/g, 'Å')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&Aelig;/g, 'Æ')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();

const SECTION_LABELS = [
  /Faglig innhold/,
  /Læringsutbytte/,
  /Læringsformer og aktiviteter/,
  /Vurderingsordning/,
  /Mer om vurdering/,
  /Obligatoriske aktiviteter/,
  /Forkunnskapskrav/,
  /Anbefalte forkunnskaper/,
  /Kursmateriell/,
  /Krever opptak til studieprogram/,
  /Studiepoeng/,
  /Undervisningsspråk/,
];

const extractSection = (text: string, label: RegExp, maxLength = 1200): string | null => {
  const match = text.match(label);
  if (!match || match.index === undefined) return null;
  const rest = text.slice(match.index + match[0].length);
  let cut = rest.length;
  for (const stop of SECTION_LABELS) {
    const stopMatch = rest.match(stop);
    if (
      stopMatch &&
      stopMatch.index !== undefined &&
      stopMatch.index < cut &&
      stopMatch.index > 0
    ) {
      cut = stopMatch.index;
    }
  }
  const value = rest
    .slice(0, Math.min(cut, maxLength))
    .replace(/^[:\s]+/, '')
    .trim();
  return value.length > 0 ? value : null;
};

const known = (value: string): FieldState => ({ state: 'known', value });
const unavailableField = (reason: string): FieldState => ({ state: 'unavailable', reason });

const GROUP_RE = /(gruppearbeid|gruppeprosjekt|gruppeoppgave|group\s?(work|project)|in groups)/i;
const INDIVIDUAL_RE = /(individuell\w*|individual\w*|selvstendig\w*)/i;
const REQUIRED_ATTENDANCE_RE = /obligatorisk (oppmøte|deltakelse|frammøte)|mandatory attendance/i;
const NOT_REQUIRED_ATTENDANCE_RE =
  /ikke obligatorisk (oppmøte|deltakelse)|attendance is not (required|mandatory)/i;
const REMOTE_RE =
  /(nettbasert undervisning|nettstudent|delta digitalt|fjernundervisning|remote participation|online participation)/i;
const CAMPUS_ONLY_RE = /kun (på campus|fysisk oppmøte)|physical attendance is required/i;

const ASSESSMENT_FORM_PATTERNS: ReadonlyArray<readonly [RegExp, AssessmentFormGuess]> = [
  [/skoleeksamen|written (school )?exam/i, 'written-exam'],
  [/muntlig eksamen|oral exam/i, 'oral-exam'],
  [/hjemmeeksamen|home exam|take-home exam/i, 'home-exam'],
  [/mappevurdering|portfolio/i, 'portfolio'],
  [/prosjekt(oppgave|arbeid)?|project (work|report)/i, 'project'],
  [/praktisk (prøve|eksamen)|practical (exam|test)/i, 'practical'],
  [/øving\w*|innleveringer?|assignment/i, 'assignment'],
];

const WORK_FORM_PATTERNS: ReadonlyArray<
  readonly [RegExp, 'lectures' | 'exercises' | 'laboratory' | 'seminar' | 'project' | 'self-study']
> = [
  [/forelesning\w*|lecture\w*/i, 'lectures'],
  [/øving\w*|exercise\w*/i, 'exercises'],
  [/laboratorie\w*|laboratory/i, 'laboratory'],
  [/seminar\w*/i, 'seminar'],
  [/prosjekt\w*|project\w*/i, 'project'],
  [/selvstudium|self-study/i, 'self-study'],
];

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: string; readonly code?: NtnuDetailRejectionCode } => {
  if (input instanceof Uint8Array) {
    try {
      return { value: new TextDecoder('utf-8', { fatal: true }).decode(input) };
    } catch {
      return { code: 'invalid-response-bytes' };
    }
  }
  if (typeof input === 'string') return { value: input };
  return { code: 'invalid-response-bytes' };
};

export const parseNtnuCourseDetail = (
  input: unknown | Uint8Array,
  capture: NtnuDetailCaptureMetadata,
): NtnuDetailParseResult => {
  const captureResult = Schema.decodeUnknownEither(CaptureSchema)(capture);
  if (Either.isLeft(captureResult)) {
    return {
      accepted: null,
      rejected: {
        code: 'invalid-capture-metadata',
        message: 'NTNU course-detail capture metadata failed validation.',
        raw: capture,
      },
    };
  }

  const decoded = decodeInput(input);
  if (decoded.code !== undefined || decoded.value === undefined) {
    return {
      accepted: null,
      rejected: {
        code: decoded.code ?? 'invalid-response-bytes',
        message: 'NTNU course-detail response could not be decoded.',
        raw: input,
      },
    };
  }

  const text = stripTags(decoded.value);
  if (text.length === 0) {
    return {
      accepted: null,
      rejected: {
        code: 'empty-response',
        message: 'NTNU course-detail page had no readable text content.',
        raw: input,
      },
    };
  }

  const capturedFields = captureResult.right;
  if (
    !new RegExp(
      `\\b${capturedFields.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    ).test(text)
  ) {
    return {
      accepted: null,
      rejected: {
        code: 'course-identity-mismatch',
        message: 'NTNU course-detail page did not contain the requested course code.',
        raw: input,
      },
    };
  }
  const sourceRecordId = `ntnu-course-page:${capturedFields.courseCode}`;
  const attribution: NtnuDetailAttribution = {
    provider: 'ntnu-course-page',
    sourceRecordId,
    retrievedAt: capturedFields.retrievedAt,
    requestUrl: capturedFields.requestUrl,
    contentHash: capturedFields.contentHash,
    evidenceKind: capturedFields.evidenceKind,
  };

  const creditsMatch = text.match(/Studiepoeng\s*(\d+(?:[.,]\d+)?)/);
  const credits = creditsMatch ? Number(creditsMatch[1]?.replace(',', '.')) : null;

  const languageMatch = text.match(/Undervisningsspråk\s*(Norsk|Engelsk|Norwegian|English)/i);
  const teachingLanguage = languageMatch
    ? ({ norsk: 'Norwegian', engelsk: 'English', norwegian: 'Norwegian', english: 'English' }[
        languageMatch[1]?.toLowerCase() ?? ''
      ] ??
      languageMatch[1] ??
      null)
    : null;

  const content = extractSection(text, /Faglig innhold/);
  const learningOutcomes = extractSection(text, /Læringsutbytte/);
  const teachingMethods = extractSection(text, /Læringsformer og aktiviteter/);
  const assessmentSummary = extractSection(text, /Vurderingsordning/);
  const assessmentDetails = extractSection(text, /Mer om vurdering/);
  const assessmentText =
    [assessmentSummary, assessmentDetails]
      .filter((value): value is string => value !== null)
      .join(' ') || null;
  const obligatoryRaw = extractSection(text, /Obligatoriske aktiviteter/);
  const prerequisitesRaw = extractSection(text, /Forkunnskapskrav/);
  const accessRaw = extractSection(text, /Krever opptak til studieprogram/);

  const assessmentFormGuesses = assessmentText
    ? ASSESSMENT_FORM_PATTERNS.filter(([pattern]) => pattern.test(assessmentText)).map(
        ([, form]) => form,
      )
    : [];

  const obligatoryActivities: ValidatedNtnuCourseDetail['obligatoryActivities'] =
    obligatoryRaw === null
      ? { state: 'unavailable', reason: 'Obligatoriske aktiviteter section not present on page.' }
      : {
          state: 'known',
          items: /^ingen\b/i.test(obligatoryRaw)
            ? []
            : obligatoryRaw
                .split(/(?<=[.;])\s+(?=[A-ZÆØÅ])/)
                .map((item) => item.trim())
                .filter((item) => item.length > 0),
        };

  const collaborationScan = `${assessmentText ?? ''} ${teachingMethods ?? ''}`;
  const hasGroup = GROUP_RE.test(collaborationScan);
  const hasIndividual = INDIVIDUAL_RE.test(collaborationScan);
  const collaborationSignal =
    hasGroup && hasIndividual ? 'mixed' : hasGroup ? 'group' : hasIndividual ? 'individual' : null;

  const attendanceSignal = NOT_REQUIRED_ATTENDANCE_RE.test(text)
    ? 'not-required'
    : REQUIRED_ATTENDANCE_RE.test(text)
      ? 'required'
      : null;

  const onlineParticipationSignal = CAMPUS_ONLY_RE.test(text)
    ? 'not-available'
    : REMOTE_RE.test(text)
      ? 'available'
      : null;

  const workFormSignals = teachingMethods
    ? WORK_FORM_PATTERNS.filter(([pattern]) => pattern.test(teachingMethods)).map(
        ([, form]) => form,
      )
    : [];

  return {
    accepted: {
      courseCode: capturedFields.courseCode,
      sourceRecordId,
      attribution,
      credits,
      teachingLanguage,
      content: content
        ? known(content)
        : unavailableField('Faglig innhold section not present on page.'),
      learningOutcomes: learningOutcomes
        ? known(learningOutcomes)
        : unavailableField('Læringsutbytte section not present on page.'),
      teachingMethods: teachingMethods
        ? known(teachingMethods)
        : unavailableField('Læringsformer og aktiviteter section not present on page.'),
      assessmentText: assessmentText
        ? known(assessmentText)
        : unavailableField('Vurderingsordning section not present on page.'),
      assessmentFormGuesses,
      obligatoryActivities,
      prerequisites: prerequisitesRaw
        ? known(prerequisitesRaw)
        : unavailableField('Forkunnskapskrav section not present on page.'),
      accessRestrictions: accessRaw
        ? known(accessRaw)
        : unavailableField('Krever opptak til studieprogram section not present on page.'),
      collaborationSignal,
      attendanceSignal,
      onlineParticipationSignal,
      workFormSignals,
    },
    rejected: null,
  };
};
