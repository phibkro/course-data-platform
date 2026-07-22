import fixture from '../../../packages/source-dbh/fixtures/table-347-bit-2024.json';
import { describe, expect, it } from 'vitest';

import {
  DBH_ENDPOINT,
  dbhRequestBody,
  replicateDbhEvidence,
  type DbhReplicationRequest,
  type EvidenceBucket,
} from './replicate-dbh';

class MemoryEvidenceBucket implements EvidenceBucket {
  readonly objects = new Map<string, { readonly bytes: Uint8Array; readonly options: unknown }>();

  head(key: string): Promise<unknown | null> {
    return Promise.resolve(this.objects.has(key) ? { key } : null);
  }

  put(
    key: string,
    value: Uint8Array | string,
    options?: {
      readonly httpMetadata?: { readonly contentType?: string };
      readonly customMetadata?: Readonly<Record<string, string>>;
    },
  ): Promise<unknown> {
    const bytes =
      typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
    this.objects.set(key, { bytes, options });
    return Promise.resolve({ key });
  }
}

const request: DbhReplicationRequest = {
  tableId: 347,
  institutionCode: '1150',
  year: 2024,
  semester: 3,
  programmeCode: 'BIT',
};

const hexSha256 = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

describe('live DBH evidence replication', () => {
  it('archives exact upstream bytes by hash and feeds the pure parser', async () => {
    const upstreamBytes = new TextEncoder().encode(JSON.stringify(fixture));
    const expectedHash = await hexSha256(upstreamBytes);
    const evidence = new MemoryEvidenceBucket();
    let capturedRequest: { readonly url: string; readonly init?: RequestInit } | undefined;
    const result = await replicateDbhEvidence(request, {
      evidence,
      now: () => new Date('2026-07-22T12:00:00.000Z'),
      fetch: (input, init) => {
        capturedRequest = { url: String(input), ...(init === undefined ? {} : { init }) };
        return Promise.resolve(
          new Response(upstreamBytes, {
            status: 200,
            headers: { 'content-type': 'application/json', 'x-upstream': 'dbh' },
          }),
        );
      },
    });

    expect(capturedRequest).toMatchObject({
      url: DBH_ENDPOINT,
      init: { method: 'POST', body: JSON.stringify(dbhRequestBody(request)) },
    });
    expect(result).toMatchObject({
      contentHash: expectedHash,
      byteLength: upstreamBytes.byteLength,
      archivedNewBody: true,
      acceptedCount: 1,
      rejectedCount: 0,
    });
    expect(evidence.objects.get(result.bodyKey)?.bytes).toEqual(upstreamBytes);
    const manifestBytes = evidence.objects.get(result.manifestKey)?.bytes;
    expect(manifestBytes).toBeDefined();
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as {
      response: { sha256: string; bodyKey: string; byteLength: number };
      retrievedAt: string;
    };
    expect(manifest).toMatchObject({
      response: {
        sha256: expectedHash,
        bodyKey: result.bodyKey,
        byteLength: upstreamBytes.byteLength,
      },
      retrievedAt: '2026-07-22T12:00:00.000Z',
    });

    const repeated = await replicateDbhEvidence(request, {
      evidence,
      now: () => new Date('2026-07-22T12:05:00.000Z'),
      fetch: () => Promise.resolve(new Response(upstreamBytes, { status: 200 })),
    });
    expect(repeated.bodyKey).toBe(result.bodyKey);
    expect(repeated.archivedNewBody).toBe(false);
    expect([...evidence.objects.keys()].filter((key) => key.includes('/sha256/'))).toHaveLength(1);
    expect(
      [...evidence.objects.keys()].filter((key) => key.includes('/observations/')),
    ).toHaveLength(2);
  });
});
