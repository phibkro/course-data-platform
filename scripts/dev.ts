import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIRECTORY = resolve(ROOT, 'apps/api-worker');
const WEB_DIRECTORY = resolve(ROOT, 'apps/web');
const bun = process.execPath;

const nodeCheck = spawnSync('node', ['--version'], { encoding: 'utf8' });
if (nodeCheck.error || nodeCheck.status !== 0) {
  console.error(
    'Node.js is required to run Wrangler locally. Enter the Nix flake with direnv (`direnv allow`) or `nix develop` before starting the stack.',
  );
  process.exit(1);
}

type Mode = 'development' | 'preview';

type Child = {
  readonly name: string;
  readonly process: ChildProcess;
};

type Command = {
  readonly executable: string;
  readonly args: string[];
  readonly cwd: string;
};

const localBinary = (directory: string, name: string): string =>
  resolve(directory, 'node_modules/.bin', process.platform === 'win32' ? `${name}.cmd` : name);

const wrangler = localBinary(API_DIRECTORY, 'wrangler');
const vite = localBinary(WEB_DIRECTORY, 'vite');

const args = new Set(process.argv.slice(2));
const mode: Mode = args.has('--preview') ? 'preview' : 'development';
const skipMigrations = args.has('--skip-migrations');
const skipBuild = args.has('--skip-build');

const exitCodeOf = (child: ChildProcess): Promise<number> => {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  if (child.signalCode !== null) return Promise.resolve(128);

  return new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code !== null) resolveExit(code);
      else resolveExit(signal === null ? 1 : 128);
    });
  });
};

const spawnCommand = (
  command: Command,
  options: { readonly interactive?: boolean; readonly detached?: boolean } = {},
): ChildProcess =>
  spawn(command.executable, command.args, {
    cwd: command.cwd,
    env: process.env,
    stdio: options.interactive ? 'inherit' : ['ignore', 'inherit', 'inherit'],
    detached: options.detached ?? false,
    shell: process.platform === 'win32',
  });

const run = async (name: string, command: Command): Promise<void> => {
  console.log(`\n[setup] ${name}`);
  const child = spawnCommand(command, { interactive: true });
  const exitCode = await exitCodeOf(child);
  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit code ${exitCode}`);
  }
};

if (mode === 'preview' && !skipBuild) {
  await run('Building production artifacts', {
    executable: bun,
    args: ['run', 'build'],
    cwd: ROOT,
  });
}

if (!skipMigrations) {
  await run('Applying local D1 migrations', {
    executable: wrangler,
    args: ['d1', 'migrations', 'apply', 'course-data-dev', '--local'],
    cwd: API_DIRECTORY,
  });
}

const spawnService = (name: string, command: Command): Child => {
  console.log(`[start] ${name}`);
  return {
    name,
    process: spawnCommand(command, {
      interactive: name === 'api',
      detached: process.platform !== 'win32',
    }),
  };
};

const webCommand: Command =
  mode === 'preview'
    ? {
        executable: vite,
        args: ['preview', '--host', '127.0.0.1', '--port', '4173'],
        cwd: WEB_DIRECTORY,
      }
    : {
        executable: vite,
        args: [],
        cwd: WEB_DIRECTORY,
      };

const children: Child[] = [
  spawnService('api', {
    executable: wrangler,
    args: ['dev'],
    cwd: API_DIRECTORY,
  }),
  spawnService('web', webCommand),
];

const webUrl = mode === 'preview' ? 'http://localhost:4173' : 'http://localhost:5173';
console.log(`\nCourse Data Platform (${mode})`);
console.log(`  PWA:      ${webUrl}`);
console.log('  API:      http://localhost:8787');
console.log('  OpenAPI:  http://localhost:8787/openapi');
console.log('  Health:   http://localhost:8787/health');
console.log('\nPress Ctrl+C to stop the complete stack.\n');

let shuttingDown = false;

const killProcessTree = (child: Child, signal: NodeJS.Signals): void => {
  if (child.process.killed || child.process.exitCode !== null) return;
  const pid = child.process.pid;
  if (pid === undefined) return;

  try {
    if (process.platform !== 'win32') process.kill(-pid, signal);
    else child.process.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
};

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

const shutdown = async (exitCode: number): Promise<never> => {
  if (shuttingDown) process.exit(exitCode);
  shuttingDown = true;

  console.log('\n[stop] Stopping development stack…');
  for (const child of children) killProcessTree(child, 'SIGTERM');

  const exited = Promise.all(children.map(({ process: child }) => exitCodeOf(child)));
  const forced = delay(2_000).then(() => {
    for (const child of children) killProcessTree(child, 'SIGKILL');
  });
  await Promise.race([exited, forced]);
  process.exit(exitCode);
};

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));

const unexpectedExit = await Promise.race(
  children.map(async (child) => ({
    name: child.name,
    exitCode: await exitCodeOf(child.process),
  })),
);

if (!shuttingDown) {
  console.error(
    `\n[error] ${unexpectedExit.name} exited unexpectedly with code ${unexpectedExit.exitCode}.`,
  );
  await shutdown(unexpectedExit.exitCode || 1);
}

await new Promise<never>(() => undefined);
