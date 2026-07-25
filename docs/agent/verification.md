# Verification guide

Verification follows risk and observable behavior. Run focused checks while
iterating, then expand only as the affected boundary requires.

## What the commands cover

`package.json` is the authority for what each script runs; this is only the map
of which gate owns which risk.

| Command | Covers |
| --- | --- |
| `bun run check` | `fmt:check`, `lint`, `i18n:check`, `check:types` |
| `bun run test` | Vitest — unit, Story/Scene, and `tests/architecture.test.ts` |
| `bun run build` | Typecheck, then bundles `course-api` and `student-web` |
| `bun run validate` | `openapi` + everything in `check` + `test` |
| `bun run test:a11y` | Playwright + axe. **Not** part of `check` or `test` |

Two gates are easy to miss because they are not where you would guess:

- `i18n:check` runs inside `bun run check`, so a missing EN or NB message fails
  the ordinary gate rather than a separate one.
- `test:a11y` runs neither in `check` nor in `test`. CI runs it as its own step,
  so a green local `check` says nothing about accessibility. Run it yourself when
  you touch rendered structure, focus, colour, or responsive behavior.

## Common handoff

For ordinary TypeScript changes:

1. Run focused tests for the changed module or behavior.
2. Run `bun run check`.
3. Run `bun run test`.
4. Run `bun run build` when bundling, generated CSS, assets, or deployment output
   could change.

## Additional boundaries

- Student interaction: add or update Story/Scene coverage, run the relevant
  real-browser journey, and run `bun run test:a11y`.
- Public HTTP contract: run transport tests and `bun run openapi`; confirm the
  checked-in artifact has only intended changes.
- Provider parsing: test known, unknown, malformed, partial-success, and source
  failure fixtures.
- Persistence or URL state: test parsing, canonicalization, migration, corruption
  recovery, reload, and browser history as applicable.
- Infrastructure: inspect the plan before applying it, verify the resulting public
  endpoint, and keep production and preview stages explicit.
- Architecture boundaries: if `tests/architecture.test.ts` fails, read the rule
  before working around it. Its allowlists (`knownViolations`, `knownLegacyEdges`)
  record real, named debt — adding to them is a decision to declare, not a way to
  make a failure quiet.

Do not substitute a broad green command for a missing behavior-level test.
Conversely, do not run unrelated expensive suites when a narrow change cannot
affect them. Report what ran, what did not run, and any remaining uncertainty.
