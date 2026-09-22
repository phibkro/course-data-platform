import { env, tracing } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { Elysia } from 'elysia';

import { createCourseApi } from './app';
import { makeCloudflareEffectTracer } from './cloudflare-tracer';
import { makeLiveCourseDecisionService } from './course-decision/live';
import { makeCachedSourceFetch, type SourceCacheNamespace } from './source-cache';

interface Env {
  readonly SOURCE_CACHE?: SourceCacheNamespace;
}

const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const sourceCache = (env as Env).SOURCE_CACHE;
const sourceFetch = makeCachedSourceFetch((url, init) => fetch(url, init), {
  ...(sourceCache === undefined ? {} : { cache: sourceCache }),
  sha256Hex,
  tracing,
});
const service = makeLiveCourseDecisionService(
  {
    fetch: sourceFetch,
    now: () => new Date(),
    sha256Hex,
    tracer: makeCloudflareEffectTracer(tracing),
  },
  {
    academicYear: 2026,
    season: 'autumn',
    gradeFromYear: 2022,
    gradeToYear: 2025,
    sourceRequestTimeoutMs: 2_500,
    sourceCacheTtlMs: 60_000,
    sourceCacheMaxEntriesPerProvider: 64,
  },
);

export default new Elysia({ adapter: CloudflareAdapter }).use(createCourseApi(service)).compile();
