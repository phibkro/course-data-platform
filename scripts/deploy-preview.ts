import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiConfig = resolve(root, 'infra/previews/course-api.wrangler.json');
const apiRoot = resolve(root, 'apps/course-api');
const webConfig = resolve(root, 'infra/previews/student-web.wrangler.json');
const webRoot = resolve(root, 'apps/student-web');
const wrangler = resolve(apiRoot, 'node_modules/.bin/wrangler');
const prNumber = process.argv[2];

if (prNumber === undefined || !/^[1-9]\d*$/.test(prNumber)) {
  console.error('Usage: bun run deploy:preview -- <pr-number>');
  process.exit(1);
}

const previewName = `pr-${prNumber}`;
const isCi = process.env.CI === 'true';

const run = (
  command: string,
  args: ReadonlyArray<string>,
  cwd = root,
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
};

const runVisible = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  env: NodeJS.ProcessEnv,
): void => {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const branch = isCi ? process.env.GITHUB_HEAD_REF : run('git', ['branch', '--show-current']);
if (branch === undefined || branch.length === 0 || branch === 'main') {
  console.error('Preview deployment requires a named non-main branch.');
  process.exit(1);
}

if (run('git', ['status', '--porcelain', '--untracked-files=no']).length > 0) {
  console.error('Refusing preview deployment from a dirty tracked worktree.');
  process.exit(1);
}

const head = run('git', ['rev-parse', 'HEAD']);
const expectedHead = isCi
  ? process.env.GITHUB_HEAD_SHA
  : run('git', ['rev-parse', `origin/${branch}`]);
if (expectedHead === undefined || head !== expectedHead) {
  console.error('Refusing preview deployment: HEAD must exactly match the pushed branch revision.');
  process.exit(1);
}

type PreviewResult = {
  readonly deployment: {
    readonly urls: ReadonlyArray<string>;
  };
  readonly preview: {
    readonly urls: ReadonlyArray<string>;
  };
};

const parsePreviewResult = (output: string): PreviewResult => {
  const jsonStart = output.lastIndexOf('\n{');
  const json = jsonStart === -1 ? output : output.slice(jsonStart + 1);
  const parsed = JSON.parse(json) as Partial<PreviewResult>;
  if (
    !Array.isArray(parsed.preview?.urls) ||
    parsed.preview.urls.length === 0 ||
    !Array.isArray(parsed.deployment?.urls) ||
    parsed.deployment.urls.length === 0
  ) {
    throw new Error('Wrangler did not return Preview and deployment URLs.');
  }
  return parsed as PreviewResult;
};

const wranglerArgs = [
  'preview',
  '--name',
  previewName,
  '--tag',
  head.slice(0, 12),
  '--message',
  `PR #${prNumber} ${head}`,
  '--json',
] as const;
const sourceUrl = `https://github.com/phibkro/course-data-platform/tree/${head}`;

console.log(`Deploying API Worker Preview ${previewName}`);
const api = parsePreviewResult(run(wrangler, [...wranglerArgs, '--config', apiConfig]));
const apiUrl = api.preview.urls[0];

console.log('Building web Preview against the API Preview');
runVisible('bun', ['run', 'build'], webRoot, {
  ...process.env,
  VITE_API_URL: apiUrl,
  VITE_SOURCE_URL: sourceUrl,
});

console.log(`Deploying web Worker Preview ${previewName}`);
const web = parsePreviewResult(run(wrangler, [...wranglerArgs, '--config', webConfig]));

const outputs = {
  api_deployment_url: api.deployment.urls[0],
  api_url: apiUrl,
  commit: head,
  source_url: sourceUrl,
  web_deployment_url: web.deployment.urls[0],
  web_url: web.preview.urls[0],
};

for (const [name, value] of Object.entries(outputs)) {
  console.log(`${name}: ${value}`);
  if (process.env.GITHUB_OUTPUT !== undefined) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}
