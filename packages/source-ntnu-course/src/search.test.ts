import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/tdt4136-search.json';
import source from '../fixtures/tdt4136-search.source.json';
import { parseNtnuCourseSearch } from './search.ts';

const capture = {
  retrievedAt: source.capturedAt,
  contentHash: source.contentHash.rawBody,
  requestUrl: source.requestUrl,
  queryString: source.queryString,
  academicYear: source.academicYear,
  season: source.season as 'autumn',
};

describe('parseNtnuCourseSearch', () => {
  it('decodes an exact TDT4136 search match and a non-exact neighbor', () => {
    const result = parseNtnuCourseSearch(fixture, capture);

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(2);
    const exact = result.accepted.find((hit) => hit.courseCode === 'TDT4136');
    expect(exact).toMatchObject({
      courseCode: 'TDT4136',
      courseName: 'Introduction to Artificial Intelligence',
      exactMatch: true,
      academicYear: 2026,
      season: 'autumn',
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

  it('rejects capture metadata that fails validation without touching the response', () => {
    const result = parseNtnuCourseSearch(fixture, { ...capture, requestUrl: 'https://evil.example/' });

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.code).toBe('invalid-capture-metadata');
  });
});
