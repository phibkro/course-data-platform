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

import { makeOfficialCurriculumInput } from '../scripts/official-curriculum-input';
import { createApi } from './app';
import { createCourseRuntime } from './runtime';

interface Counts {
  readonly programme_versions: number;
  readonly courses: number;
  readonly relations: number;
  readonly rejections: number;
  readonly field_provenance: number;
}

const root = fileURLToPath(new URL('../../../', import.meta.url));
let statePath: string;
let proxy: PlatformProxy<{ DB: D1Database }>;

const counts = async (): Promise<Counts> => {
  const result = await proxy.env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM programme_version) AS programme_versions,
      (SELECT COUNT(*) FROM courses) AS courses,
      (SELECT COUNT(*) FROM programme_course_relation) AS relations,
      (SELECT COUNT(*) FROM source_rejection) AS rejections,
      (SELECT COUNT(*) FROM field_provenance) AS field_provenance`,
  ).first<Counts>();
  if (result === null) throw new Error('Count query returned no row.');
  return result;
};

const contentSnapshot = async () => ({
  programmeVersions: (
    await proxy.env.DB.prepare(
      `SELECT id, programme_id, cohort_start_year, data_revision, content_hash
       FROM programme_version
       ORDER BY id`,
    ).all()
  ).results,
  courses: (
    await proxy.env.DB.prepare(
      `SELECT c.id, c.code, cv.id AS version_id, cv.academic_year, cv.title,
              cv.credits, cv.source_provider, cv.source_record_id
       FROM courses c
       JOIN course_versions cv ON cv.course_id = c.id
       ORDER BY cv.id`,
    ).all()
  ).results,
  relations: (
    await proxy.env.DB.prepare(
      `SELECT id, course_version_id, relation_type, authority, content_hash
       FROM programme_course_relation
       ORDER BY id`,
    ).all()
  ).results,
});

beforeAll(async () => {
  statePath = await mkdtemp(resolve(tmpdir(), 'course-data-curriculum-test-'));
  proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: resolve(root, 'apps/api-worker/wrangler.jsonc'),
    persist: { path: statePath },
    remoteBindings: false,
  });
  for (const migration of [
    '0001_initial.sql',
    '0002_source_provenance.sql',
    '0003_programme_curriculum.sql',
  ]) {
    const sql = await readFile(resolve(root, 'migrations/d1', migration), 'utf8');
    for (const statement of unstable_splitSqlQuery(sql)) {
      await proxy.env.DB.prepare(statement).run();
    }
  }
}, 30_000);

afterAll(async () => {
  await proxy?.dispose();
  if (statePath !== undefined) await rm(statePath, { recursive: true, force: true });
});

describe('official NTNU curriculum reconciliation', () => {
  it('is idempotent, preserves authority and provenance, and round-trips', async () => {
    const repository = createD1ProgrammeCurriculumRepository(proxy.env.DB);
    const input = makeOfficialCurriculumInput();
    const firstReport = await Effect.runPromise(repository.reconcile(input));
    const firstCounts = await counts();
    const firstContent = await contentSnapshot();

    const secondReport = await Effect.runPromise(repository.reconcile(input));
    const secondCounts = await counts();
    const secondContent = await contentSnapshot();

    expect(secondReport).toEqual(firstReport);
    expect(secondCounts).toEqual(firstCounts);
    expect(secondContent).toEqual(firstContent);
    expect(firstCounts.programme_versions).toBe(1);
    expect(firstCounts.rejections).toBe(1);
    expect(firstCounts.field_provenance).toBeGreaterThan(100);

    const authorities = await proxy.env.DB.prepare(
      `SELECT authority, COUNT(*) AS count
       FROM programme_course_relation
       GROUP BY authority
       ORDER BY authority`,
    ).all<{ authority: string; count: number }>();
    expect(authorities.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ authority: 'official' }),
        expect.objectContaining({ authority: 'administrative' }),
      ]),
    );

    const rejection = await proxy.env.DB.prepare(
      `SELECT rejection_code, rejection_message
       FROM source_rejection
       LIMIT 1`,
    ).first<{ rejection_code: string; rejection_message: string }>();
    expect(rejection).toMatchObject({ rejection_code: 'row-identity-invalid' });

    const programme = await Effect.runPromise(
      repository.getProgrammeVersion(firstReport.programmeVersionId),
    );
    expect(programme).toMatchObject({
      programmeId: 'no.ntnu:BIT',
      cohortStartYear: 2024,
      durationTerms: 6,
      relationAuthority: 'official',
    });
    expect(programme.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'required-course' }),
        expect.objectContaining({ kind: 'choose-n', choose: 1 }),
        expect.objectContaining({ kind: 'choose-n', choose: 2 }),
      ]),
    );

    const runtime = createCourseRuntime(
      createD1CourseRepository(proxy.env.DB),
      createD1ProgrammeCurriculumRepository(proxy.env.DB),
    );
    const app = createApi(runtime);
    const programmesResponse = await app.handle(new Request('http://localhost/v1/programmes'));
    expect(programmesResponse.status).toBe(200);
    await expect(programmesResponse.json()).resolves.toMatchObject({
      items: [
        {
          programmeVersionId: firstReport.programmeVersionId,
          dataRevision: firstReport.dataRevision,
          observedAt: '2026-07-22T02:20:39Z',
          sourcePeriod: '2024',
          relationAuthority: 'official',
        },
      ],
      meta: {
        dataRevision: firstReport.dataRevision,
        observedAt: '2026-07-22T02:20:39Z',
        sourcePeriod: '2024',
        warnings: [expect.objectContaining({ severity: 'warning' })],
      },
    });

    const baselineResponse = await app.handle(
      new Request(
        `http://localhost/v1/planner/baseline?programmeVersionId=${encodeURIComponent(firstReport.programmeVersionId)}`,
      ),
    );
    expect(baselineResponse.status).toBe(200);
    await expect(baselineResponse.json()).resolves.toMatchObject({
      programme: { id: firstReport.programmeVersionId, durationTerms: 6 },
      scenario: { programmeVersionId: firstReport.programmeVersionId },
      meta: {
        dataRevision: firstReport.dataRevision,
        observedAt: '2026-07-22T02:20:39Z',
        sourcePeriod: '2024',
      },
      viewSpec: { presentation: 'roadmap' },
    });

    const missingResponse = await app.handle(
      new Request('http://localhost/v1/planner/baseline?programmeVersionId=no.ntnu%3Abit%3A2026'),
    );
    expect(missingResponse.status).toBe(404);

    const demoResponse = await app.handle(new Request('http://localhost/v1/planner/demo'));
    expect(demoResponse.status).toBe(200);
    await expect(demoResponse.json()).resolves.toMatchObject({
      programme: { id: firstReport.programmeVersionId },
    });
    await runtime.dispose();
  }, 30_000);
});
