import { describe, expect, it, vi } from 'vitest';

import fixture from '../fixtures/tdt4136-dbh-308.json';
import { fetchDbhGrades } from './dbh-grades-client';
import type { FetchLike } from './grades-no-client';

describe('fetchDbhGrades', () => {
  it('requests only DBH versioned variants of the exact course code', async () => {
    const fetch = vi.fn<FetchLike>(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        filter: ReadonlyArray<{
          variabel: string;
          selection: { filter: string; values: ReadonlyArray<string> };
        }>;
      };
      expect(request.filter).toContainEqual({
        variabel: 'Emnekode',
        selection: { filter: 'like', values: ['TDT4136-%'] },
      });
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await fetchDbhGrades(
      {
        fetch,
        now: () => new Date('2026-07-23T12:00:00.000Z'),
        sha256Hex: async () => 'a'.repeat(64),
      },
      'TDT4136',
      2022,
      2025,
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(result.accepted?.rows).toHaveLength(8);
  });
});
