import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/tdt4136-grades-no.json';
import source from '../fixtures/tdt4136-grades-no.source.json';
import { parseGradesNoResponse } from './grades-no';

const capture = {
  retrievedAt: source.capturedAt,
  contentHash: source.contentHash.rawBody,
  requestUrl: source.requestUrl,
  courseCode: source.courseCode,
  evidenceKind: 'fixture' as const,
};

describe('parseGradesNoResponse', () => {
  it('accepts AUTUMN, SPRING, and SUMMER periods without rejecting the response', () => {
    const result = parseGradesNoResponse(fixture, capture);

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(3);
    expect(result.accepted.map((period) => period.semester)).toEqual(
      expect.arrayContaining(['AUTUMN', 'SUMMER']),
    );
    const summer = result.accepted.find((period) => period.semester === 'SUMMER');
    expect(summer).toMatchObject({ year: 2023, attendeeCount: 6 });
  });

  it('treats passed=0 as an ordinary letter-graded period', () => {
    const result = parseGradesNoResponse(
      [{ ...fixture[0], semester: 'AUTUMN', passed: 0 }],
      capture,
    );

    expect(result.accepted[0]?.passedCount).toBeNull();
  });

  it('rejects a response whose semester value is not a known literal', () => {
    const result = parseGradesNoResponse([{ ...fixture[0], semester: 'WINTER' }], capture);

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.code).toBe('invalid-response-shape');
  });

  it('rejects capture metadata pointing outside the grades.no host', () => {
    const result = parseGradesNoResponse(fixture, {
      ...capture,
      requestUrl: 'https://evil.example/api/v2/courses/TDT4136/grades/',
    });

    expect(result.rejected[0]?.code).toBe('invalid-capture-metadata');
  });
});
