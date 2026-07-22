import alchemy from 'alchemy';
import { D1Database, Queue, R2Bucket, Website, Worker } from 'alchemy/cloudflare';

const app = await alchemy('course-data-platform');

const runToken = process.env.COURSE_DATA_RUN_TOKEN;
if (!runToken) throw new Error('COURSE_DATA_RUN_TOKEN is required for deployment.');

export const database = await D1Database('database', {
  name: 'course-data-platform',
  migrationsDir: './migrations/d1',
  primaryLocationHint: 'weur',
  delete: false,
  adopt: true,
});

export const evidence = await R2Bucket('evidence', {
  name: 'course-data-platform-evidence',
  jurisdiction: 'eu',
  delete: false,
  adopt: true,
});

export const syncQueue = await Queue('sync-queue', {
  name: 'course-data-platform-sync',
  adopt: true,
  settings: { messageRetentionPeriod: 345_600 },
});

export const api = await Worker('api', {
  name: 'course-data-platform-api',
  entrypoint: './apps/api-worker/src/worker.ts',
  bindings: { DB: database },
  compatibilityDate: '2026-07-20',
  url: true,
});

export const ingest = await Worker('ingest', {
  name: 'course-data-platform-ingest',
  entrypoint: './apps/ingest-worker/src/worker.ts',
  bindings: {
    DB: database,
    EVIDENCE: evidence,
    SYNC_QUEUE: syncQueue,
    RUN_TOKEN: alchemy.secret(runToken),
    ON_DEMAND_INGEST: 'false',
  },
  compatibilityDate: '2026-07-20',
  crons: ['*/15 * * * *', '0 2 * * *', '15 3 * * *'],
  eventSources: [
    {
      queue: syncQueue,
      settings: {
        batchSize: 1,
        maxConcurrency: 1,
        maxRetries: 3,
        maxWaitTimeMs: 1_000,
        retryDelay: 60,
      },
    },
  ],
  url: true,
});

if (!api.url) throw new Error('Alchemy did not provision an API URL.');

export const web = await Website('web', {
  name: 'course-data-platform-web',
  cwd: './apps/web',
  build: {
    command: 'bun run build',
    env: { VITE_API_URL: api.url },
  },
  assets: 'dist',
  compatibilityDate: '2026-07-20',
  spa: true,
  url: true,
});

console.log(JSON.stringify({ apiUrl: api.url, ingestUrl: ingest.url, webUrl: web.url }));

await app.finalize();
