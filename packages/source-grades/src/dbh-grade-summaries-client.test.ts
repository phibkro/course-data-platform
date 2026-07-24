import { describe, expect, it, vi } from 'vitest';

import { fetchDbhGradeSummaries } from './dbh-grade-summaries-client';
import type { FetchLike } from './grades-no-client';

describe('fetchDbhGradeSummaries', () => {
  it('requests several exact versioned course families in one DBH call', async () => {
    const fetch = vi.fn<FetchLike>(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        groupBy: ReadonlyArray<string>;
        filter: ReadonlyArray<{
          variabel: string;
          selection: { filter: string; values: ReadonlyArray<string> };
        }>;
      };
      expect(request.groupBy).toEqual(['Emnekode', 'Karakter', 'Årstall', 'Semester']);
      expect(request.filter).toContainEqual({
        variabel: 'Emnekode',
        selection: { filter: 'like', values: ['TDT4136-%', 'TDT4100-%'] },
      });
      return Response.json([
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
      ]);
    });

    const result = await fetchDbhGradeSummaries(
      {
        fetch,
        now: () => new Date('2026-07-24T01:00:00.000Z'),
        sha256Hex: async () => 'a'.repeat(64),
      },
      ['tdt4136', 'TDT4100', 'TDT4136'],
      2022,
      2025,
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(result.accepted[0]?.courseCode).toBe('TDT4136');
  });
});
