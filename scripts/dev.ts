import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDirectory = resolve(root, 'apps/course-api');
const webDirectory = resolve(root, 'apps/student-web');
const bun = process.execPath;

const nodeCheck = spawnSync('node', ['--version'], { encoding: 'utf8' });
if (nodeCheck.error || nodeCheck.status !== 0) {
  console.error(
    'Node.js is required to run Wrangler locally. Enter the Nix development shell first.',
  );
  process.exit(1);
}

const localBinary = (directory: string, name: string): string =>
  resolve(directory, 'node_modules/.bin', process.platform === 'win32' ? `${name}.cmd` : name);

const preview = new Set(process.argv.slice(2)).has('--preview');
if (preview) {
  const build = spawnSync(bun, ['run', 'build'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

interface Child {
  readonly name: string;
  readonly process: ChildProcess;
}

const spawnService = (
  name: string,
  executable: string,
  args: ReadonlyArray<string>,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Child => ({
  name,
  process: spawn(executable, [...args], {
    cwd,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
  }),
});

const systemCaBundle = '/etc/ssl/certs/ca-bundle.crt';
const apiEnvironment = {
  ...process.env,
  ...(process.env.SSL_CERT_FILE === undefined && existsSync(systemCaBundle)
    ? { SSL_CERT_FILE: systemCaBundle }
    : {}),
};
const api = spawnService(
  'course-api',
  localBinary(apiDirectory, 'wrangler'),
  ['dev'],
  apiDirectory,
  apiEnvironment,
);
const web = spawnService(
  'student-web',
  localBinary(webDirectory, 'vite'),
  preview
    ? ['preview', '--host', '127.0.0.1', '--port', '4173']
    : ['--host', '127.0.0.1', '--port', '5173'],
  webDirectory,
  {
    ...process.env,
    VITE_API_URL: process.env.VITE_API_URL ?? 'http://127.0.0.1:8787',
    VITE_USE_FIXTURE: 'false',
  },
);
const children = [api, web];

const webUrl = preview ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173';
console.log('\nCourse Decision Product');
console.log(`  Student web: ${webUrl}`);
console.log('  Course API:  http://127.0.0.1:8787');
console.log('  OpenAPI:     http://127.0.0.1:8787/openapi');
console.log('\nPress Ctrl+C to stop both services.\n');

let shuttingDown = false;
const terminate = (child: Child, signal: NodeJS.Signals): void => {
  const pid = child.process.pid;
  if (pid === undefined || child.process.exitCode !== null) return;
  try {
    if (process.platform === 'win32') child.process.kill(signal);
    else process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
};

const shutdown = (exitCode: number): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) terminate(child, 'SIGTERM');
  setTimeout(() => {
    for (const child of children) terminate(child, 'SIGKILL');
    process.exit(exitCode);
  }, 2_000).unref();
};

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

for (const child of children) {
  child.process.once('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n[error] ${child.name} exited with code ${code ?? 1}.`);
      shutdown(code ?? 1);
    }
  });
}

await new Promise<never>(() => undefined);
