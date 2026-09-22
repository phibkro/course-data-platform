export interface SourceCacheNamespace {
  get(key: string, options: { readonly type: 'json' }): Promise<unknown>;
  put(key: string, value: string, options: { readonly expirationTtl: number }): Promise<void>;
}

export interface RuntimeTraceSpan {
  setAttribute(key: string, value?: boolean | number | string): void;
  end(): void;
}

export interface RuntimeTracing {
  enterSpan<Output>(name: string, callback: (span: RuntimeTraceSpan) => Output): Output;
}

interface CachedResponse {
  readonly version: 1;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Array<[string, string]>;
  readonly body: string;
}

export interface CachedSourceFetchOptions {
  readonly cache?: SourceCacheNamespace;
  readonly sha256Hex: (input: string) => Promise<string>;
  readonly tracing?: RuntimeTracing;
}

const keyPrefix = 'source-response:v1:';

const cacheTtlSeconds = (url: URL): number => {
  if (url.hostname === 'dbh-data.dataporten-api.no') return 21_600;
  if (url.hostname.endsWith('grades.no')) return 3_600;
  if (url.pathname.toLowerCase().includes('timeplan')) return 900;
  return 300;
};

const cacheBody = (body: BodyInit | null | undefined): string | undefined => {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  return undefined;
};

const isStringPair = (value: unknown): value is readonly [string, string] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'string' &&
  typeof value[1] === 'string';

const isCachedResponse = (value: unknown): value is CachedResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.status === 'number' &&
    Number.isInteger(record.status) &&
    record.status >= 200 &&
    record.status < 300 &&
    typeof record.statusText === 'string' &&
    Array.isArray(record.headers) &&
    record.headers.every(isStringPair) &&
    typeof record.body === 'string'
  );
};

const withoutTracing: RuntimeTracing = {
  enterSpan: (_name, callback) => callback({ setAttribute: () => undefined, end: () => undefined }),
};

export const makeCachedSourceFetch =
  (
    upstream: (url: string, init?: RequestInit) => Promise<Response>,
    options: CachedSourceFetchOptions,
  ): ((url: string, init?: RequestInit) => Promise<Response>) =>
  async (url, init) => {
    const tracing = options.tracing ?? withoutTracing;
    const parsedUrl = new URL(url);
    const method = (init?.method ?? 'GET').toUpperCase();

    return tracing.enterSpan('course-source.fetch', async (span) => {
      span.setAttribute('http.request.method', method);
      span.setAttribute('server.address', parsedUrl.hostname);
      span.setAttribute('url.path', parsedUrl.pathname);

      const body = cacheBody(init?.body);
      if (options.cache === undefined || body === undefined) {
        span.setAttribute('cache.outcome', 'bypass');
        return upstream(url, init);
      }

      const ttl = cacheTtlSeconds(parsedUrl);
      const key = `${keyPrefix}${await options.sha256Hex(JSON.stringify([method, url, body]))}`;
      span.setAttribute('cache.ttl_seconds', ttl);

      try {
        const cached = await options.cache.get(key, { type: 'json' });
        if (isCachedResponse(cached)) {
          span.setAttribute('cache.outcome', 'hit');
          span.setAttribute('cache.hit', true);
          return new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: cached.headers,
          });
        }
        span.setAttribute('cache.outcome', 'miss');
        span.setAttribute('cache.hit', false);
        if (cached !== null) span.setAttribute('cache.read', 'invalid');
      } catch {
        span.setAttribute('cache.outcome', 'miss');
        span.setAttribute('cache.hit', false);
        span.setAttribute('cache.read', 'error');
      }

      const response = await upstream(url, init);
      span.setAttribute('http.response.status_code', response.status);
      if (!response.ok) {
        span.setAttribute('cache.write', 'bypass');
        return response;
      }

      const record: CachedResponse = {
        version: 1,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()],
        body: await response.clone().text(),
      };
      try {
        await options.cache.put(key, JSON.stringify(record), { expirationTtl: ttl });
        span.setAttribute('cache.write', 'stored');
      } catch {
        span.setAttribute('cache.write', 'error');
      }
      return response;
    });
  };
