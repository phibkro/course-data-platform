import * as Effect from 'effect/Effect';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { makeLiveCourseDecisionService } from './live';

type SourceName = 'detail' | 'grades-no' | 'dbh';

const searchPayload = {
  courses: [
    {
      courseCode: 'TDT4136',
      courseVersion: '1',
      courseName: 'Introduction to Artificial Intelligence',
      examOnly: false,
      hasMultimedia: true,
      courseUrl: 'https://www.ntnu.no/studier/emner/TDT4136/2026',
      location: 'Ålesund, Trondheim',
    },
  ],
  numFound: 1,
  pageNr: 1,
  pageSize: 500,
  hasMoreResults: false,
};
const detailHtml = `
  <html><body>
    <h1>TDT4136 Introduction to Artificial Intelligence</h1>
    <h2>Studiepoeng</h2><p>7.5</p>
    <h2>Undervisningsspråk</h2><p>Engelsk</p>
    <h2>Faglig innhold</h2><p>Search, reasoning and intelligent agents.</p>
    <h2>Læringsutbytte</h2><p>Apply foundational artificial-intelligence methods.</p>
    <h2>Læringsformer og aktiviteter</h2><p>Forelesninger og øvinger.</p>
    <h2>Mer om vurdering</h2><p>Skoleeksamen.</p>
    <h2>Obligatoriske aktiviteter</h2><p>Godkjente øvinger.</p>
    <h2>Forkunnskapskrav</h2><p>Ingen.</p>
    <h2>Krever opptak til studieprogram</h2><p>Ingen.</p>
  </body></html>
`;
const gradesNoPayload = [
  {
    year: 2024,
    semester: 'AUTUMN',
    attendee_count: 210,
    a: 25,
    b: 55,
    c: 70,
    d: 35,
    e: 15,
    f: 10,
    passed: null,
    average_grade: 3.6,
  },
];
const dbhPayload = [
  { Karakter: 'A', 'Antall kandidater totalt': '44' },
  { Karakter: 'B', 'Antall kandidater totalt': '101' },
  { Karakter: 'C', 'Antall kandidater totalt': '133' },
  { Karakter: 'D', 'Antall kandidater totalt': '68' },
  { Karakter: 'E', 'Antall kandidater totalt': '32' },
  { Karakter: 'F', 'Antall kandidater totalt': '22' },
];
const dbhBatchPayload = dbhPayload.map((row) => ({
  Emnekode: 'TDT4136-1',
  Årstall: '2024',
  Semester: '3',
  ...row,
}));
const defaults = {
  academicYear: 2026,
  season: 'autumn' as const,
  gradeFromYear: 2024,
  gradeToYear: 2024,
  sourceRequestTimeoutMs: 1_000,
  sourceCacheTtlMs: 1_000,
  sourceCacheMaxEntriesPerProvider: 16,
};

const makeFetch =
  (failedSources: ReadonlySet<SourceName> = new Set<SourceName>()) =>
  async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.includes('fetch-courselist-as-json')) return Response.json(searchPayload);
    if (url.includes('/studier/emner/')) {
      return failedSources.has('detail')
        ? new Response('unavailable', { status: 503 })
        : new Response(detailHtml, { headers: { 'content-type': 'text/html' } });
    }
    if (url.includes('api.grades.no')) {
      return failedSources.has('grades-no')
        ? new Response('unavailable', { status: 503 })
        : Response.json(gradesNoPayload);
    }
    if (url.includes('dbh-data')) {
      if (failedSources.has('dbh')) return new Response('unavailable', { status: 503 });
      return Response.json(String(init?.body).includes('Emnekode') ? dbhBatchPayload : dbhPayload);
    }
    return new Response('not found', { status: 404 });
  };

const makeService = (failedSources: ReadonlySet<SourceName> = new Set<SourceName>()) =>
  makeLiveCourseDecisionService(
    {
      fetch: makeFetch(failedSources),
      now: () => new Date('2026-07-24T12:00:00.000Z'),
      sha256Hex: async () => '0'.repeat(64),
    },
    defaults,
  );

describe('live course decision service', () => {
  const partialInsightScenarios = [
    {
      name: 'a failed detail page',
      failedSources: ['detail'] as const,
      expected: {
        partial: true,
        item: {
          title: { state: 'known' },
          content: { state: 'unavailable' },
          gradeOutcomes: { sampleSize: { state: 'conflicting' } },
        },
      },
    },
    {
      name: 'independently failed grade providers',
      failedSources: ['grades-no', 'dbh'] as const,
      expected: {
        partial: true,
        item: {
          title: { state: 'known' },
          gradeOutcomes: { sampleSize: { state: 'unavailable' } },
        },
      },
    },
  ];

  it.each(partialInsightScenarios)(
    'keeps useful insight after $name',
    async ({ failedSources, expected }) => {
      const result = await Effect.runPromise(
        makeService(new Set<SourceName>(failedSources)).getInsight({ courseCode: 'TDT4136' }),
      );

      expect(result).toMatchObject(expected);
    },
  );

  it('keeps a successful decision signal when its batch neighbour fails', async () => {
    const service = makeLiveCourseDecisionService(
      {
        fetch: async (url) => {
          if (url.includes('/TST404/')) return new Response('unavailable', { status: 503 });
          return new Response(
            '<html><body><h1>TST200</h1><h2>Vurderingsordning</h2><p>Skoleeksamen.</p></body></html>',
          );
        },
        now: () => new Date('2026-07-24T12:00:00.000Z'),
        sha256Hex: async () => '0'.repeat(64),
      },
      defaults,
    );

    const result = await Effect.runPromise(
      service.getDecisionSignals({ courseCodes: ['TST200', 'TST404'] }),
    );

    expect(result.items.map((item) => item.courseCode)).toEqual(['TST200', 'TST404']);
    expect(result.items[0]?.assessment).toMatchObject({ state: 'known' });
    expect(result.items[1]).toMatchObject({
      assessment: { state: 'unavailable' },
      sourceStatus: { status: 'failed' },
    });
  });

  it('coalesces normalized concurrent searches and retains the successful result', async () => {
    const campusInput = fc.array(
      fc.constantFrom('trondheim' as const, 'gjovik' as const, 'alesund' as const),
      { minLength: 1, maxLength: 6 },
    );
    const levelInput = fc.array(
      fc.constantFrom('bachelor' as const, 'master' as const, 'phd' as const, 'other' as const),
      { minLength: 1, maxLength: 6 },
    );

    await fc.assert(
      fc.asyncProperty(campusInput, levelInput, async (campuses, levels) => {
        let notifyStarted: (() => void) | undefined;
        const started = new Promise<void>((resolve) => {
          notifyStarted = () => resolve();
        });
        let releaseRequest: (() => void) | undefined;
        const released = new Promise<void>((resolve) => {
          releaseRequest = () => resolve();
        });
        let requests = 0;
        const service = makeLiveCourseDecisionService(
          {
            fetch: async (url) => {
              if (!url.includes('fetch-courselist-as-json')) {
                return new Response('not found', { status: 404 });
              }
              requests += 1;
              notifyStarted?.();
              await released;
              return Response.json(searchPayload);
            },
            now: () => new Date('2026-07-24T12:00:00.000Z'),
            sha256Hex: async () => '0'.repeat(64),
          },
          defaults,
        );

        const first = Effect.runPromise(service.search({ query: 'TDT4136', campuses, levels }));
        await started;
        const second = Effect.runPromise(
          service.search({
            query: 'TDT4136',
            campuses: [...campuses].reverse(),
            levels: [...levels].reverse(),
          }),
        );
        if (releaseRequest === undefined) throw new Error('Expected the source request to start.');
        releaseRequest();
        const [firstResult, secondResult] = await Promise.all([first, second]);
        const warm = await Effect.runPromise(
          service.search({
            query: 'TDT4136',
            campuses: [...campuses, ...campuses],
            levels: [...levels, ...levels],
          }),
        );

        expect(firstResult.exactMatchCode).toBe('TDT4136');
        expect(secondResult.exactMatchCode).toBe('TDT4136');
        expect(warm.exactMatchCode).toBe('TDT4136');
        expect(requests).toBe(1);
      }),
      { numRuns: 30, seed: 0x43414348 },
    );
  });

  it('bounds concurrent detail retrieval while preserving the requested batch order', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 12 }), async (courseCount) => {
        const courseCodes = Array.from(
          { length: courseCount },
          (_unused, index) => `TST${100 + index}`,
        );
        const batches = Array.from({ length: Math.ceil(courseCount / 4) }, () => {
          let markStarted: (() => void) | undefined;
          const started = new Promise<void>((resolve) => {
            markStarted = () => resolve();
          });
          return { started, markStarted };
        });
        const releases: Array<() => void> = [];
        let startedCount = 0;
        let inFlight = 0;
        let maximumInFlight = 0;
        const service = makeLiveCourseDecisionService(
          {
            fetch: async (url) => {
              if (!url.includes('/studier/emner/'))
                return new Response('not found', { status: 404 });
              inFlight += 1;
              maximumInFlight = Math.max(maximumInFlight, inFlight);
              const batchIndex = Math.floor(startedCount / 4);
              startedCount += 1;
              const batchEnd = Math.min((batchIndex + 1) * 4, courseCount);
              if (startedCount === batchEnd) {
                const batch = batches[batchIndex];
                if (batch === undefined) throw new Error('Expected a request batch.');
                batch.markStarted?.();
              }
              await new Promise<void>((resolve) => {
                releases.push(() => resolve());
              });
              inFlight -= 1;
              const courseCode = /\/emner\/([^/]+)\//.exec(url)?.[1] ?? 'UNKNOWN';
              return new Response(
                `<html><body><h1>${courseCode}</h1><h2>Vurderingsordning</h2><p>Skoleeksamen.</p></body></html>`,
              );
            },
            now: () => new Date('2026-07-24T12:00:00.000Z'),
            sha256Hex: async () => '0'.repeat(64),
          },
          defaults,
        );

        const request = Effect.runPromise(service.getDecisionSignals({ courseCodes }));
        for (const [batchIndex, batch] of batches.entries()) {
          await batch.started;
          expect(maximumInFlight).toBeLessThanOrEqual(4);
          const batchReleases = releases.splice(0);
          expect(batchReleases).toHaveLength(Math.min(4, courseCount - batchIndex * 4));
          for (const release of batchReleases) release();
        }
        const result = await request;

        expect(result.items.map((item) => item.courseCode)).toEqual(courseCodes);
      }),
      { numRuns: 30, seed: 0x434f4e43 },
    );
  });

  it('preserves normalized requested identities when the DBH batch is reordered and incomplete', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.integer({ min: 100, max: 9_999 }), { minLength: 1, maxLength: 4 }),
        async (identifiers) => {
          const firstIdentifier = identifiers[0];
          if (firstIdentifier === undefined) throw new Error('Expected a course identifier.');
          const requested = [
            ...identifiers.map((identifier) => `tst${identifier}`),
            `TST${firstIdentifier}`,
            'NORESULT',
          ];
          const expected = [...new Set(requested.map((courseCode) => courseCode.toUpperCase()))];
          const providerRows = [...identifiers].reverse().map((identifier) => ({
            Emnekode: `TST${identifier}-1`,
            Karakter: 'A',
            Årstall: '2024',
            Semester: '3',
            'Antall kandidater totalt': '10',
          }));
          const service = makeLiveCourseDecisionService(
            {
              fetch: async () => Response.json(providerRows),
              now: () => new Date('2026-07-24T12:00:00.000Z'),
              sha256Hex: async () => '0'.repeat(64),
            },
            defaults,
          );

          const result = await Effect.runPromise(
            service.getGradeSummaries({ courseCodes: requested }),
          );
          const missing = result.items[result.items.length - 1];
          if (missing === undefined) throw new Error('Expected the missing requested course.');

          expect(result.items.map((item) => item.courseCode)).toEqual(expected);
          expect(missing.sampleSize.state).toBe('unavailable');
        },
      ),
      { numRuns: 40, seed: 0x42415443 },
    );
  });
});
