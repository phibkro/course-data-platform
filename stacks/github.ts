import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as GitHub from 'alchemy/GitHub';
import * as Config from 'effect/Config';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Redacted from 'effect/Redacted';

const owner = 'phibkro';
const repository = 'course-data-platform';

export default Alchemy.Stack(
  'CourseDecisionGitHub',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const accountId = yield* Config.string('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = yield* Cloudflare.ApiToken.AccountApiToken('PreviewCIToken', {
      name: 'course-data-platform-github-preview',
      accountId,
      policies: [
        {
          effect: 'allow',
          permissionGroups: ['Workers Scripts Write', 'Secrets Store Write'],
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: '*',
          },
        },
      ],
    });

    yield* GitHub.Secret('PreviewCloudflareApiToken', {
      owner,
      repository,
      name: 'CLOUDFLARE_API_TOKEN',
      value: apiToken.value,
    });
    yield* GitHub.Secret('PreviewCloudflareAccountId', {
      owner,
      repository,
      name: 'CLOUDFLARE_ACCOUNT_ID',
      value: Redacted.make(accountId),
    });
    yield* GitHub.Variable('PreviewDeploymentsEnabled', {
      owner,
      repository,
      name: 'PREVIEW_DEPLOYMENTS_ENABLED',
      value: 'true',
    });
  }),
);
