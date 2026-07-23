import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/tdt4136-dbh-308.json';
import source from '../fixtures/tdt4136-dbh-308.source.json';
import { parseDbhGrades } from './dbh-grades';

const capture = {
  retrievedAt: source.capturedAt,
  contentHash: source.contentHash.rawBody,
  courseCode: source.courseCode,
  fromYear: source.fromYear,
  toYear: source.toYear,
  evidenceKind: 'fixture' as const,
};

describe('parseDbhGrades', () => {
  it('accepts the live plain row-array shape (no status header) and preserves G/H buckets', () => {
    const result = parseDbhGrades(fixture, capture);

    expect(result.rejected).toBeNull();
    expect(result.accepted?.rows).toHaveLength(8);
    expect(result.accepted?.rows).toEqual(
      expect.arrayContaining([
        { grade: 'G', candidateCount: 9 },
        { grade: 'H', candidateCount: 2 },
        { grade: 'F', candidateCount: 22 },
      ]),
    );
    expect(result.accepted?.sourceRecordId).toBe('dbh:308:TDT4136:2023-2024');
  });

  it('rejects a row with a non-numeric candidate count instead of coercing it', () => {
    const result = parseDbhGrades([{ Karakter: 'A', 'Antall kandidater totalt': 'mange' }], capture);

    expect(result.accepted).toBeNull();
    expect(result.rejected?.code).toBe('row-schema-invalid');
  });

  it('rejects invalid capture metadata', () => {
    const result = parseDbhGrades(fixture, { ...capture, fromYear: 1999 });

    expect(result.accepted).toBeNull();
    expect(result.rejected?.code).toBe('invalid-capture-metadata');
  });
});
