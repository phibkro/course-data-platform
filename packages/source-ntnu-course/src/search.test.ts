import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/tdt4136-search.json';
import source from '../fixtures/tdt4136-search.source.json';
import { fetchNtnuCourseSearch } from './search-client';
import { parseNtnuCourseSearch } from './search';

const capture = {
  retrievedAt: source.capturedAt,
  contentHash: source.contentHash.rawBody,
  requestUrl: source.requestUrl,
  queryString: source.queryString,
  academicYear: source.academicYear,
  season: source.season as 'autumn',
  evidenceKind: 'fixture' as const,
};

describe('parseNtnuCourseSearch', () => {
  it('decodes an exact TDT4136 search match and a non-exact neighbor', () => {
    const result = parseNtnuCourseSearch(fixture, capture);

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(2);
    expect(result).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 500,
      hasMore: false,
    });
    const exact = result.accepted.find((hit) => hit.courseCode === 'TDT4136');
    expect(exact).toMatchObject({
      courseCode: 'TDT4136',
      courseName: 'Introduction to Artificial Intelligence',
      exactMatch: true,
      academicYear: 2026,
      season: 'autumn',
      sourceRecordId: 'ntnu-course-search:TDT4136:1:2026-autumn',
    });
    const neighbor = result.accepted.find((hit) => hit.courseCode === 'TDT4171');
    expect(neighbor?.exactMatch).toBe(false);
  });

  it('rejects a response with an invalid shape instead of throwing', () => {
    const result = parseNtnuCourseSearch({ courses: 'not-an-array' }, capture);

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.code).toBe('invalid-response-shape');
  });

  it('preserves valid catalogue rows when a neighboring row is malformed', () => {
    const result = parseNtnuCourseSearch(
      {
        ...fixture,
        courses: [
          fixture.courses[0],
          {
            ...fixture.courses[1],
            courseUrl: 'https://evil.example/TDT4171',
          },
        ],
      },
      capture,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.courseCode).toBe('TDT4136');
    expect(result.rejected).toEqual([
      expect.objectContaining({
        code: 'invalid-response-shape',
        message: 'An NTNU search result row failed boundary validation.',
      }),
    ]);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
  });

  it('rejects capture metadata that fails validation without touching the response', () => {
    const result = parseNtnuCourseSearch(fixture, {
      ...capture,
      requestUrl: 'https://evil.example/',
    });

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.code).toBe('invalid-capture-metadata');
  });

  it('maps the catalogue query to explicit NTNU teaching filters and official sorting', async () => {
    let requestBody = '';
    const result = await fetchNtnuCourseSearch(
      {
        fetch: async (_url, init) => {
          requestBody = String(init?.body ?? '');
          return Response.json(fixture);
        },
        now: () => new Date(source.capturedAt),
        sha256Hex: async () => source.contentHash.rawBody,
      },
      {
        queryString: '',
        academicYear: 2026,
        season: 'autumn',
        page: 2,
        sort: 'code-desc',
        campuses: ['trondheim', 'alesund'],
        levels: ['bachelor', 'phd'],
        continuingEducation: true,
        open: false,
        english: true,
      },
    );
    const submitted = new URLSearchParams(requestBody);

    expect(Object.fromEntries(submitted)).toMatchObject({
      searchQueryString: '',
      semester: '2026',
      season: 'autumn',
      pageNo: '2',
      sortOrder: '-ntnucoursecode',
      courseAutumn: 'true',
      courseSpring: 'false',
      courseSummer: 'false',
      trondheim: 'true',
      gjovik: 'false',
      alesund: 'true',
      bachelor: 'true',
      master: 'false',
      phd: 'true',
      other: 'false',
      continuingEducation: 'true',
      open: 'false',
      english: 'true',
    });
    expect(result.page).toBe(1);
  });
});
