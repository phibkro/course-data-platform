import { validateEvidenceReferences } from '@course-data/course-model';
import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { makeLiveCourseDecisionService } from './live';

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
  {
    year: 2023,
    semester: 'AUTUMN',
    attendee_count: 198,
    a: 20,
    b: 48,
    c: 65,
    d: 34,
    e: 18,
    f: 13,
    passed: null,
    average_grade: 3.4,
  },
];

const dbhPayload = [
  { Karakter: 'A', 'Antall kandidater totalt': '44' },
  { Karakter: 'B', 'Antall kandidater totalt': '101' },
  { Karakter: 'C', 'Antall kandidater totalt': '133' },
  { Karakter: 'D', 'Antall kandidater totalt': '68' },
  { Karakter: 'E', 'Antall kandidater totalt': '32' },
  { Karakter: 'F', 'Antall kandidater totalt': '22' },
  { Karakter: 'G', 'Antall kandidater totalt': '9' },
  { Karakter: 'H', 'Antall kandidater totalt': '2' },
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
  gradeFromYear: 2023,
  gradeToYear: 2024,
};

const makeFetch =
  (failedSources: ReadonlySet<'detail' | 'grades-no' | 'dbh'> = new Set()) =>
  async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.includes('fetch-courselist-as-json')) {
      return Response.json(searchPayload);
    }
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
      const request = JSON.parse(String(init?.body)) as { groupBy?: ReadonlyArray<string> };
      return Response.json(request.groupBy?.includes('Emnekode') ? dbhBatchPayload : dbhPayload);
    }
    return new Response('not found', { status: 404 });
  };

const makeService = (failedSources: ReadonlySet<'detail' | 'grades-no' | 'dbh'> = new Set()) =>
  makeLiveCourseDecisionService(
    {
      fetch: makeFetch(failedSources),
      now: () => new Date('2026-07-23T12:00:00.000Z'),
      sha256Hex: async () => '0'.repeat(64),
    },
    defaults,
  );

describe('live course decision service', () => {
  it('returns fast attributed search results without inventing a delivery mode', async () => {
    const result = await Effect.runPromise(makeService().search({ query: 'TDT4136' }));

    expect(result.exactMatchCode).toBe('TDT4136');
    expect(result.items[0]).toMatchObject({
      code: 'TDT4136',
      offerings: {
        state: 'known',
        value: [
          {
            campuses: ['Ålesund', 'Trondheim'],
            deliveryModes: [],
          },
        ],
      },
    });
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 500,
      hasMore: false,
    });
  });

  it('supports a blank default catalogue with explicit provider filters', async () => {
    let submitted = new URLSearchParams();
    const service = makeLiveCourseDecisionService(
      {
        fetch: async (url, init) => {
          if (url.includes('fetch-courselist-as-json')) {
            submitted = new URLSearchParams(String(init?.body ?? ''));
            return Response.json(searchPayload);
          }
          return makeFetch()(url);
        },
        now: () => new Date('2026-07-23T12:00:00.000Z'),
        sha256Hex: async () => '0'.repeat(64),
      },
      defaults,
    );

    const result = await Effect.runPromise(service.search({}));

    expect(result.items).toHaveLength(1);
    expect(Object.fromEntries(submitted)).toMatchObject({
      searchQueryString: '',
      pageNo: '1',
      sortOrder: '+title',
      courseAutumn: 'true',
      courseSpring: 'false',
      trondheim: 'true',
      gjovik: 'true',
      alesund: 'true',
      bachelor: 'true',
      master: 'true',
      phd: 'true',
      other: 'true',
      continuingEducation: 'true',
      open: 'false',
      english: 'false',
    });
  });

  it('preserves a missing catalogue campus as unknown', async () => {
    const service = makeLiveCourseDecisionService(
      {
        fetch: async (url) =>
          url.includes('fetch-courselist-as-json')
            ? Response.json({
                ...searchPayload,
                courses: [{ ...searchPayload.courses[0], location: null }],
              })
            : makeFetch()(url),
        now: () => new Date('2026-07-23T12:00:00.000Z'),
        sha256Hex: async () => '0'.repeat(64),
      },
      defaults,
    );

    const result = await Effect.runPromise(service.search({ query: 'TDT4136' }));

    expect(result.items[0]?.offerings).toMatchObject({
      state: 'unknown',
      reason: 'The NTNU catalogue did not identify a campus for this offering.',
    });
  });

  it('assembles independently fetched course and grade evidence', async () => {
    const result = await Effect.runPromise(makeService().getInsight({ courseCode: 'tdt4136' }));

    expect(result.partial).toBe(false);
    expect(result.item.credits).toMatchObject({ state: 'known', value: 7.5 });
    expect(result.item.gradeOutcomes.sampleSize).toMatchObject({
      state: 'known',
      value: 408,
    });
    expect(validateEvidenceReferences(result.item)).toEqual([]);
  });

  it('loads grade signals for several visible courses through one DBH request', async () => {
    let dbhRequestCount = 0;
    const service = makeLiveCourseDecisionService(
      {
        fetch: async (url, init) => {
          if (url.includes('dbh-data')) dbhRequestCount += 1;
          return makeFetch()(url, init);
        },
        now: () => new Date('2026-07-23T12:00:00.000Z'),
        sha256Hex: async () => '0'.repeat(64),
      },
      defaults,
    );

    const result = await Effect.runPromise(
      service.getGradeSummaries({ courseCodes: ['tdt4136', 'NORESULT', 'TDT4136'] }),
    );

    expect(dbhRequestCount).toBe(1);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      courseCode: 'TDT4136',
      period: { state: 'known', value: { fromYear: 2024, toYear: 2024 } },
      sampleSize: { state: 'known', value: 411 },
      distribution: {
        state: 'known',
        value: expect.arrayContaining([{ grade: 'A', count: 44, percentage: 10.71 }]),
      },
      gradingScale: { state: 'known', value: 'mixed' },
    });
    expect(result.items[1]?.sampleSize.state).toBe('unavailable');
    expect(result.items[1]?.distribution.state).toBe('unavailable');
  });

  it('treats a returned protected zero DBH count as suppressed rather than a known zero', async () => {
    const service = makeLiveCourseDecisionService(
      {
        fetch: async (url, init) => {
          if (url.includes('dbh-data')) {
            const request = JSON.parse(String(init?.body)) as { groupBy?: ReadonlyArray<string> };
            if (request.groupBy?.includes('Emnekode')) {
              return Response.json([
                {
                  Emnekode: 'TDT4136-1',
                  Årstall: '2024',
                  Semester: '3',
                  Karakter: 'A',
                  'Antall kandidater totalt': '10',
                },
                {
                  Emnekode: 'TDT4136-1',
                  Årstall: '2024',
                  Semester: '3',
                  Karakter: 'F',
                  'Antall kandidater totalt': '0',
                },
              ]);
            }
          }
          return makeFetch()(url, init);
        },
        now: () => new Date('2026-07-23T12:00:00.000Z'),
        sha256Hex: async () => '0'.repeat(64),
      },
      defaults,
    );

    const result = await Effect.runPromise(service.getGradeSummaries({ courseCodes: ['TDT4136'] }));

    expect(result.items[0]?.sampleSize.state).toBe('suppressed');
    expect(result.items[0]?.distribution.state).toBe('suppressed');
    expect(result.items[0]?.failureRatePercent.state).toBe('suppressed');
  });

  it('preserves course facts when both grade providers fail', async () => {
    const result = await Effect.runPromise(
      makeService(new Set(['grades-no', 'dbh'])).getInsight({
        courseCode: 'TDT4136',
      }),
    );

    expect(result.partial).toBe(true);
    expect(result.item.title).toMatchObject({
      state: 'known',
      value: 'Introduction to Artificial Intelligence',
    });
    expect(result.item.gradeOutcomes.sampleSize.state).toBe('unavailable');
  });

  it('preserves the search title when the detail page fails', async () => {
    const result = await Effect.runPromise(
      makeService(new Set(['detail'])).getInsight({ courseCode: 'TDT4136' }),
    );

    expect(result.partial).toBe(true);
    expect(result.item.title.state).toBe('known');
    expect(result.item.content.state).toBe('unavailable');
  });

  it('rejects ambiguous term strings explicitly', async () => {
    const result = await Effect.runPromise(
      Effect.result(makeService().getInsight({ courseCode: 'TDT4136', term: 'autumn' })),
    );

    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'CourseInvalidTermError' },
    });
  });
});
