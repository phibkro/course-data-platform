import { describe, expect, it } from 'vitest';

import table208 from '../fixtures/table-208.json';
import source208 from '../fixtures/table-208.source.json';
import table347 from '../fixtures/table-347.json';
import source347 from '../fixtures/table-347.source.json';
import { parseTable208, parseTable347 } from './index';

const capture208 = {
  retrievedAt: source208.capturedAt,
  contentHash: source208.contentHash.rawBody,
};
const capture347 = {
  retrievedAt: source347.capturedAt,
  contentHash: source347.contentHash.rawBody,
};

describe('parseTable347', () => {
  it('accepts attributed programme records and rejects the malformed real-shaped row', () => {
    const result = parseTable347(table347, capture347);

    expect(result.accepted).toHaveLength(3);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        tableId: 347,
        rowIndex: 4,
        code: 'row-identity-invalid',
        rowIdentity: '1150:2025:3',
      }),
    ]);

    const record = result.accepted[0];
    expect(record?.fields.Studiepoeng).toEqual({
      value: { state: 'known', value: '0.00' },
      attribution: expect.objectContaining({
        provider: 'dbh',
        tableId: 347,
        datasetRevision: '8452719',
        retrievedAt: source347.capturedAt,
        contentHash: source347.contentHash.rawBody,
        sourcePeriod: { year: 2025, semester: 3 },
      }),
    });
    expect(record?.fields.Godkjenningsdato?.value).toEqual({ state: 'unavailable' });
  });
});

describe('parseTable208', () => {
  it('accepts real course rows, preserves unavailable values, and rejects structurally', () => {
    const result = parseTable208(table208, capture208);

    expect(result.accepted).toHaveLength(3);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        tableId: 208,
        rowIndex: 4,
        code: 'row-identity-invalid',
        rowIdentity: '1150:2024:3:MTDT',
      }),
    ]);
    expect(result.accepted[0]?.fields.Fagkode?.value).toEqual({ state: 'unavailable' });
    expect(result.accepted[0]?.fields.Fagnavn?.value).toEqual({ state: 'unavailable' });
    expect(result.accepted[1]?.sourceRecordId).toBe('208:1150:273824:2024:3:MTDT:TDT4136-1');
  });

  it('accepts captured UTF-8 bytes and preserves an absent expected field as unknown', () => {
    const response = structuredClone(table208);
    const row = response[1] as Record<string, unknown>;
    delete row.Studiepoeng;

    const result = parseTable208(new TextEncoder().encode(JSON.stringify(response)), capture208);

    expect(result.accepted[0]?.fields.Studiepoeng?.value).toEqual({ state: 'unknown' });
  });

  it('preserves conflicting and suppressed source values without coercion', () => {
    const response = structuredClone(table208);
    const row = response[1] as Record<string, unknown>;
    row.Studiepoeng = ['0.00', '7.50'];
    row['Underv.språk'] = '..';

    const result = parseTable208(response, capture208);

    expect(result.accepted[0]?.fields.Studiepoeng?.value).toEqual({
      state: 'conflicting',
      values: ['0.00', '7.50'],
    });
    expect(result.accepted[0]?.fields['Underv.språk']?.value).toEqual({
      state: 'suppressed',
      raw: '..',
    });
  });
});
