import { spawn } from 'node:child_process';

const [command, suppliedCode] = process.argv.slice(2);

const usage = (): never => {
  console.error(`Usage:
  bun run theme:resolve
  bun run theme:decode -- <preset-code>
  bun run theme:open -- <preset-code>
  bun run theme:apply -- <preset-code>`);
  process.exit(1);
};

const requireCode = (): string => suppliedCode ?? usage();

const run = async (args: string[]): Promise<void> => {
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(args[0] ?? 'bunx', args.slice(1), {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exit(exitCode);
};

switch (command) {
  case 'resolve':
    await run(['bunx', 'shadcn@latest', 'preset', 'resolve', '-c', 'apps/web']);
    break;
  case 'decode':
  case 'open':
    await run(['bunx', 'shadcn@latest', 'preset', command, requireCode()]);
    break;
  case 'apply':
    await run([
      'bunx',
      'shadcn@latest',
      'apply',
      '--preset',
      requireCode(),
      '--only',
      'theme',
      '-c',
      'apps/web',
    ]);
    break;
  default:
    usage();
}
