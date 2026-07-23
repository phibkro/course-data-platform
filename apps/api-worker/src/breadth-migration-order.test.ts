// Finding A regression (R3a live run): migration 0006 removes the fixture course
// seeds and, on a fresh DB, the orphaned `no.ntnu` institution with them. The live
// reconcile path inserts courses/programmes under `institution_id = 'no.ntnu'`
// (NOT NULL FOREIGN KEY) and never provisions the institution itself, so at the
// REAL migration order (0001..0007 applied before any run) a reconcile FK-failed
// on every programme until 0007 re-seeded NTNU as reference data.
//
// This test applies the FULL migration set (including 0006 AND 0007) and then
// reconciles — the exact order a deploy uses. It fails if 0007 is removed or 0006
// is ever changed to delete the institution again.
import {
  createD1CourseRepository,
  createD1ProgrammeCurriculumRepository,
} from '@course-data/database';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy, type PlatformProxy, unstable_splitSqlQuery } from 'wrangler';
import * as Effect from 'effect/Effect';

import { makeOfficialCurriculumInput } from './curriculum-fixture-input';
import { createApi } from './app';
import { createCourseRuntime } from './runtime';

const root = fileURLToPath(new URL('../../../', import.meta.url));
let statePath: string;
let proxy: PlatformProxy<{ DB: D1Database }>;

beforeAll(async () => {
  statePath = await mkdtemp(resolve(tmpdir(), 'course-data-breadth-order-'));
  proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: resolve(root, 'apps/api-worker/wrangler.jsonc'),
    persist: { path: statePath },
    remoteBindings: false,
  });
  // The FULL migration set — the order a real deploy applies before any run.
  for (const migration of [
    '0001_initial.sql',
    '0002_source_provenance.sql',
    '0003_programme_curriculum.sql',
    '0004_dataset_publication.sql',
    '0005_live_replication.sql',
    '0006_remove_fixture_course_seeds.sql',
    '0007_seed_ntnu_institution.sql',
  ]) {
    const sql = await readFile(resolve(root, 'migrations/d1', migration), 'utf8');
    for (const statement of unstable_splitSqlQuery(sql))
      await proxy.env.DB.prepare(statement).run();
  }
}, 30_000);

afterAll(async () => {
  await proxy?.dispose();
  if (statePath !== undefined) await rm(statePath, { recursive: true, force: true });
});

describe('reconcile at the full deploy migration order (0001..0007)', () => {
  it('publishes a programme fixture-free without an institution FK failure', async () => {
    // After 0006, no fixture course pins `no.ntnu`; 0007 must have re-seeded it as
    // reference data, or this reconcile throws FOREIGN KEY constraint failed.
    const institution = await proxy.env.DB.prepare(
      `SELECT id, short_name FROM institutions WHERE id = 'no.ntnu'`,
    ).first<{ id: string; short_name: string }>();
    expect(institution).toMatchObject({ id: 'no.ntnu', short_name: 'NTNU' });

    const fixtureCourseVersions = await proxy.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM course_versions WHERE source_provider = 'fixture'`,
    ).first<{ count: number }>();
    expect(fixtureCourseVersions?.count).toBe(0);

    const repository = createD1ProgrammeCurriculumRepository(proxy.env.DB);
    const report = await Effect.runPromise(repository.reconcile(makeOfficialCurriculumInput()));
    expect(report.programmeVersionId).toBeTruthy();

    const runtime = createCourseRuntime(
      createD1CourseRepository(proxy.env.DB),
      createD1ProgrammeCurriculumRepository(proxy.env.DB),
    );
    const app = createApi(runtime);
    const coursesResponse = await app.handle(new Request('http://localhost/v1/courses'));
    expect(coursesResponse.status).toBe(200);
    const coursesBody = (await coursesResponse.json()) as {
      items: Array<{ source: { provider: string } }>;
    };
    expect(coursesBody.items.length).toBeGreaterThan(0);
    expect(coursesBody.items.every((course) => course.source.provider !== 'fixture')).toBe(true);
  });
});
