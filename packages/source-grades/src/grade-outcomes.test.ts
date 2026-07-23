import { describe, expect, it } from 'vitest';

import dbhFixture from '../fixtures/tdt4136-dbh-308.json';
import dbhSource from '../fixtures/tdt4136-dbh-308.source.json';
import gradesNoFixture from '../fixtures/tdt4136-grades-no.json';
import gradesNoSource from '../fixtures/tdt4136-grades-no.source.json';
import { parseDbhGrades } from './dbh-grades.ts';
import { parseGradesNoResponse } from './grades-no.ts';
import { mapGradesToOutcomes } from './grade-outcomes.ts';

const gradesNoCapture = {
  retrievedAt: gradesNoSource.capturedAt,
  contentHash: gradesNoSource.contentHash.rawBody,
  requestUrl: gradesNoSource.requestUrl,
  courseCode: gradesNoSource.courseCode,
};
const dbhCapture = {
  retrievedAt: dbhSource.capturedAt,
  contentHash: dbhSource.contentHash.rawBody,
  courseCode: dbhSource.courseCode,
  fromYear: dbhSource.fromYear,
  toYear: dbhSource.toYear,
};

const gradesNo = parseGradesNoResponse(gradesNoFixture, gradesNoCapture).accepted;
const dbh = parseDbhGrades(dbhFixture, dbhCapture).accepted;
if (!dbh) throw new Error('fixture setup: DBH parse failed');

describe('mapGradesToOutcomes', () => {
  it('combines agreeing grades.no and DBH evidence into known facts for TDT4136', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', gradesNo, dbh);

    expect(outcomes.period).toMatchObject({ state: 'known', value: { fromYear: 2023, toYear: 2024 } });
    expect(outcomes.sampleSize).toMatchObject({ state: 'known', value: 414 });
    expect(outcomes.failureRatePercent).toMatchObject({ state: 'known', value: 5.8 });
    expect(outcomes.averageGrade).toMatchObject({ state: 'known', value: 'C' });
    expect(outcomes.medianGrade).toMatchObject({ state: 'known', value: 'C' });
    expect(outcomes.distribution.state).toBe('known');
    expect(outcomes.sourceStatuses).toEqual([
      expect.objectContaining({ provider: 'grades-no', status: 'available' }),
      expect.objectContaining({ provider: 'dbh', status: 'available' }),
    ]);
  });

  it('preserves grades.no-only facts when DBH independently fails', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', gradesNo, null);

    expect(outcomes.sampleSize).toMatchObject({ state: 'known', value: 414 });
    expect(outcomes.sourceStatuses).toEqual(
      expect.arrayContaining([expect.objectContaining({ provider: 'dbh', status: 'failed' })]),
    );
  });

  it('reports every fact as unavailable when both providers fail', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', null, null);

    expect(outcomes.period.state).toBe('unavailable');
    expect(outcomes.sampleSize.state).toBe('unavailable');
    expect(outcomes.averageGrade.state).toBe('unavailable');
  });

  it('reports conflicting facts instead of silently picking one provider when they materially disagree', () => {
    const inflatedDbh = {
      ...dbh,
      rows: dbh.rows.map((row) => ({ ...row, candidateCount: row.candidateCount * 5 })),
    };

    const outcomes = mapGradesToOutcomes('TDT4136', gradesNo, inflatedDbh);

    expect(outcomes.sampleSize.state).toBe('conflicting');
    expect(outcomes.distribution.state).toBe('conflicting');
    expect(outcomes.averageGrade).toMatchObject({
      state: 'unknown',
      reason: expect.stringContaining('conflicts'),
    });
  });
});
