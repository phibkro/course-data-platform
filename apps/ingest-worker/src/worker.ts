import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';

import { DbhReplicationError, replicateDbhEvidence } from './replicate-dbh';

interface Env {
  readonly EVIDENCE: R2Bucket;
  readonly ON_DEMAND_INGEST?: string;
}

const ReplicationRequestSchema = Schema.Struct({
  tableId: Schema.Literal(208, 347),
  institutionCode: Schema.String.pipe(Schema.pattern(/^\d{4}$/)),
  year: Schema.Number.pipe(Schema.int(), Schema.between(2000, 2200)),
  semester: Schema.Literal(1, 3),
  programmeCode: Schema.String.pipe(Schema.pattern(/^[A-ZÆØÅ0-9-]{2,30}$/)),
});

const jsonError = (status: number, detail: string): Response =>
  Response.json({ status, detail }, { status });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        status: 'ready',
        capability: 'on-demand-dbh-evidence-replication',
        archive: 'r2-content-addressed',
        scheduled: false,
      });
    }
    if (
      request.method !== 'POST' ||
      url.pathname !== '/v1/replicate/dbh' ||
      env.ON_DEMAND_INGEST !== 'true'
    ) {
      return jsonError(404, 'On-demand replication is not available on this path.');
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return jsonError(400, 'Request body must be valid JSON.');
    }
    const decoded = Schema.decodeUnknownEither(ReplicationRequestSchema)(input);
    if (Either.isLeft(decoded)) {
      return jsonError(400, 'Replication request failed boundary validation.');
    }
    try {
      const result = await replicateDbhEvidence(decoded.right, {
        evidence: env.EVIDENCE,
        fetch: (input, init) => fetch(input, init),
        now: () => new Date(),
      });
      return Response.json({
        source: 'dbh',
        tableId: decoded.right.tableId,
        contentHash: result.contentHash,
        bodyKey: result.bodyKey,
        manifestKey: result.manifestKey,
        byteLength: result.byteLength,
        retrievedAt: result.retrievedAt,
        archivedNewBody: result.archivedNewBody,
        acceptedCount: result.acceptedCount,
        rejectedCount: result.rejectedCount,
      });
    } catch (error) {
      return error instanceof DbhReplicationError
        ? jsonError(error.status, error.message)
        : jsonError(502, error instanceof Error ? error.message : String(error));
    }
  },

  async scheduled(): Promise<void> {
    // R1 is deliberately on-demand. R3 owns cron and Queue orchestration.
  },
} satisfies ExportedHandler<Env>;
