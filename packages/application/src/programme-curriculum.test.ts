import { decodeProgrammeVersion } from '@course-data/study-kernel';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';

import {
  createMemoryProgrammeCurriculumRepository,
  compareProgrammes,
  getPlannerBaseline,
  listProgrammes,
  programmeCurriculumRepositoryLayer,
} from './index';

const programme = decodeProgrammeVersion({
  id: 'no.ntnu:BIT:2024:revision',
  programmeId: 'no.ntnu:BIT',
  institutionId: 'no.ntnu',
  institutionShortName: 'NTNU',
  title: 'Informatikk - bachelor',
  cohortStartYear: 2024,
  startSeason: 'autumn',
  durationTerms: 6,
  dataRevision: 'ntnu:revision',
  relationAuthority: 'official',
  requirements: [
    {
      kind: 'required-course',
      id: 'required:TDT4109',
      title: 'Programming foundation',
      course: {
        courseVersionId: 'no.ntnu:TDT4109:2024',
        code: 'TDT4109',
        title: 'Informasjonsteknologi, grunnkurs',
        credits: 7.5,
        recommendedTermIndex: 0,
      },
      evidenceRefs: ['https://www.ntnu.no/studier'],
    },
  ],
});

const layer = programmeCurriculumRepositoryLayer(
  createMemoryProgrammeCurriculumRepository([programme]),
);

describe('programme curriculum use cases', () => {
  it('lists programme projections with explicit unknown freshness', async () => {
    const result = await Effect.runPromise(listProgrammes().pipe(Effect.provide(layer)));
    expect(result).toMatchObject({
      items: [{ programmeVersionId: programme.id }],
      meta: {
        count: 1,
        observedAt: null,
        sourcePeriod: null,
        warnings: expect.arrayContaining([
          expect.objectContaining({ code: 'freshness-unknown', severity: 'warning' }),
        ]),
      },
    });
  });

  it('runs the study kernel over the repository programme', async () => {
    const result = await Effect.runPromise(
      getPlannerBaseline(programme.id).pipe(Effect.provide(layer)),
    );
    expect(result).toMatchObject({
      programme: { id: programme.id },
      scenario: { programmeVersionId: programme.id, terms: expect.any(Array) },
      viewSpec: { presentation: 'roadmap' },
    });
    expect(result.scenario.terms).toHaveLength(6);
  });

  it('unlocks Compare at exactly ten distinct programmes', async () => {
    const programmes = Array.from({ length: 10 }, (_, index) => ({
      ...programme,
      id: `no.ntnu:P${index}:2026:revision` as typeof programme.id,
      programmeId: `no.ntnu:P${index}` as typeof programme.programmeId,
      title: `Programme ${index}`,
    }));
    const tenLayer = programmeCurriculumRepositoryLayer(
      createMemoryProgrammeCurriculumRepository(programmes),
    );
    const catalogue = await Effect.runPromise(listProgrammes().pipe(Effect.provide(tenLayer)));
    expect(catalogue.meta).toMatchObject({
      programmeCount: 10,
      compareThreshold: 10,
      compareEnabled: true,
    });
    const comparison = await Effect.runPromise(
      compareProgrammes(programmes[0]!.id, programmes[1]!.id).pipe(Effect.provide(tenLayer)),
    );
    expect(comparison.meta).toEqual({ programmeCount: 10, compareThreshold: 10 });
    expect(comparison.sharedCourses).toHaveLength(1);
  });
});
