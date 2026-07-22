import { createD1ProgrammeCurriculumRepository } from '@course-data/database';
import * as Either from 'effect/Either';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { DbhReplicationError, replicateDbhEvidence } from './replicate-dbh';
import {
  NTNU_PROGRAMMES,
  NtnuReplicationError,
  replicateNtnuCatalogue,
  replicateNtnuCurriculum,
} from './replicate-ntnu';

export interface Env {
  readonly DB: D1Database;
  readonly EVIDENCE: R2Bucket;
  readonly SYNC_QUEUE: Queue<ReplicationMessage>;
  readonly RUN_TOKEN?: string;
  readonly ON_DEMAND_INGEST?: string;
}

export type ReplicationMessage =
  | {
      readonly kind: 'ntnu';
      readonly mode: 'incremental' | 'full';
      readonly runId: string;
      readonly startedAt: string;
      readonly year: number;
    }
  | {
      readonly kind: 'dbh';
      readonly mode: 'periodic';
      readonly runId: string;
      readonly startedAt: string;
      readonly year: number;
    };

const ReplicationRequestSchema = Schema.Struct({
  tableId: Schema.Literal(208, 347),
  institutionCode: Schema.String.pipe(Schema.pattern(/^\d{4}$/)),
  year: Schema.Number.pipe(Schema.int(), Schema.between(2000, 2200)),
  semester: Schema.Literal(1, 3),
  programmeCode: Schema.String.pipe(Schema.pattern(/^[A-ZÆØÅ0-9-]{2,30}$/)),
});

const jsonError = (status: number, detail: string): Response =>
  Response.json({ status, detail }, { status });
const now = () => new Date();
const dependencies = (env: Env) => ({
  evidence: env.EVIDENCE,
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  now,
});

const enqueue = async (env: Env, message: ReplicationMessage): Promise<void> => {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO replication_run
       (id, kind, mode, started_at, status, expected_jobs)
     VALUES (?, ?, ?, ?, 'queued', 0)`,
  )
    .bind(message.runId, message.kind, message.mode, message.startedAt)
    .run();
  await env.SYNC_QUEUE.send(message, { contentType: 'json' });
};

const markFreshness = async (
  env: Env,
  sourceProvider: string,
  scope: string,
  targetSeconds: number,
  attemptedAt: string,
  success: boolean,
  error: string | null,
): Promise<void> => {
  await env.DB.prepare(
    `INSERT INTO source_freshness
       (source_provider, scope, target_seconds, last_attempt_at, last_successful_publish_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_provider, scope) DO UPDATE SET
       target_seconds = excluded.target_seconds,
       last_attempt_at = excluded.last_attempt_at,
       last_successful_publish_at = CASE
         WHEN excluded.last_error IS NULL THEN excluded.last_successful_publish_at
         ELSE source_freshness.last_successful_publish_at
       END,
       last_error = excluded.last_error`,
  )
    .bind(sourceProvider, scope, targetSeconds, attemptedAt, success ? attemptedAt : null, error)
    .run();
};

const startJob = async (
  env: Env,
  runId: string,
  jobKey: string,
  attemptedAt: string,
): Promise<boolean> => {
  const existing = await env.DB.prepare(
    `SELECT status FROM replication_job WHERE run_id = ? AND job_key = ?`,
  )
    .bind(runId, jobKey)
    .first<{ readonly status: string }>();
  if (existing?.status === 'completed') return false;
  await env.DB.prepare(
    `INSERT INTO replication_job (run_id, job_key, status, attempted_at)
     VALUES (?, ?, 'running', ?)
     ON CONFLICT(run_id, job_key) DO UPDATE SET
       status = 'running', attempted_at = excluded.attempted_at, completed_at = NULL, error = NULL`,
  )
    .bind(runId, jobKey, attemptedAt)
    .run();
  return true;
};

const finishJob = async (
  env: Env,
  runId: string,
  jobKey: string,
  completedAt: string,
  error: string | null,
) => {
  await env.DB.prepare(
    `UPDATE replication_job SET status = ?, completed_at = ?, error = ?
     WHERE run_id = ? AND job_key = ?`,
  )
    .bind(error === null ? 'completed' : 'failed', completedAt, error, runId, jobKey)
    .run();
};

const finishRun = async (env: Env, message: ReplicationMessage): Promise<void> => {
  const counts = await env.DB.prepare(
    `SELECT COUNT(*) AS expected,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS succeeded,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM replication_job WHERE run_id = ?`,
  )
    .bind(message.runId)
    .first<{
      readonly expected: number;
      readonly succeeded: number | null;
      readonly failed: number | null;
    }>();
  const failed = counts?.failed ?? 0;
  const completedAt = now().toISOString();
  await env.DB.prepare(
    `UPDATE replication_run SET completed_at = ?, status = ?, expected_jobs = ?,
       succeeded_jobs = ?, failed_jobs = ? WHERE id = ?`,
  )
    .bind(
      completedAt,
      failed === 0 ? 'completed' : 'failed',
      counts?.expected ?? 0,
      counts?.succeeded ?? 0,
      failed,
      message.runId,
    )
    .run();
  if (failed === 0) {
    await env.DB.prepare(
      `INSERT INTO replication_cursor
         (source_provider, scope, cursor_at, last_attempt_at, last_success_at, last_error)
       VALUES (?, 'catalogue', ?, ?, ?, NULL)
       ON CONFLICT(source_provider, scope) DO UPDATE SET
         cursor_at = excluded.cursor_at, last_attempt_at = excluded.last_attempt_at,
         last_success_at = excluded.last_success_at, last_error = NULL`,
    )
      .bind(message.kind, message.startedAt, completedAt, completedAt)
      .run();
  }
};

export const processNtnu = async (
  env: Env,
  message: Extract<ReplicationMessage, { kind: 'ntnu' }>,
): Promise<void> => {
  const catalogueAttempt = now().toISOString();
  let selected = [...NTNU_PROGRAMMES];
  try {
    const catalogue = await replicateNtnuCatalogue(dependencies(env));
    const cursor = await env.DB.prepare(
      `SELECT cursor_at FROM replication_cursor WHERE source_provider = 'ntnu' AND scope = 'catalogue'`,
    ).first<{ readonly cursor_at: string | null }>();
    if (message.mode === 'incremental' && cursor?.cursor_at) {
      const overlap = Date.parse(cursor.cursor_at) - 5 * 60 * 1000;
      const changed = new Set(
        catalogue.entries
          .filter(
            (entry) => entry.timeProcessed === null || Date.parse(entry.timeProcessed) >= overlap,
          )
          .map((entry) => entry.studyprogCode),
      );
      selected = NTNU_PROGRAMMES.filter((code) => changed.has(code));
    }
    await markFreshness(env, 'ntnu-catalogue', 'all-studies', 1_200, catalogueAttempt, true, null);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await markFreshness(
      env,
      'ntnu-catalogue',
      'all-studies',
      1_200,
      catalogueAttempt,
      false,
      detail,
    );
    throw error;
  }

  await env.DB.prepare(
    `UPDATE replication_run SET status = 'running', expected_jobs = ? WHERE id = ?`,
  )
    .bind(selected.length, message.runId)
    .run();
  const repository = createD1ProgrammeCurriculumRepository(env.DB);
  for (const code of selected) {
    const jobKey = `studyplan:${code}:${message.year}`;
    const attemptedAt = now().toISOString();
    if (!(await startJob(env, message.runId, jobKey, attemptedAt))) continue;
    try {
      const capture = await replicateNtnuCurriculum(code, message.year, dependencies(env));
      const curriculum = capture.parseResult.accepted[0];
      if (curriculum === undefined || capture.parseResult.rejected.length > 0) {
        throw new NtnuReplicationError(
          `NTNU ${code} was rejected: ${capture.parseResult.rejected.map((item) => item.code).join(', ') || 'no accepted curriculum'}.`,
        );
      }
      const [dbhProgramme, dbhCourses] = await Promise.all([
        replicateDbhEvidence(
          {
            tableId: 347,
            institutionCode: '1150',
            year: message.year,
            semester: 1,
            programmeCode: code,
          },
          dependencies(env),
        ),
        replicateDbhEvidence(
          {
            tableId: 208,
            institutionCode: '1150',
            year: message.year,
            semester: 1,
            programmeCode: code,
          },
          dependencies(env),
        ),
      ]);
      await Effect.runPromise(
        repository.reconcile({
          curriculum,
          curriculumRejections: capture.parseResult.rejected,
          dbhProgrammeRecords: dbhProgramme.parseResult.accepted,
          dbhCourseRecords: dbhCourses.parseResult.accepted,
          dbhRejections: [...dbhProgramme.parseResult.rejected, ...dbhCourses.parseResult.rejected],
        }),
      );
      const completedAt = now().toISOString();
      await finishJob(env, message.runId, jobKey, completedAt, null);
      await markFreshness(
        env,
        'ntnu-studyplan',
        `${code}:${message.year}`,
        1_200,
        attemptedAt,
        true,
        completedAt === attemptedAt ? null : null,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await finishJob(env, message.runId, jobKey, now().toISOString(), detail);
      await markFreshness(
        env,
        'ntnu-studyplan',
        `${code}:${message.year}`,
        1_200,
        attemptedAt,
        false,
        detail,
      );
    }
  }
  await finishRun(env, message);
};

const processDbh = async (
  env: Env,
  message: Extract<ReplicationMessage, { kind: 'dbh' }>,
): Promise<void> => {
  const jobs = NTNU_PROGRAMMES.flatMap((programmeCode) =>
    [208, 347].map((tableId) => ({ programmeCode, tableId: tableId as 208 | 347 })),
  );
  await env.DB.prepare(
    `UPDATE replication_run SET status = 'running', expected_jobs = ? WHERE id = ?`,
  )
    .bind(jobs.length, message.runId)
    .run();
  for (const job of jobs) {
    const jobKey = `table:${job.tableId}:${job.programmeCode}:${message.year}`;
    const attemptedAt = now().toISOString();
    if (!(await startJob(env, message.runId, jobKey, attemptedAt))) continue;
    try {
      await replicateDbhEvidence(
        {
          tableId: job.tableId,
          institutionCode: '1150',
          year: message.year,
          semester: 1,
          programmeCode: job.programmeCode,
        },
        dependencies(env),
      );
      await finishJob(env, message.runId, jobKey, now().toISOString(), null);
      await markFreshness(
        env,
        'dbh',
        `table:${job.tableId}:${job.programmeCode}`,
        86_400,
        attemptedAt,
        true,
        null,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await finishJob(env, message.runId, jobKey, now().toISOString(), detail);
      await markFreshness(
        env,
        'dbh',
        `table:${job.tableId}:${job.programmeCode}`,
        86_400,
        attemptedAt,
        false,
        detail,
      );
    }
  }
  await finishRun(env, message);
};

const authorized = (request: Request, env: Env): boolean => {
  if (!env.RUN_TOKEN) return false;
  return request.headers.get('authorization') === `Bearer ${env.RUN_TOKEN}`;
};

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        status: 'ready',
        capability: 'scheduled-live-replication',
        archive: 'r2-content-addressed',
        programmes: NTNU_PROGRAMMES.length,
        scheduled: true,
      });
    }
    if (request.method === 'POST' && url.pathname === '/v1/runs/full') {
      if (!authorized(request, env)) return jsonError(401, 'A valid run token is required.');
      const startedAt = now().toISOString();
      const year = now().getUTCFullYear();
      await enqueue(env, {
        kind: 'ntnu',
        mode: 'full',
        runId: `ntnu:full:${startedAt}`,
        startedAt,
        year,
      });
      await enqueue(env, {
        kind: 'dbh',
        mode: 'periodic',
        runId: `dbh:periodic:${startedAt}`,
        startedAt,
        year,
      });
      return Response.json(
        { status: 'queued', startedAt, programmeCount: NTNU_PROGRAMMES.length },
        { status: 202 },
      );
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/v1/replicate/dbh' &&
      env.ON_DEMAND_INGEST === 'true'
    ) {
      let input: unknown;
      try {
        input = await request.json();
      } catch {
        return jsonError(400, 'Request body must be valid JSON.');
      }
      const decoded = Schema.decodeUnknownEither(ReplicationRequestSchema)(input);
      if (Either.isLeft(decoded))
        return jsonError(400, 'Replication request failed boundary validation.');
      try {
        const result = await replicateDbhEvidence(decoded.right, dependencies(env));
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
    }
    return jsonError(404, 'Replication is not available on this path.');
  },

  async scheduled(controller, env): Promise<void> {
    const startedAt = new Date(controller.scheduledTime).toISOString();
    const year = new Date(controller.scheduledTime).getUTCFullYear();
    if (controller.cron === '0 2 * * *') {
      await enqueue(env, {
        kind: 'ntnu',
        mode: 'full',
        runId: `ntnu:full:${startedAt}`,
        startedAt,
        year,
      });
    } else if (controller.cron === '15 3 * * *') {
      await enqueue(env, {
        kind: 'dbh',
        mode: 'periodic',
        runId: `dbh:periodic:${startedAt}`,
        startedAt,
        year,
      });
    } else {
      await enqueue(env, {
        kind: 'ntnu',
        mode: 'incremental',
        runId: `ntnu:incremental:${startedAt}`,
        startedAt,
        year,
      });
    }
  },

  async queue(batch, env): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (message.body.kind === 'ntnu') await processNtnu(env, message.body);
        else await processDbh(env, message.body);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 60 });
      }
    }
  },
} satisfies ExportedHandler<Env, ReplicationMessage>;
