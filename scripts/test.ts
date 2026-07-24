import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arguments_ = process.argv.slice(2);

const nodeCheck = spawnSync('node', ['--version'], { encoding: 'utf8' });
if (nodeCheck.error || nodeCheck.status !== 0) {
  const reenteredFromNix = process.env.COURSE_DATA_TEST_NIX_REENTRY === '1';
  const nixCheck = spawnSync('nix', ['--version'], { encoding: 'utf8' });
  if (!reenteredFromNix && nixCheck.status === 0) {
    console.log('Node.js is not on PATH; entering the repository Nix development shell…');
    const result = spawnSync(
      'nix',
      ['develop', '--command', 'bun', 'scripts/test.ts', ...arguments_],
      {
        cwd: root,
        env: { ...process.env, COURSE_DATA_TEST_NIX_REENTRY: '1' },
        stdio: 'inherit',
      },
    );
    process.exit(result.status ?? 1);
  }
  console.error(
    'Node.js is required by the Vitest worker runtime. Install Node.js 22+ or run `nix develop --command bun run test`.',
  );
  process.exit(1);
}

const vitest = resolve(root, 'node_modules/vitest/vitest.mjs');
const result = spawnSync('node', [vitest, 'run', ...arguments_], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
