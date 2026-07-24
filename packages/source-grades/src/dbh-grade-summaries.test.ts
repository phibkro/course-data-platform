import { describe, expect, it } from 'vitest';

import { parseDbhGradeSummaries } from './dbh-grade-summaries';
import { mapDbhToGradeSummary } from './grade-summary';

const capture = {
  retrievedAt: '2026-07-24T01:00:00.000Z',
  contentHash: 'a'.repeat(64),
  courseCodes: ['TDT4136', 'TDT4100', 'NORESULT'],
  fromYear: 2022,
  toYear: 2025,
  evidenceKind: 'source-fact' as const,
};

describe('DBH batched grade summaries', () => {
  it('groups versioned DBH rows by requested course while preserving missing courses', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          'Antall kandidater totalt': '2',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'G',
          'Antall kandidater totalt': '8',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'H',
          'Antall kandidater totalt': '2',
        },
      ],
      capture,
    );

    expect(result.rejected).toEqual([]);
    expect(result.accepted.map((course) => course.courseCode)).toEqual(['TDT4136', 'TDT4100']);
    expect(result.accepted[0]?.rows).toHaveLength(2);
  });

  it('derives explicit letter and pass/fail summaries from official rows', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          'Antall kandidater totalt': '2',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'T',
          'Antall kandidater totalt': '20',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'G',
          'Antall kandidater totalt': '8',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'H',
          'Antall kandidater totalt': '2',
        },
      ],
      capture,
    );

    const letter = mapDbhToGradeSummary('TDT4136', result.accepted[0] ?? null);
    const passFail = mapDbhToGradeSummary('TDT4100', result.accepted[1] ?? null);
    const missing = mapDbhToGradeSummary('NORESULT', null);

    expect(letter).toMatchObject({
      sampleSize: { state: 'known', value: 12 },
      failureRatePercent: { state: 'known', value: 16.67 },
      gradingScale: { state: 'known', value: 'letter' },
    });
    expect(passFail).toMatchObject({
      sampleSize: { state: 'known', value: 10 },
      failureRatePercent: { state: 'known', value: 20 },
      gradingScale: { state: 'known', value: 'pass-fail' },
    });
    expect(missing.sampleSize.state).toBe('unavailable');
  });

  it('rejects malformed and unrequested rows without discarding valid neighbors', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'OTHER100-1',
          Karakter: 'A',
          'Antall kandidater totalt': '4',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'A',
          'Antall kandidater totalt': 'not-a-number',
        },
      ],
      capture,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((rejection) => rejection.code)).toEqual([
      'row-course-unrequested',
      'row-schema-invalid',
    ]);
  });
});
