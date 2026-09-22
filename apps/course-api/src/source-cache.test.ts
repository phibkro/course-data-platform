import { describe, expect, it } from 'vitest';

import {
  makeCachedSourceFetch,
  type SourceCacheNamespace,
  type RuntimeTraceSpan,
  type RuntimeTracing,
} from './source-cache';

const sha256Hex = async (input: string): Promise<string> => input;

const memoryCache = (): {
  readonly namespace: SourceCacheNamespace;
  readonly values: Map<string, string>;
} => {
  const values = new Map<string, string>();
  return {
    values,
    namespace: {
      get: async (key) => {
        const value = values.get(key);
        return value === undefined ? null : JSON.parse(value);
      },
      put: async (key, value) => {
        values.set(key, value);
      },
    },
  };
};

const traceOutcomes = (): {
  readonly tracing: RuntimeTracing;
  readonly attributes: Array<ReadonlyMap<string, boolean | number | string | undefined>>;
} => {
  const attributes: Array<Map<string, boolean | number | string | undefined>> = [];
  return {
    attributes,
    tracing: {
      enterSpan: (_name, callback) => {
        const current = new Map<string, boolean | number | string | undefined>();
        attributes.push(current);
        const span: RuntimeTraceSpan = {
          setAttribute: (key, value) => {
            current.set(key, value);
          },
          end: () => undefined,
        };
        return callback(span);
      },
    },
  };
};

describe('cached source fetch', () => {
  it('reconstructs a cached batch response without a second upstream request', async () => {
    const cache = memoryCache();
    const trace = traceOutcomes();
    let upstreamCalls = 0;
    const cachedFetch = makeCachedSourceFetch(
      async () => {
        upstreamCalls += 1;
        return Response.json([{ code: 'TDT4136' }], {
          headers: { etag: 'catalogue-v1', 'x-provider': 'ntnu' },
        });
      },
      { cache: cache.namespace, sha256Hex, tracing: trace.tracing },
    );

    const first = await cachedFetch('https://www.ntnu.no/course-search', {
      method: 'POST',
      body: '{"codes":["TDT4136"]}',
    });
    const second = await cachedFetch('https://www.ntnu.no/course-search', {
      method: 'POST',
      body: '{"codes":["TDT4136"]}',
    });

    expect(await first.json()).toEqual([{ code: 'TDT4136' }]);
    expect(await second.json()).toEqual([{ code: 'TDT4136' }]);
    expect(second.headers.get('etag')).toBe('catalogue-v1');
    expect(upstreamCalls).toBe(1);
    expect(trace.attributes[1]?.get('cache.outcome')).toBe('hit');
  });

  it('uses the complete POST body in the batch cache key', async () => {
    const cache = memoryCache();
    let upstreamCalls = 0;
    const cachedFetch = makeCachedSourceFetch(
      async (_url, init) => {
        upstreamCalls += 1;
        return Response.json({ body: init?.body });
      },
      { cache: cache.namespace, sha256Hex },
    );

    const url = 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData';
    await cachedFetch(url, { method: 'POST', body: '{"course":"TDT4136"}' });
    await cachedFetch(url, { method: 'POST', body: '{"course":"TMA4100"}' });
    await cachedFetch(url, { method: 'POST', body: '{"course":"TDT4136"}' });

    expect(upstreamCalls).toBe(2);
    expect(cache.values.size).toBe(2);
  });

  it('fails open when KV reads and writes fail', async () => {
    let upstreamCalls = 0;
    const cache: SourceCacheNamespace = {
      get: async () => {
        throw new Error('KV unavailable');
      },
      put: async () => {
        throw new Error('KV unavailable');
      },
    };
    const cachedFetch = makeCachedSourceFetch(
      async () => {
        upstreamCalls += 1;
        return new Response('live source', { status: 200 });
      },
      { cache, sha256Hex },
    );

    expect(await (await cachedFetch('https://www.ntnu.no/course-search')).text()).toBe(
      'live source',
    );
    expect(upstreamCalls).toBe(1);
  });

  it('does not cache unsuccessful upstream responses', async () => {
    const cache = memoryCache();
    let upstreamCalls = 0;
    const cachedFetch = makeCachedSourceFetch(
      async () => {
        upstreamCalls += 1;
        return new Response('unavailable', { status: 503 });
      },
      { cache: cache.namespace, sha256Hex },
    );

    await cachedFetch('https://www.ntnu.no/course-search');
    await cachedFetch('https://www.ntnu.no/course-search');

    expect(upstreamCalls).toBe(2);
    expect(cache.values.size).toBe(0);
  });
});
