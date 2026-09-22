# Package test entrypoints

Status: frozen

## Developer journey

Running an advertised package unit-test command, directly in that package or
through Bun's workspace filter, runs that package's existing suite from the
repository's canonical Vitest configuration. A developer can trust both the
selected files and the exit status.

## Contract

- Audit every `test` script in the active `apps/*` and `packages/*`
  workspaces. Reuse `scripts/test.ts` for working-directory and Node/Nix
  runtime selection.
- Keep the root-suite behavior and specialized browser commands intact.
  This contract concerns advertised unit-test scripts, not browser behavior.
- Do not enable `passWithNoTests`, fabricate tests, or hide a failing exit.
- No application/UI changes, migrations, installs, original-checkout edits,
  deployment, or provider calls.

## Falsifiers and acceptance

1. Every remaining advertised workspace `test` command runs successfully both
   directly and with `bun run --filter <exact-package-name> test`.
2. Compare the real test reporter's selected file names with the tracked test
   files under that package; no sibling package may appear and none of its own
   tests may disappear.
3. An unmatched root filter still exits nonzero. A temporary intentionally
   failing assertion in one owned package makes its advertised command fail;
   remove that probe before final clean-head verification.
4. `bun run validate` passes on the final committed, clean worktree, including
   the unchanged root suite. Preserve logs outside the repository and record
   runtime/environment constraints honestly.

## Prior art

The existing NTNU-course package already uses `scripts/test.ts`. Plain
package-local `vitest run` inherits root-relative include patterns and finds no
tests. The installed Vitest `--dir` option was also tried with the root runner;
it still found no tests with those include patterns. Reuse the established
root-aware positional package filter, with a directory boundary.
