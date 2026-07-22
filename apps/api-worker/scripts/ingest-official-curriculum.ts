import { createD1ProgrammeCurriculumRepository } from '@course-data/database';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import * as Effect from 'effect/Effect';

import { makeOfficialCurriculumInput } from './official-curriculum-input';

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const persistTo = argument('--persist-to');
if (persistTo === undefined) {
  throw new Error('Usage: bun ingest-official-curriculum.ts --persist-to <fresh-local-d1-path>');
}

const configPath = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url));
const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath,
  persist: { path: resolve(persistTo, 'v3') },
  remoteBindings: false,
});

try {
  const repository = createD1ProgrammeCurriculumRepository(proxy.env.DB);
  const report = await Effect.runPromise(repository.reconcile(makeOfficialCurriculumInput()));
  const programme = await Effect.runPromise(
    repository.getProgrammeVersion(report.programmeVersionId),
  );
  const counts = await proxy.env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM programme_version) AS programme_versions,
      (SELECT COUNT(*) FROM courses) AS courses,
      (SELECT COUNT(*) FROM programme_course_relation) AS relations,
      (SELECT COUNT(*) FROM source_rejection) AS rejections,
      (SELECT COUNT(*) FROM field_provenance) AS field_provenance`,
  ).first();
  const authorities = await proxy.env.DB.prepare(
    `SELECT authority, COUNT(*) AS count
     FROM programme_course_relation
     GROUP BY authority
     ORDER BY authority`,
  ).all();
  console.log(
    JSON.stringify({ report, counts, authorities: authorities.results, programme }, null, 2),
  );
} finally {
  await proxy.dispose();
}
