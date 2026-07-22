import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';

export type DbhTableId = 208 | 347;

export interface CaptureMetadata {
  readonly retrievedAt: string;
  readonly contentHash: string;
}

export interface SourceAttribution {
  readonly provider: 'dbh';
  readonly tableId: DbhTableId;
  readonly sourceRecordId: string;
  readonly retrievedAt: string;
  readonly sourcePeriod: {
    readonly year: number;
    readonly semester: 1 | 3;
  };
  readonly datasetRevision: string;
  readonly contentHash: string;
}

export type SourceValue =
  | { readonly state: 'known'; readonly value: string | number | boolean }
  | { readonly state: 'unknown'; readonly raw?: string }
  | { readonly state: 'unavailable' }
  | { readonly state: 'suppressed'; readonly raw: string }
  | {
      readonly state: 'conflicting';
      readonly values: ReadonlyArray<string | number | boolean | null>;
    };

export interface AttributedSourceValue {
  readonly value: SourceValue;
  readonly attribution: SourceAttribution;
}

export interface ValidatedDbhRecord {
  readonly tableId: DbhTableId;
  readonly sourceRecordId: string;
  readonly fields: Readonly<Record<string, AttributedSourceValue>>;
  readonly raw: Readonly<Record<string, unknown>>;
}

export type RejectionCode =
  | 'invalid-response-bytes'
  | 'invalid-response-json'
  | 'invalid-response-shape'
  | 'invalid-capture-metadata'
  | 'missing-response-status'
  | 'response-table-mismatch'
  | 'row-schema-invalid'
  | 'row-identity-invalid';

export interface Rejection {
  readonly tableId: DbhTableId;
  readonly rowIndex: number | null;
  readonly rowIdentity: string;
  readonly code: RejectionCode;
  readonly message: string;
  readonly raw: unknown;
}

export interface ParseResult {
  readonly accepted: ReadonlyArray<ValidatedDbhRecord>;
  readonly rejected: ReadonlyArray<Rejection>;
}

const IsoTimestampSchema = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
);
const Sha256Schema = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
const CaptureMetadataSchema = Schema.Struct({
  retrievedAt: IsoTimestampSchema,
  contentHash: Sha256Schema,
});
const ScalarSchema = Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null);
const RawFieldSchema = Schema.Union(ScalarSchema, Schema.Array(ScalarSchema));
const RawRowSchema = Schema.Record({ key: Schema.String, value: RawFieldSchema });
const ResponseSchema = Schema.Array(Schema.Unknown);
const StatusEntrySchema = Schema.Struct({
  status: Schema.Struct({
    tabell_id: Schema.Number,
    api_versjon: Schema.Number,
    leveransenr: Schema.Number,
    leveringstid: Schema.String,
    antall: Schema.Number,
    returkode: Schema.Number,
    melding: Schema.String,
  }),
});
const BaseIdentitySchema = Schema.Struct({
  Institusjonskode: Schema.String.pipe(Schema.minLength(1)),
  Avdelingskode: Schema.String.pipe(Schema.minLength(1)),
  Årstall: Schema.String.pipe(Schema.pattern(/^\d{4}$/)),
  Semester: Schema.Literal('1', '3'),
  Studieprogramkode: Schema.String.pipe(Schema.minLength(1)),
});
const CourseIdentitySchema = Schema.Struct({
  ...BaseIdentitySchema.fields,
  Emnekode: Schema.String.pipe(Schema.minLength(1)),
});

const EXPECTED_FIELDS: Readonly<Record<DbhTableId, ReadonlyArray<string>>> = {
  208: [
    'Institusjonskode',
    'Avdelingskode',
    'Avdelingskode_SSB',
    'Årstall',
    'Semester',
    'Studieprogramkode',
    'Emnekode',
    'Emnenavn',
    'Nivåkode',
    'Studiepoeng',
    'NUS-kode',
    'Status',
    'Underv.språk',
    'Fagkode',
    'Fagnavn',
    'Oppgave (ny fra h2012)',
  ],
  347: [
    'Institusjonskode',
    'Avdelingskode',
    'Avdelingskode_SSB',
    'Årstall',
    'Semester',
    'Studieprogramkode',
    'Studiumkode',
    'Nivåkode',
    'Andel av heltid',
    'Studiepoeng',
    'Prosent egenfinansiering',
    'NUS-kode',
    'Organisering_kode',
    'Andel praksis',
    'Underv.språk',
    'Videreutd.',
    'Tilbys fra',
    'Tilbys til',
    'Nytt studietilbud',
    'Godkjenningsinstans',
    'Godkjenningsdato',
    'Kvalifikasjonskode',
    'Studiepoengkrav kvalifikasjon',
    'Finansierings-kategori',
    'Uttelling',
  ],
};

const SUPPRESSED_VALUES = new Set([':', '..', '...', '*']);

const rejection = (
  tableId: DbhTableId,
  code: RejectionCode,
  message: string,
  rowIndex: number | null = null,
  rowIdentity = 'response',
  raw: unknown = null,
): Rejection => ({ tableId, rowIndex, rowIdentity, code, message, raw });

const decodeInput = (
  input: unknown | Uint8Array,
): { readonly value?: unknown; readonly error?: RejectionCode } => {
  if (input instanceof Uint8Array) {
    try {
      input = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return { error: 'invalid-response-bytes' };
    }
  }

  if (typeof input === 'string') {
    try {
      return { value: JSON.parse(input) as unknown };
    } catch {
      return { error: 'invalid-response-json' };
    }
  }

  return { value: input };
};

const partialIdentity = (row: unknown, rowIndex: number): string => {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return `row:${rowIndex}`;
  const candidate = row as Record<string, unknown>;
  const parts = ['Institusjonskode', 'Årstall', 'Semester', 'Studieprogramkode', 'Emnekode']
    .map((field) => candidate[field])
    .filter(
      (value): value is string | number => typeof value === 'string' || typeof value === 'number',
    );
  return parts.length > 0 ? parts.join(':') : `row:${rowIndex}`;
};

const classifyValue = (field: string, raw: unknown): SourceValue => {
  if (raw === undefined) return { state: 'unknown' };
  if (raw === null) return { state: 'unavailable' };
  if (Array.isArray(raw)) return { state: 'conflicting', values: raw };
  if (typeof raw === 'string') {
    if (SUPPRESSED_VALUES.has(raw)) return { state: 'suppressed', raw };
    if (raw.length === 0 || (field === 'Underv.språk' && raw === '999')) {
      return { state: 'unknown', raw };
    }
  }
  return { state: 'known', value: raw as string | number | boolean };
};

const parseTable = (
  tableId: DbhTableId,
  input: unknown | Uint8Array,
  capture: CaptureMetadata,
): ParseResult => {
  const captureResult = Schema.decodeUnknownEither(CaptureMetadataSchema)(capture);
  if (Either.isLeft(captureResult)) {
    return {
      accepted: [],
      rejected: [
        rejection(
          tableId,
          'invalid-capture-metadata',
          'Capture metadata failed validation.',
          null,
          'response',
          capture,
        ),
      ],
    };
  }

  const decodedInput = decodeInput(input);
  if (decodedInput.error !== undefined) {
    return {
      accepted: [],
      rejected: [
        rejection(
          tableId,
          decodedInput.error,
          'Response could not be decoded.',
          null,
          'response',
          input,
        ),
      ],
    };
  }

  const responseResult = Schema.decodeUnknownEither(ResponseSchema)(decodedInput.value);
  if (Either.isLeft(responseResult)) {
    return {
      accepted: [],
      rejected: [
        rejection(
          tableId,
          'invalid-response-shape',
          'DBH response must be an array.',
          null,
          'response',
          decodedInput.value,
        ),
      ],
    };
  }

  const [statusCandidate, ...rowCandidates] = responseResult.right;
  const statusResult = Schema.decodeUnknownEither(StatusEntrySchema)(statusCandidate);
  if (Either.isLeft(statusResult)) {
    return {
      accepted: [],
      rejected: [
        rejection(
          tableId,
          'missing-response-status',
          'DBH response status entry is missing.',
          null,
          'response',
          statusCandidate,
        ),
      ],
    };
  }
  if (statusResult.right.status.tabell_id !== tableId) {
    return {
      accepted: [],
      rejected: [
        rejection(
          tableId,
          'response-table-mismatch',
          `Expected table ${tableId}, received ${statusResult.right.status.tabell_id}.`,
          null,
          'response',
          statusCandidate,
        ),
      ],
    };
  }

  const accepted: ValidatedDbhRecord[] = [];
  const rejected: Rejection[] = [];
  rowCandidates.forEach((candidate, offset) => {
    const rowIndex = offset + 1;
    const rowResult = Schema.decodeUnknownEither(RawRowSchema)(candidate);
    if (Either.isLeft(rowResult)) {
      rejected.push(
        rejection(
          tableId,
          'row-schema-invalid',
          'Row contains an unsupported field shape.',
          rowIndex,
          partialIdentity(candidate, rowIndex),
          candidate,
        ),
      );
      return;
    }

    const identityResult =
      tableId === 208
        ? Schema.decodeUnknownEither(CourseIdentitySchema)(rowResult.right)
        : Schema.decodeUnknownEither(BaseIdentitySchema)(rowResult.right);
    if (Either.isLeft(identityResult)) {
      rejected.push(
        rejection(
          tableId,
          'row-identity-invalid',
          'Row is missing a required DBH identity field or contains an invalid period.',
          rowIndex,
          partialIdentity(rowResult.right, rowIndex),
          rowResult.right,
        ),
      );
      return;
    }

    const identity = identityResult.right;
    const sourceRecordId =
      tableId === 208
        ? [
            tableId,
            identity.Institusjonskode,
            identity.Avdelingskode,
            identity.Årstall,
            identity.Semester,
            identity.Studieprogramkode,
            'Emnekode' in identity ? identity.Emnekode : '',
          ].join(':')
        : [
            tableId,
            identity.Institusjonskode,
            identity.Avdelingskode,
            identity.Årstall,
            identity.Semester,
            identity.Studieprogramkode,
          ].join(':');
    const attribution: SourceAttribution = {
      provider: 'dbh',
      tableId,
      sourceRecordId,
      retrievedAt: captureResult.right.retrievedAt,
      sourcePeriod: {
        year: Number(identity.Årstall),
        semester: Number(identity.Semester) as 1 | 3,
      },
      datasetRevision: String(statusResult.right.status.leveransenr),
      contentHash: captureResult.right.contentHash,
    };
    const fields: Record<string, AttributedSourceValue> = {};
    for (const field of new Set([...EXPECTED_FIELDS[tableId], ...Object.keys(rowResult.right)])) {
      fields[field] = {
        value: classifyValue(field, rowResult.right[field]),
        attribution,
      };
    }
    accepted.push({ tableId, sourceRecordId, fields, raw: rowResult.right });
  });

  return { accepted, rejected };
};

export const parseTable347 = (input: unknown | Uint8Array, capture: CaptureMetadata): ParseResult =>
  parseTable(347, input, capture);

export const parseTable208 = (input: unknown | Uint8Array, capture: CaptureMetadata): ParseResult =>
  parseTable(208, input, capture);
