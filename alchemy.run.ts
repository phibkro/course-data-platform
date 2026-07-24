import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as GitHub from 'alchemy/GitHub';
import * as Output from 'alchemy/Output';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

export const CourseApi = Cloudflare.Worker('CourseApi', {
  main: './apps/course-api/src/worker.ts',
  compatibility: {
    date: '2026-07-21',
  },
});

export default Alchemy.Stack(
  'CourseDecisionProduct',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const api = yield* CourseApi;
    const web = yield* Cloudflare.Website.Vite('StudentWeb', {
      rootDir: './apps/student-web',
      ...(stage === 'prod' ? { domain: 'planner.phibkro.org' } : {}),
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

    const github = yield* GitHub.GitHubEnv;
    if (github?.pr !== undefined) {
      yield* GitHub.Comment('PreviewComment', {
        owner: github.owner,
        repository: github.repository,
        issueNumber: github.pr,
        allowDelete: true,
        body: Output.interpolate`
          ## Preview ready

          **Open the app:** ${web.url}

          Built from commit [\`${github.sha.slice(0, 7)}\`](https://github.com/${github.owner}/${github.repository}/tree/${github.sha}).

          _This comment updates on every push and is removed when the pull request closes._
        `,
      });
    }

    return {
      apiUrl: api.url,
      webUrl: web.url,
    };
  }),
);
