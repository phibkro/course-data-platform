# Verification guide

Verification follows risk and observable behavior. Run focused checks while
iterating, then expand only as the affected boundary requires.

## What the commands cover

`package.json` is the authority for what each script runs; this is only the map
of which gate owns which risk.

| Command | Covers |
| --- | --- |
| `bun run check` | `fmt:check`, `lint`, `i18n:check`, `check:types` |
| `bun run test` | Vitest — seam properties, semantic source fixtures, Foldkit transitions, and architecture invariants |
| `bun run build` | Typecheck, then bundles `course-api` and `student-web` |
| `bun run validate` | `openapi` + everything in `check` + `test` |
| `bun run test:journeys` | Playwright golden journeys, real HTTP integration, keyboard checks, and axe |

Two gates are easy to miss:

- `i18n:check` runs inside `bun run check`, so a missing EN or NB message fails
  the ordinary gate rather than a separate one.
- `test:journeys` runs neither in `check` nor in `test`. CI runs it separately.
  Run it when rendered structure, focus, colour, responsive behavior, public
  HTTP decoding, persistence, or URL state changes.

## Common handoff

For ordinary TypeScript changes:

1. Run focused tests for the changed module or behavior.
2. Run `bun run check`.
3. Run `bun run test`.
4. Run `bun run build` when bundling, generated CSS, assets, or deployment output
   could change.

## Additional boundaries

- Student interaction: preserve the applicable `GJ-01` through `GJ-07`
  observable journey and run `bun run test:journeys`.
- Public HTTP contract: run transport tests and `bun run openapi`; confirm the
  checked-in artifact has only intended changes.
- Provider parsing: combine constrained property checks with captured semantic
  fixtures. Generated data proves structural laws; fixtures prove the meaning
  of real provider phrases and shapes.
- Persistence or URL state: property-test parsing, canonicalization, migration,
  corruption recovery, filter algebra, and transition sequences; use the
  browser journey for reload and history behavior.
- Infrastructure: inspect the plan before applying it, verify the resulting public
  endpoint, and keep production and preview stages explicit.
- Architecture boundaries: if `tests/architecture.test.ts` fails, read the rule
  before you change it. A non-empty scan assertion prevents a deleted or renamed
  source directory from making a boundary check pass over no files.

Do not substitute a broad green command for a missing behavior-level test.
Conversely, do not run unrelated expensive suites when a narrow change cannot
affect them. Report what ran, what did not run, and any remaining uncertainty.
