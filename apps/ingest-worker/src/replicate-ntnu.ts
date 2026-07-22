import { parseNtnuCurriculum, type NtnuParseResult } from '@course-data/source-ntnu';

import type { EvidenceBucket } from './replicate-dbh';

export const NTNU_STUDYPLAN_ENDPOINT =
  'https://www.ntnu.no/web/studier/studieplan?p_p_id=studyprogrammeplannerportlet_WAR_studyprogrammeplannerportlet_INSTANCE_KzJMPh2hQuXL&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=studyplan&p_p_cacheability=cacheLevelPage' as const;

export const NTNU_CATALOGUE_ENDPOINT =
  'https://www.ntnu.no/web/studier/alle?p_p_id=studyprogrammelistportlet_WAR_studyprogrammelistportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=allStudies&p_p_cacheability=cacheLevelPage' as const;

export const NTNU_PROGRAMMES = [
  'BIT',
  'BPROG',
  'BFY',
  'BLOG',
  'BØAT',
  'BBEV',
  'BERGO',
  'HSGSOB',
  'HSGBVB',
  'LTARKIV',
] as const;

export type NtnuProgrammeCode = (typeof NTNU_PROGRAMMES)[number];

export interface NtnuReplicationDependencies {
  readonly evidence: EvidenceBucket;
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readonly now: () => Date;
}

export interface NtnuReplicationResult {
  readonly programmeCode: string;
  readonly year: number;
  readonly contentHash: string;
  readonly bodyKey: string;
  readonly manifestKey: string;
  readonly byteLength: number;
  readonly retrievedAt: string;
  readonly archivedNewBody: boolean;
  readonly parseResult: NtnuParseResult;
}

export interface NtnuCatalogueEntry {
  readonly studyprogCode: string;
  readonly timeProcessed: string | null;
}

export interface NtnuCatalogueResult {
  readonly entries: ReadonlyArray<NtnuCatalogueEntry>;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly bodyKey: string;
  readonly manifestKey: string;
}

export class NtnuReplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NtnuReplicationError';
  }
}

const sha256 = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const archive = async (
  providerPath: string,
  url: string,
  response: Response,
  retrievedAt: string,
  evidence: EvidenceBucket,
) => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentHash = await sha256(bytes);
  const bodyKey = `evidence/ntnu/${providerPath}/sha256/${contentHash}.json`;
  const manifestKey = `evidence/ntnu/${providerPath}/observations/${retrievedAt.replaceAll(':', '-')}-${contentHash}.json`;
  const existing = await evidence.head(bodyKey);
  if (existing === null) {
    await evidence.put(bodyKey, bytes, {
      httpMetadata: { contentType: response.headers.get('content-type') ?? 'application/json' },
      customMetadata: {
        provider: 'ntnu',
        sha256: contentHash,
        byteLength: String(bytes.byteLength),
      },
    });
  }
  await evidence.put(
    manifestKey,
    `${JSON.stringify({
      schemaVersion: 1,
      provider: 'ntnu',
      request: { url, method: 'GET' },
      response: {
        status: response.status,
        byteLength: bytes.byteLength,
        sha256: contentHash,
        bodyKey,
      },
      retrievedAt,
    })}\n`,
    {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { provider: 'ntnu', sha256: contentHash, bodyKey },
    },
  );
  return {
    bytes,
    contentHash,
    bodyKey,
    manifestKey,
    archivedNewBody: existing === null,
  };
};

export const ntnuStudyplanUrl = (programmeCode: string, year: number): string => {
  const url = new URL(NTNU_STUDYPLAN_ENDPOINT);
  url.searchParams.set('code', programmeCode);
  url.searchParams.set('year', String(year));
  return url.toString();
};

export const replicateNtnuCurriculum = async (
  programmeCode: string,
  year: number,
  dependencies: NtnuReplicationDependencies,
): Promise<NtnuReplicationResult> => {
  const retrievedAt = dependencies.now().toISOString();
  const requestUrl = ntnuStudyplanUrl(programmeCode, year);
  const response = await dependencies.fetch(requestUrl, {
    headers: { accept: 'application/json' },
  });
  const archived = await archive(
    `studyplan/${programmeCode}/${year}`,
    requestUrl,
    response,
    retrievedAt,
    dependencies.evidence,
  );
  if (!response.ok) throw new NtnuReplicationError(`NTNU returned HTTP ${response.status}.`);
  const parseResult = parseNtnuCurriculum(archived.bytes, {
    retrievedAt,
    contentHash: archived.contentHash,
    requestUrl,
  });
  return {
    programmeCode,
    year,
    contentHash: archived.contentHash,
    bodyKey: archived.bodyKey,
    manifestKey: archived.manifestKey,
    byteLength: archived.bytes.byteLength,
    retrievedAt,
    archivedNewBody: archived.archivedNewBody,
    parseResult,
  };
};

export const replicateNtnuCatalogue = async (
  dependencies: NtnuReplicationDependencies,
): Promise<NtnuCatalogueResult> => {
  const retrievedAt = dependencies.now().toISOString();
  const response = await dependencies.fetch(NTNU_CATALOGUE_ENDPOINT, {
    headers: { accept: 'application/json' },
  });
  const archived = await archive(
    'catalogue',
    NTNU_CATALOGUE_ENDPOINT,
    response,
    retrievedAt,
    dependencies.evidence,
  );
  if (!response.ok)
    throw new NtnuReplicationError(`NTNU catalogue returned HTTP ${response.status}.`);
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(archived.bytes));
  } catch {
    throw new NtnuReplicationError('NTNU catalogue was not valid JSON.');
  }
  if (!Array.isArray(raw)) throw new NtnuReplicationError('NTNU catalogue was not an array.');
  const entries = raw.flatMap((entry): NtnuCatalogueEntry[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const value = entry as Record<string, unknown>;
    if (typeof value.studyprogCode !== 'string') return [];
    return [
      {
        studyprogCode: value.studyprogCode,
        timeProcessed: typeof value.timeProcessed === 'string' ? value.timeProcessed : null,
      },
    ];
  });
  return {
    entries,
    retrievedAt,
    contentHash: archived.contentHash,
    bodyKey: archived.bodyKey,
    manifestKey: archived.manifestKey,
  };
};
