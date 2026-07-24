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
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '2',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'G',
          Årstall: '2023',
          Semester: '1',
          'Antall kandidater totalt': '8',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'H',
          Årstall: '2023',
          Semester: '1',
          'Antall kandidater totalt': '2',
        },
      ],
      capture,
    );

    expect(result.rejected).toEqual([]);
    expect(result.accepted.map((course) => course.courseCode)).toEqual(['TDT4136', 'TDT4100']);
    expect(result.accepted[0]?.rows).toHaveLength(2);
    expect(result.accepted[0]?.rows[0]).toMatchObject({ year: 2024, semester: 3 });
  });

  it('derives explicit letter and pass/fail summaries, and an observed period, from official rows', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2023',
          Semester: '1',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '2',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'T',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '20',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'G',
          Årstall: '2022',
          Semester: '1',
          'Antall kandidater totalt': '8',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'H',
          Årstall: '2022',
          Semester: '1',
          'Antall kandidater totalt': '2',
        },
      ],
      capture,
    );

    const letter = mapDbhToGradeSummary('TDT4136', result.accepted[0] ?? null);
    const passFail = mapDbhToGradeSummary('TDT4100', result.accepted[1] ?? null);
    const missing = mapDbhToGradeSummary('NORESULT', null);

    expect(letter).toMatchObject({
      period: { state: 'known', value: { fromYear: 2023, toYear: 2024 } },
      sampleSize: { state: 'known', value: 12 },
      distribution: {
        state: 'known',
        value: expect.arrayContaining([
          { grade: 'A', count: 10, percentage: 83.33 },
          { grade: 'F', count: 2, percentage: 16.67 },
        ]),
      },
      failureRatePercent: { state: 'known', value: 16.67 },
      gradingScale: { state: 'known', value: 'letter' },
    });
    expect(passFail).toMatchObject({
      period: { state: 'known', value: { fromYear: 2022, toYear: 2022 } },
      sampleSize: { state: 'known', value: 10 },
      failureRatePercent: { state: 'known', value: 20 },
      gradingScale: { state: 'known', value: 'pass-fail' },
    });
    expect(missing.sampleSize.state).toBe('unavailable');
    expect(missing.distribution.state).toBe('unavailable');
  });

  it('reports a mixed scale when both letter and pass/fail buckets are present', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'G',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '5',
        },
      ],
      capture,
    );

    const mixed = mapDbhToGradeSummary('TDT4136', result.accepted[0] ?? null);

    expect(mixed).toMatchObject({
      sampleSize: { state: 'known', value: 15 },
      gradingScale: { state: 'known', value: 'mixed' },
    });
  });

  it('treats a returned protected zero count as suppression, not as a known zero', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '0',
        },
      ],
      capture,
    );

    const suppressed = mapDbhToGradeSummary('TDT4136', result.accepted[0] ?? null);

    expect(suppressed.period).toMatchObject({ state: 'known' });
    expect(suppressed.sampleSize.state).toBe('suppressed');
    expect(suppressed.distribution.state).toBe('suppressed');
    expect(suppressed.failureRatePercent.state).toBe('suppressed');
    expect(suppressed.gradingScale).toMatchObject({ state: 'known', value: 'letter' });
  });

  it('rejects malformed and unrequested rows without discarding valid neighbors', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'OTHER100-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '4',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': 'not-a-number',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'B',
          Årstall: '2026',
          Semester: '1',
          'Antall kandidater totalt': '4',
        },
      ],
      capture,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((rejection) => rejection.code)).toEqual([
      'row-course-unrequested',
      'row-schema-invalid',
      'row-period-unrequested',
    ]);
  });
});
