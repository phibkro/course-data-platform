import { describe, expect, it } from 'vitest';

import dbhFixture from '../fixtures/tdt4136-dbh-308.json';
import dbhSource from '../fixtures/tdt4136-dbh-308.source.json';
import gradesNoFixture from '../fixtures/tdt4136-grades-no.json';
import gradesNoSource from '../fixtures/tdt4136-grades-no.source.json';
import { parseDbhGrades } from './dbh-grades';
import { parseGradesNoResponse } from './grades-no';
import { mapGradesToOutcomes } from './grade-outcomes';

const gradesNoCapture = {
  retrievedAt: gradesNoSource.capturedAt,
  contentHash: gradesNoSource.contentHash.rawBody,
  requestUrl: gradesNoSource.requestUrl,
  courseCode: gradesNoSource.courseCode,
  evidenceKind: 'fixture' as const,
};
const dbhCapture = {
  retrievedAt: dbhSource.capturedAt,
  contentHash: dbhSource.contentHash.rawBody,
  courseCode: dbhSource.courseCode,
  fromYear: dbhSource.fromYear,
  toYear: dbhSource.toYear,
  evidenceKind: 'fixture' as const,
};

const gradesNo = parseGradesNoResponse(gradesNoFixture, gradesNoCapture).accepted;
const dbh = parseDbhGrades(dbhFixture, dbhCapture).accepted;
if (!dbh) throw new Error('fixture setup: DBH parse failed');
const window = {
  fromYear: 2023,
  toYear: 2024,
  semesters: ['AUTUMN', 'SPRING'] as const,
  minimumCohortSize: 4,
};

describe('mapGradesToOutcomes', () => {
  it('combines agreeing grades.no and DBH evidence into known facts for TDT4136', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', gradesNo, dbh, window);

    expect(outcomes.period).toMatchObject({
      state: 'known',
      value: { fromYear: 2023, toYear: 2024 },
    });
    expect(outcomes.sampleSize).toMatchObject({ state: 'known', value: 408 });
    expect(outcomes.failureRatePercent).toMatchObject({ state: 'known', value: 5.64 });
    expect(outcomes.averageGrade).toMatchObject({ state: 'known', value: 'C' });
    expect(outcomes.medianGrade).toMatchObject({ state: 'known', value: 'C' });
    expect(outcomes.distribution.state).toBe('known');
    expect(outcomes.sourceStatuses).toEqual([
      expect.objectContaining({
        provider: 'grades-no',
        status: 'available',
        warning: expect.stringContaining('period(s) outside'),
      }),
      expect.objectContaining({ provider: 'dbh', status: 'available' }),
    ]);
  });

  it('preserves grades.no-only facts when DBH independently fails', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', gradesNo, null, window);

    expect(outcomes.sampleSize).toMatchObject({ state: 'known', value: 408 });
    expect(outcomes.sourceStatuses).toEqual(
      expect.arrayContaining([expect.objectContaining({ provider: 'dbh', status: 'failed' })]),
    );
  });

  it('reports every fact as unavailable when both providers fail', () => {
    const outcomes = mapGradesToOutcomes('TDT4136', null, null, window);

    expect(outcomes.period.state).toBe('unavailable');
    expect(outcomes.sampleSize.state).toBe('unavailable');
    expect(outcomes.averageGrade.state).toBe('unavailable');
  });

  it('conflicts only the facts that materially disagree between providers', () => {
    const inflatedDbh = {
      ...dbh,
      rows: dbh.rows.map((row) => ({ ...row, candidateCount: row.candidateCount * 5 })),
    };

    const outcomes = mapGradesToOutcomes('TDT4136', gradesNo, inflatedDbh, window);

    expect(outcomes.sampleSize.state).toBe('conflicting');
    expect(outcomes.distribution.state).toBe('known');
    expect(outcomes.failureRatePercent.state).toBe('known');
    expect(outcomes.averageGrade).toMatchObject({ state: 'known', value: 'C' });
  });

  it('keeps pass/fail outcomes out of the ordinal letter median', () => {
    const template = gradesNo[0];
    if (!template) throw new Error('fixture setup: grades.no period missing');
    const passFail = [
      {
        ...template,
        attendeeCount: 569,
        letterCounts: { a: 0, b: 0, c: 0, d: 0, e: 0, f: 45 },
        passedCount: 524,
        averageGrade: null,
      },
    ];

    const outcomes = mapGradesToOutcomes('TDT4136', passFail, null, window);

    expect(outcomes.failureRatePercent).toMatchObject({ state: 'known', value: 7.91 });
    expect(outcomes.distribution).toMatchObject({
      state: 'known',
      value: expect.arrayContaining([
        expect.objectContaining({ grade: 'G', count: 524 }),
        expect.objectContaining({ grade: 'H', count: 45 }),
      ]),
    });
    expect(outcomes.medianGrade.state).toBe('unavailable');
  });

  it('preserves DBH average and median when grades.no has only pass/fail outcomes', () => {
    const template = gradesNo[0];
    if (!template) throw new Error('fixture setup: grades.no period missing');
    const passFail = [
      {
        ...template,
        attendeeCount: 40,
        letterCounts: { a: 0, b: 0, c: 0, d: 0, e: 0, f: 5 },
        passedCount: 35,
        averageGrade: null,
      },
    ];

    const outcomes = mapGradesToOutcomes('TDT4136', passFail, dbh, window);

    expect(outcomes.averageGrade).toMatchObject({ state: 'known', value: 'C' });
    expect(outcomes.medianGrade).toMatchObject({ state: 'known', value: 'C' });
    if (outcomes.averageGrade.state !== 'known' || outcomes.medianGrade.state !== 'known') {
      throw new Error('expected known DBH-derived ordinal facts');
    }
    expect(outcomes.averageGrade.evidenceIds).toContain('evidence:dbh:308:TDT4136:2023-2024');
    expect(outcomes.medianGrade.evidenceIds).toContain('evidence:dbh:308:TDT4136:2023-2024');
  });
});
