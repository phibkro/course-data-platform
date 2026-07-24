import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const fail = (message: string): never => {
  console.error(`Preview deployment refused: ${message}`);
  process.exit(1);
};

const git = (...args: ReadonlyArray<string>): string => {
  const result = spawnSync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
};

const [prNumber, ...alchemyArguments] = process.argv.slice(2);
if (prNumber === undefined || !/^[1-9]\d*$/.test(prNumber)) {
  fail('provide a positive PR number, for example `bun run deploy:preview -- 6`.');
}

const branch = git('branch', '--show-current');
if (branch.length === 0 || branch === 'main') {
  fail('check out the pushed PR branch rather than main or a detached HEAD.');
}

if (git('status', '--porcelain=v1', '--untracked-files=no') !== '') {
  fail('tracked worktree changes are present; commit and review the exact preview first.');
}

const head = git('rev-parse', 'HEAD');
const remoteHead = git('rev-parse', `origin/${branch}`);
if (head !== remoteHead) {
  fail(`HEAD does not match origin/${branch}; push the reviewed commit first.`);
}

const stage = `pr-${prNumber}`;
const sourceUrl = `https://github.com/phibkro/course-data-platform/tree/${head}`;
console.log(`Deploying PR #${prNumber} preview from ${branch} at ${head.slice(0, 12)}.`);

const alchemy = resolve(root, 'node_modules/.bin/alchemy');
const result = spawnSync(
  alchemy,
  ['deploy', '--stage', stage, 'alchemy.run.ts', ...alchemyArguments],
  {
    cwd: root,
    env: {
      ...process.env,
      COURSE_PLATFORM_SOURCE_URL: sourceUrl,
    },
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
