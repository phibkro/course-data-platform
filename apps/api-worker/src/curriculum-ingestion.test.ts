import {
  createD1CourseRepository,
  createD1ProgrammeCurriculumRepository,
  type NtnuCurriculumReconciliationInput,
  type PublicationCandidate,
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
  readonly dataset_revisions: number;
  readonly publications: number;
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
      (SELECT COUNT(*) FROM field_provenance) AS field_provenance,
      (SELECT COUNT(*) FROM dataset_revision) AS dataset_revisions,
      (SELECT COUNT(*) FROM dataset_publication) AS publications`,
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

const withCurriculumRevision = (
  input: NtnuCurriculumReconciliationInput,
  hashCharacter: string,
  retrievedAt: string,
  options: { readonly emptyCurriculum?: boolean } = {},
): NtnuCurriculumReconciliationInput => {
  const contentHash = hashCharacter.repeat(64);
  const attribution = {
    ...input.curriculum.attribution,
    contentHash,
    datasetRevision: contentHash,
    retrievedAt,
  };
  return {
    ...input,
    curriculum: {
      ...input.curriculum,
      attribution,
      title: `${input.curriculum.title} revision ${hashCharacter}`,
      fields: Object.fromEntries(
        Object.entries(input.curriculum.fields).map(([key, field]) => [
          key,
          { ...field, attribution },
        ]),
      ),
      periods:
        options.emptyCurriculum === true
          ? []
          : input.curriculum.periods.map((period) => ({
              ...period,
              groups: period.groups.map((group) => ({
                ...group,
                courses: group.courses.map((course) => ({
                  ...course,
                  title: `${course.title} revision ${hashCharacter}`,
                })),
              })),
            })),
    },
    ...(options.emptyCurriculum === true ? { dbhProgrammeRecords: [], dbhCourseRecords: [] } : {}),
  };
};

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
    '0004_dataset_publication.sql',
    '0005_live_replication.sql',
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
  it('reports the exact last successful publish and turns failures into stale state', async () => {
    const publishedAt = '2026-07-22T14:00:00.000Z';
    await proxy.env.DB.prepare(
      `INSERT INTO source_freshness
         (source_provider, scope, target_seconds, last_attempt_at, last_successful_publish_at, last_error)
       VALUES ('test-source', 'gate', 1200, ?, ?, NULL)`,
    )
      .bind(publishedAt, publishedAt)
      .run();
    const repository = createD1ProgrammeCurriculumRepository(proxy.env.DB);
    let row = (await Effect.runPromise(repository.listSourceFreshness())).find(
      (source) => source.sourceProvider === 'test-source',
    );
    expect(row).toMatchObject({ lastSuccessfulPublishAt: publishedAt, lastError: null });

    await proxy.env.DB.prepare(
      `UPDATE source_freshness SET last_attempt_at = ?, last_error = 'forced outage'
       WHERE source_provider = 'test-source' AND scope = 'gate'`,
    )
      .bind('2026-07-22T14:05:00.000Z')
      .run();
    row = (await Effect.runPromise(repository.listSourceFreshness())).find(
      (source) => source.sourceProvider === 'test-source',
    );
    expect(row).toMatchObject({
      stale: true,
      lastSuccessfulPublishAt: publishedAt,
      lastError: 'forced outage',
    });
  });

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
    expect(firstCounts.dataset_revisions).toBe(1);
    expect(firstCounts.publications).toBe(1);
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

  it('publishes atomically and keeps the last valid revision through failure and outage', async () => {
    const original = makeOfficialCurriculumInput();
    const before = await Effect.runPromise(
      createD1ProgrammeCurriculumRepository(proxy.env.DB).listProgrammeVersions(),
    );
    expect(before).toHaveLength(1);
    const previous = before[0];
    expect(previous).toBeDefined();

    let announceCandidate: (candidate: PublicationCandidate) => void = () => undefined;
    const candidateReady = new Promise<PublicationCandidate>((resolveCandidate) => {
      announceCandidate = resolveCandidate;
    });
    let releasePublication: () => void = () => undefined;
    const publicationReleased = new Promise<void>((resolvePublication) => {
      releasePublication = resolvePublication;
    });
    const concurrentRepository = createD1ProgrammeCurriculumRepository(proxy.env.DB, {
      beforePublish: async (candidate) => {
        announceCandidate(candidate);
        await publicationReleased;
      },
    });
    const nextInput = withCurriculumRevision(original, 'a', '2026-07-22T13:15:00.000Z');
    const pendingPublication = Effect.runPromise(concurrentRepository.reconcile(nextInput));
    const candidate = await candidateReady;

    const during = await Effect.runPromise(concurrentRepository.listProgrammeVersions());
    expect(during.map((row) => row.programmeVersionId)).toEqual([previous?.programmeVersionId]);
    const hiddenCandidate = await Effect.runPromise(
      Effect.either(concurrentRepository.getProgrammeVersion(candidate.programmeVersionId)),
    );
    expect(hiddenCandidate).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ProgrammeVersionNotFoundError' },
    });
    const storedDuring = await proxy.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM programme_version`,
    ).first<{ count: number }>();
    expect(storedDuring?.count).toBe(2);
    const courseRepository = createD1CourseRepository(proxy.env.DB);
    const candidateCoursesDuring = await Effect.runPromise(
      courseRepository.list({ search: 'revision a' }),
    );
    expect(candidateCoursesDuring).toEqual([]);

    releasePublication();
    const published = await pendingPublication;
    expect(published.programmeVersionId).toBe(candidate.programmeVersionId);
    const after = await Effect.runPromise(concurrentRepository.listProgrammeVersions());
    expect(after.map((row) => row.programmeVersionId)).toEqual([candidate.programmeVersionId]);
    const candidateCoursesAfter = await Effect.runPromise(
      courseRepository.list({ search: 'revision a' }),
    );
    expect(candidateCoursesAfter.length).toBeGreaterThan(0);

    const failedInput = withCurriculumRevision(original, 'b', '2026-07-22T13:20:00.000Z', {
      emptyCurriculum: true,
    });
    await expect(
      Effect.runPromise(concurrentRepository.reconcile(failedInput)),
    ).rejects.toMatchObject({
      message: 'Candidate failed the official-curriculum completeness gate.',
    });
    const afterQualityFailure = await Effect.runPromise(
      concurrentRepository.listProgrammeVersions(),
    );
    expect(afterQualityFailure.map((row) => row.programmeVersionId)).toEqual([
      candidate.programmeVersionId,
    ]);
    const rejected = await proxy.env.DB.prepare(
      `SELECT status, rejection_reason FROM dataset_revision WHERE content_hash = ?`,
    )
      .bind('b'.repeat(64))
      .first<{ status: string; rejection_reason: string | null }>();
    expect(rejected).toMatchObject({
      status: 'rejected',
      rejection_reason: 'Candidate failed the official-curriculum completeness gate.',
    });

    const outageRepository = createD1ProgrammeCurriculumRepository(proxy.env.DB, {
      beforePublish: () => Promise.reject(new Error('forced upstream outage')),
    });
    const outageInput = withCurriculumRevision(original, 'c', '2026-07-22T13:25:00.000Z');
    await expect(Effect.runPromise(outageRepository.reconcile(outageInput))).rejects.toMatchObject({
      message: 'forced upstream outage',
    });
    const afterOutage = await Effect.runPromise(outageRepository.listProgrammeVersions());
    expect(afterOutage.map((row) => row.programmeVersionId)).toEqual([
      candidate.programmeVersionId,
    ]);
    const outageCourses = await Effect.runPromise(courseRepository.list({ search: 'revision c' }));
    expect(outageCourses).toEqual([]);
  }, 30_000);
});
