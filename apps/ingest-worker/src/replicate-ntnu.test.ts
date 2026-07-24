import fixture from '../../../packages/source-ntnu/fixtures/bit-2024.json';
import { describe, expect, it } from 'vitest';

import type { EvidenceBucket } from './replicate-dbh';
import { ntnuStudyplanUrl, replicateNtnuCurriculum } from './replicate-ntnu';

class MemoryEvidenceBucket implements EvidenceBucket {
  readonly objects = new Map<string, Uint8Array>();
  head(key: string) {
    return Promise.resolve(this.objects.has(key) ? { key } : null);
  }
  put(key: string, value: Uint8Array | string) {
    this.objects.set(
      key,
      typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value),
    );
    return Promise.resolve({ key });
  }
}

describe('live NTNU evidence replication', () => {
  it('archives exact upstream bytes and preserves unavailable credits', async () => {
    const source = structuredClone(fixture) as typeof fixture;
    source.settings.year = '2026';
    source.studyplan.year = 2026;
    source.studyplan.studyPeriods[0]!.direction.courseGroups[0]!.courses[0]!.credit =
      null as unknown as string;
    const bytes = new TextEncoder().encode(JSON.stringify(source));
    const evidence = new MemoryEvidenceBucket();
    const result = await replicateNtnuCurriculum('BIT', 2026, {
      evidence,
      now: () => new Date('2026-07-22T12:00:00.000Z'),
      fetch: (input) => {
        expect(String(input)).toBe(ntnuStudyplanUrl('BIT', 2026));
        return Promise.resolve(
          new Response(bytes, { headers: { 'content-type': 'application/json' } }),
        );
      },
    });
    expect(evidence.objects.get(result.bodyKey)).toEqual(bytes);
    expect(result.parseResult.rejected).toEqual([]);
    expect(result.parseResult.accepted[0]?.periods[0]?.groups[0]?.courses[0]?.credits).toBeNull();
    const repeated = await replicateNtnuCurriculum('BIT', 2026, {
      evidence,
      now: () => new Date('2026-07-22T12:05:00.000Z'),
      fetch: () => Promise.resolve(new Response(bytes)),
    });
    expect(repeated.bodyKey).toBe(result.bodyKey);
    expect(repeated.archivedNewBody).toBe(false);
  });
});
