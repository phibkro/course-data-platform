import apiWorker from './previews/course-api.wrangler.json' with { type: 'json' };
import webWorker from './previews/student-web.wrangler.json' with { type: 'json' };
import * as Cloudflare from 'alchemy/Cloudflare';
import { Stack } from 'alchemy/Stack';
import { Stage } from 'alchemy/Stage';
import * as Effect from 'effect/Effect';

export default Stack(
  'CourseDecisionProduct',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;
    if (stage !== 'prod') {
      return yield* Effect.die(
        new Error(
          'Alchemy manages production only. Use bun run deploy:preview -- <pr-number> for development deployments.',
        ),
      );
    }

    const sourceCache = yield* Cloudflare.KV.Namespace('SourceCache');
    const api = yield* Cloudflare.Worker('CourseApi', {
      name: apiWorker.name,
      main: './apps/course-api/src/worker.ts',
      compatibility: {
        date: '2026-07-21',
      },
      env: {
        SOURCE_CACHE: sourceCache,
      },
      observability: {
        enabled: true,
        headSamplingRate: 1,
        logs: {
          enabled: true,
          headSamplingRate: 1,
          invocationLogs: true,
          persist: true,
        },
        traces: {
          enabled: true,
          headSamplingRate: 1,
          persist: true,
        },
      },
    });
    const web = yield* Cloudflare.Website.Vite('StudentWeb', {
      rootDir: './apps/student-web',
      name: webWorker.name,
      domain: 'planner.phibkro.org',
      env: {
        VITE_API_URL: api.url.as<string>(),
        VITE_SOURCE_URL:
          process.env.COURSE_PLATFORM_SOURCE_URL ??
          'https://github.com/phibkro/course-data-platform',
      },
      assets: {
        notFoundHandling: 'single-page-application',
      },
    });

    return {
      apiUrl: api.url,
      webUrl: web.url,
    };
  }),
);
