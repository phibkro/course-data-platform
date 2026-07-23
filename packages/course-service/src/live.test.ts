import { validateEvidenceReferences } from '@course-data/course-model';
import * as Either from 'effect/Either';
import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { CourseInvalidTermError } from './index';
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

const defaults = {
  academicYear: 2026,
  season: 'autumn' as const,
  gradeFromYear: 2023,
  gradeToYear: 2024,
};

const makeFetch = (failedSources: ReadonlySet<'detail' | 'grades-no' | 'dbh'> = new Set()) =>
  async (url: string): Promise<Response> => {
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
      return failedSources.has('dbh')
        ? new Response('unavailable', { status: 503 })
        : Response.json(dbhPayload);
    }
    return new Response('not found', { status: 404 });
  };

const makeService = (
  failedSources: ReadonlySet<'detail' | 'grades-no' | 'dbh'> = new Set(),
) =>
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
  });

  it('assembles independently fetched course and grade evidence', async () => {
    const result = await Effect.runPromise(
      makeService().getInsight({ courseCode: 'tdt4136' }),
    );

    expect(result.partial).toBe(false);
    expect(result.item.credits).toMatchObject({ state: 'known', value: 7.5 });
    expect(result.item.gradeOutcomes.sampleSize).toMatchObject({
      state: 'known',
      value: 408,
    });
    expect(validateEvidenceReferences(result.item)).toEqual([]);
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
      Effect.either(makeService().getInsight({ courseCode: 'TDT4136', term: 'autumn' })),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(CourseInvalidTermError);
    }
  });
});
