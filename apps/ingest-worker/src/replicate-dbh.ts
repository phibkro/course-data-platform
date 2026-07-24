import {
  parseTable208,
  parseTable347,
  type DbhTableId,
  type ParseResult,
} from '@course-data/source-dbh';

export const DBH_ENDPOINT =
  'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData' as const;

export interface DbhReplicationRequest {
  readonly tableId: DbhTableId;
  readonly institutionCode: string;
  readonly year: number;
  readonly semester: 1 | 3;
  readonly programmeCode: string;
}

export interface EvidenceBucket {
  readonly head: (key: string) => Promise<unknown | null>;
  readonly put: (
    key: string,
    value: Uint8Array | string,
    options?: {
      readonly httpMetadata?: { readonly contentType?: string };
      readonly customMetadata?: Readonly<Record<string, string>>;
    },
  ) => Promise<unknown>;
}

export interface DbhReplicationDependencies {
  readonly evidence: EvidenceBucket;
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readonly now: () => Date;
}

export interface DbhEvidenceManifest {
  readonly schemaVersion: 1;
  readonly provider: 'dbh';
  readonly tableId: DbhTableId;
  readonly request: {
    readonly url: typeof DBH_ENDPOINT;
    readonly method: 'POST';
    readonly body: ReturnType<typeof dbhRequestBody>;
  };
  readonly response: {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly byteLength: number;
    readonly sha256: string;
    readonly bodyKey: string;
  };
  readonly retrievedAt: string;
}

export interface DbhReplicationResult {
  readonly contentHash: string;
  readonly bodyKey: string;
  readonly manifestKey: string;
  readonly byteLength: number;
  readonly retrievedAt: string;
  readonly archivedNewBody: boolean;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly parseResult: ParseResult;
}

export class DbhReplicationError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'DbhReplicationError';
    this.status = status;
  }
}

export const dbhRequestBody = (request: DbhReplicationRequest) => ({
  tabell_id: request.tableId,
  api_versjon: 1,
  statuslinje: 'J',
  kodetekst: 'N',
  desimal_separator: '.',
  variabler: ['*'],
  sortBy: ['Institusjonskode', 'Avdelingskode'],
  filter: [
    {
      variabel: 'Institusjonskode',
      selection: { filter: 'item', values: [request.institutionCode] },
    },
    {
      variabel: 'Årstall',
      selection: { filter: 'item', values: [String(request.year)] },
    },
    {
      variabel: 'Semester',
      selection: { filter: 'item', values: [String(request.semester)] },
    },
    {
      variabel: 'Studieprogramkode',
      selection: { filter: 'item', values: [request.programmeCode] },
    },
  ],
});

const sha256 = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
};

const bodyKeyFor = (tableId: DbhTableId, hash: string): string =>
  `evidence/dbh/table-${tableId}/sha256/${hash}.json`;

const observationKeyFor = (tableId: DbhTableId, retrievedAt: string, hash: string): string =>
  `evidence/dbh/table-${tableId}/observations/${retrievedAt.replaceAll(':', '-')}-${hash}.json`;

export const replicateDbhEvidence = async (
  request: DbhReplicationRequest,
  dependencies: DbhReplicationDependencies,
): Promise<DbhReplicationResult> => {
  const requestBody = dbhRequestBody(request);
  const retrievedAt = dependencies.now().toISOString();
  const response = await dependencies.fetch(DBH_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentHash = await sha256(bytes);
  const bodyKey = bodyKeyFor(request.tableId, contentHash);
  const manifestKey = observationKeyFor(request.tableId, retrievedAt, contentHash);
  const existing = await dependencies.evidence.head(bodyKey);
  if (existing === null) {
    await dependencies.evidence.put(bodyKey, bytes, {
      httpMetadata: {
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      },
      customMetadata: {
        provider: 'dbh',
        tableId: String(request.tableId),
        sha256: contentHash,
        byteLength: String(bytes.byteLength),
      },
    });
  }
  const manifest: DbhEvidenceManifest = {
    schemaVersion: 1,
    provider: 'dbh',
    tableId: request.tableId,
    request: { url: DBH_ENDPOINT, method: 'POST', body: requestBody },
    response: {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      byteLength: bytes.byteLength,
      sha256: contentHash,
      bodyKey,
    },
    retrievedAt,
  };
  await dependencies.evidence.put(manifestKey, `${stableJson(manifest)}\n`, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { provider: 'dbh', sha256: contentHash, bodyKey },
  });

  if (!response.ok) {
    throw new DbhReplicationError(`DBH returned HTTP ${response.status}.`, 502);
  }
  const parseResult =
    request.tableId === 347
      ? parseTable347(bytes, { retrievedAt, contentHash })
      : parseTable208(bytes, { retrievedAt, contentHash });
  // Preserve a byte-addressable evidence object for every parsed record. The
  // serving repository stores JSON.stringify(record.raw) as raw_payload, so
  // archive those exact bytes to make provenance independently verifiable.
  for (const record of parseResult.accepted) {
    const recordBytes = new TextEncoder().encode(JSON.stringify(record.raw));
    const recordHash = await sha256(recordBytes);
    const recordKey = bodyKeyFor(request.tableId, recordHash);
    if ((await dependencies.evidence.head(recordKey)) === null) {
      await dependencies.evidence.put(recordKey, recordBytes, {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          provider: 'dbh',
          tableId: String(request.tableId),
          sha256: recordHash,
          recordId: record.sourceRecordId,
        },
      });
    }
  }
  return {
    contentHash,
    bodyKey,
    manifestKey,
    byteLength: bytes.byteLength,
    retrievedAt,
    archivedNewBody: existing === null,
    acceptedCount: parseResult.accepted.length,
    rejectedCount: parseResult.rejected.length,
    parseResult,
  };
};
