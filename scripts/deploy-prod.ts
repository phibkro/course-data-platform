import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

const fail = (message: string): never => {
  console.error(`Production deployment refused: ${message}`);
  process.exit(1);
};

const branch = git('branch', '--show-current');
if (branch !== 'main') {
  fail(`current branch is ${branch || 'detached HEAD'}, not main.`);
}

if (git('status', '--porcelain=v1', '--untracked-files=all') !== '') {
  fail('the worktree is not clean.');
}

const head = git('rev-parse', 'HEAD');
const remoteMain = git('rev-parse', 'origin/main');
if (head !== remoteMain) {
  fail('HEAD does not match origin/main. Fetch, pull, and review the exact commit first.');
}

console.log(`Deploying production from main at ${head.slice(0, 12)}.`);
const alchemy = resolve(root, 'node_modules/.bin/alchemy');
const result = spawnSync(
  alchemy,
  ['deploy', '--stage', 'prod', 'alchemy.run.ts', ...process.argv.slice(2)],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
