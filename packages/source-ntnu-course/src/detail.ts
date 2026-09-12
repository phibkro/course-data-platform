import * as Result from 'effect/Result';
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

export interface ValidatedNtnuAssessmentPart {
  readonly form: AssessmentFormGuess;
  readonly description: string;
  readonly weightPercent: number | null;
  readonly duration: string | null;
}

export interface ValidatedNtnuObligatoryActivity {
  readonly description: string;
  readonly formGuess: AssessmentFormGuess | null;
}

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
  readonly assessmentParts:
    | { readonly state: 'known'; readonly items: ReadonlyArray<ValidatedNtnuAssessmentPart> }
    | { readonly state: 'unavailable'; readonly reason: string };
  readonly obligatoryActivities:
    | { readonly state: 'known'; readonly items: ReadonlyArray<ValidatedNtnuObligatoryActivity> }
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
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)),
);
const Sha256Schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)));
const CaptureSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
  requestUrl: Schema.String.pipe(
    Schema.check(Schema.isStartsWith('https://www.ntnu.no/studier/emner/')),
  ),
  courseCode: Schema.NonEmptyString,
  evidenceKind: Schema.Literals(['source-fact', 'fixture']),
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
  const truncated = cut > maxLength;
  const value = rest
    .slice(0, Math.min(cut, maxLength))
    .replace(/^[:\s]+/, '')
    .trim();
  if (value.length === 0) return null;
  return truncated ? `${value} … [Truncated; continue at source]` : value;
};

const extractElementInnerHtmlById = (html: string, id: string): string | null => {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opening = new RegExp(
    `<([a-z][\\w:-]*)\\b(?=[^>]*\\bid=["']${escapedId}["'])[^>]*>`,
    'i',
  ).exec(html);
  if (opening?.index === undefined || opening[1] === undefined) return null;

  const tagName = opening[1];
  const contentStart = opening.index + opening[0].length;
  const tag = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tag.lastIndex = contentStart;
  let depth = 1;
  for (let match = tag.exec(html); match !== null; match = tag.exec(html)) {
    depth += /^<\//.test(match[0]) ? -1 : /\/>$/.test(match[0]) ? 0 : 1;
    if (depth === 0) return html.slice(contentStart, match.index);
  }
  return null;
};

const extractBoundedSection = (html: string, id: string, maxLength = 1200): string | null => {
  const inner = extractElementInnerHtmlById(html, id);
  if (inner === null) return null;
  const heading = /^\s*<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(inner);
  const headingText = stripTags(heading?.[1] ?? '');
  let value = stripTags(heading === null ? inner : inner.slice(heading[0].length));
  if (headingText.length > 0 && value.startsWith(`${headingText} `)) {
    value = value.slice(headingText.length).trimStart();
  }
  if (value.length === 0) return null;
  return value.length > maxLength
    ? `${value.slice(0, maxLength).trim()} … [Truncated; continue at source]`
    : value;
};

const extractListItems = (html: string, containerId: string): ReadonlyArray<string> => {
  const inner = extractElementInnerHtmlById(html, containerId);
  if (inner === null) return [];
  return [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .flatMap((match) => {
      const value = stripTags(match[1] ?? '');
      return value.length === 0 ? [] : [value];
    })
    .filter((value) => value.toLocaleLowerCase('nb') !== 'obligatoriske aktiviteter');
};

const teachingLanguage = (text: string): string | null => {
  const match =
    /Undervisningsspråk\s*((?:Norsk|Engelsk|Norwegian|English)(?:\s+(?:og|and)\s+(?:Norsk|Engelsk|Norwegian|English))?)/i.exec(
      text,
    );
  if (match?.[1] === undefined) return null;

  const translations: Readonly<Record<string, string>> = {
    norsk: 'Norwegian',
    engelsk: 'English',
    norwegian: 'Norwegian',
    english: 'English',
  };
  return [
    ...new Set(
      [...match[1].matchAll(/Norsk|Engelsk|Norwegian|English/gi)].flatMap((language) => {
        const translated = translations[language[0].toLocaleLowerCase('nb')];
        return translated === undefined ? [] : [translated];
      }),
    ),
  ].join(', ');
};

const known = (value: string): FieldState => ({ state: 'known', value });
const unavailableField = (reason: string): FieldState => ({ state: 'unavailable', reason });

const GROUP_RE =
  /(gruppearbeid|gruppeprosjekt|gruppeoppgave|gruppeinnlevering|i grupper?|(?:i\s+)?(?:små|mindre)\s+grupper?|kollaborativ\w*|group\s?(work|project)|in groups|collaborative)/i;
const INDIVIDUAL_RE = /(individuell\w*|individual\w*|selvstendig\w*)/i;
const REQUIRED_ATTENDANCE_RE =
  /obligatorisk (oppmøte|deltakelse|frammøte|tilstedeværelse)|(?:kreves?|krever)(?:\s+minimum)?\s+\d+\s*%\s*(?:tilfredsstillende\s+)?(?:oppmøte|deltakelse|frammøte|tilstedeværelse)|mandatory attendance|attendance (is )?required/i;
const NOT_REQUIRED_ATTENDANCE_RE =
  /ikke obligatorisk (oppmøte|deltakelse)|attendance is not (required|mandatory)/i;
const REMOTE_RE =
  /(nettbasert undervisning|nettstudent|delta digitalt|fjernundervisning|remote participation|online participation)/i;
const CAMPUS_ONLY_RE = /kun (på campus|fysisk oppmøte)|physical attendance is required/i;

const ASSESSMENT_FORM_PATTERNS: ReadonlyArray<readonly [RegExp, AssessmentFormGuess]> = [
  [/skoleeksamen|skriftlig(?:\s+\w+){0,3}\s+eksamen|written (school )?exam/i, 'written-exam'],
  [/muntlig(?:\s+\w+){0,2}\s+eksamen|oral exam/i, 'oral-exam'],
  [/hjemme-?eksamen|home exam|take-home exam/i, 'home-exam'],
  [/mappe(?:vurdering)?|portfolio/i, 'portfolio'],
  [/individuell oppgave|individual assignment/i, 'assignment'],
  [/\boppgave\b|prosjekt(oppgave|arbeid|rapport)?|project (work|report)/i, 'project'],
  [/praktisk (prøve|eksamen)|practical (exam|test)/i, 'practical'],
  [/øving\w*|innleveringer?|assignment/i, 'assignment'],
];

const classifyAssessmentForms = (assessmentText: string): ReadonlyArray<AssessmentFormGuess> =>
  ASSESSMENT_FORM_PATTERNS.flatMap(([pattern, form]) => {
    const match = pattern.exec(assessmentText);
    return match?.index === undefined ? [] : [{ form, index: match.index }];
  })
    .sort((left, right) => left.index - right.index)
    .map(({ form }) => form);

const extractClassElementText = (
  html: string,
  tagName: string,
  className: string,
): string | null => {
  const match = new RegExp(
    `<${tagName}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'i',
  ).exec(html);
  if (match?.[1] === undefined) return null;
  const value = stripTags(match[1]);
  return value.length > 0 ? value : null;
};

const ORDINARY_EXAM_RE = /Ordinær eksamen|Ordinary (examination|exam)/i;
const EXAM_FACT_STOPS =
  'Hjelpemiddel|Dato|Tid|Varighet|Eksamenssystem|Sensurfrist|Karakterskala|Aid|Date|Time|Duration|Examination system|Grading scale|Alt om eksamen ved NTNU';

const extractExamFact = (text: string, labels: string): string | null => {
  const match = new RegExp(`(?:${labels})\\s+(.+?)(?=\\s+(?:${EXAM_FACT_STOPS})\\s+|$)`, 'i').exec(
    text,
  );
  return match?.[1]?.trim() || null;
};

const parseOrdinaryAssessmentParts = (html: string): ReadonlyArray<ValidatedNtnuAssessmentPart> => {
  const starts = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bexam-element\b[^"']*["'][^>]*>/gi)]
    .map((match) => match.index)
    .filter((index): index is number => index !== undefined);

  let arrangement: 'ordinary' | 'other' | null = null;
  const parts: ValidatedNtnuAssessmentPart[] = [];
  for (const [index, start] of starts.entries()) {
    const block = html.slice(start, starts[index + 1] ?? html.length);
    const heading = extractClassElementText(block, 'h4', 'course-exam-heading2');
    if (heading !== null) arrangement = ORDINARY_EXAM_RE.test(heading) ? 'ordinary' : 'other';
    if (arrangement !== 'ordinary') continue;

    const description = extractClassElementText(block, 'h5', 'exam-form');
    if (description === null) continue;

    const forms = classifyAssessmentForms(description);
    const text = stripTags(block);
    const weightMatch = /(?:Vekting|Weighting)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/i.exec(
      text,
    );
    const numerator = Number(weightMatch?.[1]?.replace(',', '.'));
    const denominator = Number(weightMatch?.[2]?.replace(',', '.'));
    const weightPercent =
      Number.isFinite(numerator) &&
      Number.isFinite(denominator) &&
      numerator > 0 &&
      denominator > 0 &&
      numerator <= denominator
        ? (numerator / denominator) * 100
        : null;
    const duration = extractExamFact(text, 'Varighet|Duration');

    parts.push({
      form: forms[0] ?? 'other',
      description,
      weightPercent,
      duration,
    });
  }

  const rawWeightTotal = parts.every((part) => part.weightPercent !== null)
    ? parts.reduce((sum, part) => sum + (part.weightPercent ?? 0), 0)
    : null;
  if (rawWeightTotal === null || rawWeightTotal <= 100) return parts;

  for (let period = 1; period <= parts.length / 2; period += 1) {
    if (parts.length % period !== 0) continue;
    const candidate = parts.slice(0, period);
    const candidateWeightTotal = candidate.every((part) => part.weightPercent !== null)
      ? candidate.reduce((sum, part) => sum + (part.weightPercent ?? 0), 0)
      : null;
    if (candidateWeightTotal !== 100) continue;
    if (
      parts.every((part, index) => {
        const expected = candidate[index % period]!;
        return (
          part.form === expected.form &&
          part.description.trim().toLocaleLowerCase('nb') ===
            expected.description.trim().toLocaleLowerCase('nb') &&
          part.weightPercent === expected.weightPercent
        );
      })
    ) {
      return candidate.map((part, candidateIndex) => {
        const duration =
          parts
            .filter((_, partIndex) => partIndex % period === candidateIndex)
            .flatMap((copy) => (copy.duration === null ? [] : [copy.duration]))
            .sort((left, right) => left.length - right.length)[0] ?? null;
        return { ...part, duration };
      });
    }
  }
  return parts;
};

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
  const captureResult = Schema.decodeUnknownResult(CaptureSchema)(capture);
  if (Result.isFailure(captureResult)) {
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

  const capturedFields = captureResult.success;
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
  const language = teachingLanguage(text);
  const content =
    extractBoundedSection(decoded.value, 'course-content-toggler') ??
    extractSection(text, /Faglig innhold/);
  const learningOutcomes =
    extractBoundedSection(decoded.value, 'learning-goal-toggler') ??
    extractSection(text, /Læringsutbytte/);
  const teachingMethods =
    extractBoundedSection(decoded.value, 'learning-method-toggler') ??
    extractSection(text, /Læringsformer og aktiviteter/);
  const assessmentSummary = extractSection(text, /Vurderingsordning/);
  const assessmentDetails =
    extractBoundedSection(decoded.value, 'further-evaluation-toggler') ??
    extractSection(text, /Mer om vurdering/);
  const assessmentText =
    [assessmentSummary, assessmentDetails]
      .filter((value): value is string => value !== null)
      .join(' ') || null;
  const obligatoryRaw =
    extractBoundedSection(decoded.value, 'mandatory-activities-toggler') ??
    extractSection(text, /Obligatoriske aktiviteter/);
  const prerequisitesRaw =
    extractBoundedSection(decoded.value, 'required-knowledge-toggler') ??
    extractSection(text, /Forkunnskapskrav/);
  const accessRaw = extractSection(text, /Krever opptak til studieprogram/);

  const assessmentFormGuesses = assessmentText ? classifyAssessmentForms(assessmentText) : [];
  const ordinaryAssessmentParts = parseOrdinaryAssessmentParts(decoded.value);
  const knownAssessmentWeightTotal = ordinaryAssessmentParts.every(
    (part) => part.weightPercent !== null,
  )
    ? ordinaryAssessmentParts.reduce((sum, part) => sum + (part.weightPercent ?? 0), 0)
    : null;
  const hasValidAssessmentWeightTotal =
    knownAssessmentWeightTotal === null || Math.abs(knownAssessmentWeightTotal - 100) <= 0.001;
  const assessmentParts: ValidatedNtnuCourseDetail['assessmentParts'] =
    ordinaryAssessmentParts.length > 0 && hasValidAssessmentWeightTotal
      ? { state: 'known', items: ordinaryAssessmentParts }
      : {
          state: 'unavailable',
          reason:
            ordinaryAssessmentParts.length === 0
              ? 'Structured ordinary assessment components were not present on the page.'
              : `Structured ordinary assessment weights total ${knownAssessmentWeightTotal}%, not 100%.`,
        };

  const listedObligatoryActivities = extractListItems(
    decoded.value,
    'mandatory-activities-toggler',
  );
  const attendanceRequirement =
    /(\d+\s*%\s*(?:tilfredsstillende\s+)?(?:oppmøte|deltakelse|frammøte|tilstedeværelse)(?:\s+(?:på|i)\s+[^,.;]+)?)/i.exec(
      teachingMethods ?? '',
    )?.[1] ?? null;
  const submissionRequirement =
    /(godkjenning av [^.;]*(?:innlevering|oppgave)[^.;]*)/i.exec(teachingMethods ?? '')?.[1] ??
    null;
  const approvalRequirement =
    /(Obligatoriske [^.;]*\d+\s*%\s+må være godkjent for eksamen[^.;]*)/i.exec(
      teachingMethods ?? '',
    )?.[1] ?? null;
  const passedRequirements =
    /(?:med\s+)?obligatorisk\s+bestått\s+på\s+([^.;]+)/i.exec(assessmentText ?? '')?.[1] ?? null;
  const gatedAssessmentActivities = [
    /(Individuell oppgave:[\s\S]*?endelig karakter i emnet\.)/i,
    /(Kursprosjekt:[^.]*\.)/i,
  ].flatMap((pattern) => {
    const match = pattern.exec(assessmentDetails ?? '');
    return match?.[1] === undefined ? [] : [match[1]];
  });
  const contextualObligatoryActivities = [
    ...(attendanceRequirement === null ? [] : [attendanceRequirement]),
    ...(submissionRequirement === null ? [] : [submissionRequirement]),
    ...(approvalRequirement === null ? [] : [approvalRequirement]),
    ...(passedRequirements === null ? [] : passedRequirements.split(/\s+og\s+|,\s*/i)),
    ...gatedAssessmentActivities,
  ];
  const rawObligatoryActivities =
    listedObligatoryActivities.length > 0
      ? listedObligatoryActivities
      : obligatoryRaw === null || /^obligatoriske aktiviteter$/i.test(obligatoryRaw)
        ? []
        : obligatoryRaw.split(/(?<=[.;])\s+(?=[A-ZÆØÅ])/);
  const obligatoryDescriptions = [...rawObligatoryActivities, ...contextualObligatoryActivities]
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) => candidate.toLocaleLowerCase('nb') === item.toLocaleLowerCase('nb'),
        ) === index,
    );
  const obligatoryActivities: ValidatedNtnuCourseDetail['obligatoryActivities'] =
    obligatoryRaw === null && obligatoryDescriptions.length === 0
      ? { state: 'unavailable', reason: 'Obligatoriske aktiviteter section not present on page.' }
      : {
          state: 'known',
          items: /^ingen\b/i.test(obligatoryRaw ?? '')
            ? []
            : obligatoryDescriptions.map((description) => ({
                description,
                formGuess: classifyAssessmentForms(description)[0] ?? null,
              })),
        };

  const collaborationScan = `${assessmentText ?? ''} ${teachingMethods ?? ''} ${obligatoryRaw ?? ''}`;
  const hasGroup = GROUP_RE.test(collaborationScan);
  const hasIndividual = INDIVIDUAL_RE.test(collaborationScan);
  const collaborationSignal =
    hasGroup && hasIndividual ? 'mixed' : hasGroup ? 'group' : hasIndividual ? 'individual' : null;

  const attendanceSignal = NOT_REQUIRED_ATTENDANCE_RE.test(collaborationScan)
    ? 'not-required'
    : REQUIRED_ATTENDANCE_RE.test(collaborationScan)
      ? 'required'
      : null;

  const onlineParticipationSignal = CAMPUS_ONLY_RE.test(collaborationScan)
    ? 'not-available'
    : REMOTE_RE.test(collaborationScan)
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
      teachingLanguage: language,
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
      assessmentParts,
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
