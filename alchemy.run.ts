import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Effect from 'effect/Effect';

export const CourseApi = Cloudflare.Worker('CourseApi', {
  main: './apps/course-api/src/worker.ts',
  compatibility: {
    date: '2026-07-21',
  },
});

export default Alchemy.Stack(
  'CourseDecisionProduct',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const api = yield* CourseApi;
    const web = yield* Cloudflare.Website.Vite('StudentWeb', {
      rootDir: './apps/student-web',
      domain: 'planner.phibkro.org',
      env: {
        VITE_API_URL: api.url.as<string>(),
        VITE_SOURCE_URL: 'https://github.com/phibkro/course-data-platform',
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
