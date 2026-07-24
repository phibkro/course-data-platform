import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/bit-2024.json';
import source from '../fixtures/bit-2024.source.json';
import { parseNtnuCurriculum } from './index';

const capture = {
  retrievedAt: source.capturedAt,
  contentHash: source.contentHash.rawBody,
  requestUrl: source.requestUrl,
};

describe('parseNtnuCurriculum', () => {
  it('decodes the real official BIT roadmap across all six terms', () => {
    const result = parseNtnuCurriculum(fixture, capture);

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    const curriculum = result.accepted[0];
    expect(curriculum).toMatchObject({
      programmeCode: 'BIT',
      cohortStartYear: 2024,
      startSeason: 'autumn',
      durationTerms: 6,
      sourceRecordId: 'ntnu-studyplan:BIT:2024',
    });
    expect(curriculum?.periods.map((period) => period.termIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(
      curriculum?.periods.flatMap((period) => period.groups.flatMap((group) => group.courses)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TDT4109', choiceCode: 'O' }),
        expect.objectContaining({ code: 'TDT4136', choiceCode: 'M2A' }),
        expect.objectContaining({ code: 'IT2901', credits: 15 }),
      ]),
    );
    expect(curriculum?.fields['studyplan.code']).toEqual({
      value: 'BIT',
      attribution: expect.objectContaining({
        provider: 'ntnu-studyplan',
        contentHash: source.contentHash.rawBody,
        requestUrl: source.requestUrl,
      }),
    });
  });
});
