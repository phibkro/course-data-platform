// Alchemy is intentionally isolated to this composition root.
// Install the pinned target version with: npm install -D alchemy@0.93.12
import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Effect from 'effect/Effect';

export const Database = Cloudflare.D1.Database('CourseData', {
  migrationsDir: './migrations/d1',
  jurisdiction: 'eu',
});

export const ApiWorker = Cloudflare.Worker('CourseDataApi', {
  main: './apps/api-worker/src/worker.ts',
  env: { DB: Database },
  url: true,
});

export const IngestWorker = Cloudflare.Worker('CourseDataIngest', {
  main: './apps/ingest-worker/src/worker.ts',
  url: true,
});

export default Alchemy.Stack(
  'CourseDataPlatform',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const database = yield* Database;
    const api = yield* ApiWorker;
    const ingest = yield* IngestWorker;
    return {
      databaseName: database.databaseName,
      apiUrl: api.url,
      ingestUrl: ingest.url,
    };
  }),
);
