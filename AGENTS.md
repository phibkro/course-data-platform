# Course Data Platform — agent context

## Cross-provider delegation

- Launch Claude Code directly inside `pagu-box`; `agent-dispatch` is deprecated
  for this repository.
- Use `pagu-box --profile=strict --claude -- claude
  --dangerously-skip-permissions ...` for bounded editing workers.
- Add `--pwd-ro` for advisors and reviews that must not edit the checkout.
- Keep delegation to at most two concurrent Claude workers and depth two
  (lead → worker → reviewer).
- Give each worker explicit file or subsystem ownership. Use worktrees or Herdr
  panes when concurrent edits would otherwise overlap or become hard to
  observe.
- The outer pagu sandbox is the permission boundary. A delegated worker may
  narrow access but must not widen it.

## Product

Course Lens helps NTNU students discover, understand, save, and compare courses
using trustworthy evidence. It is anonymous, local-first, and NTNU-only.

The active value loop is `Explore -> Inspect -> List -> Compare`. A vertical
slice succeeds when a student can make a better course decision in the browser;
infrastructure or abstraction alone is not product progress.

**List and Saved are both correct, in different layers.** `List` is the domain
term and the stable `/list` route. `Saved` is the student-facing navigation
label, and lives only in the message catalogue (`nav.list` in
`apps/student-web/src/i18n.ts`). Do not rename the route to match the label, or
the label to match the route.

Read before changing product behaviour:

- [`docs/product/student-experience-contract.md`](docs/product/student-experience-contract.md)
  — surface vocabulary, shared concepts, the accessibility contract, and the
  **Parallel readiness** table. That table, not this file, decides what work each
  surface allows today: Explore/Inspect and List/Compare are open, while Schedule
  and Degree stay specification lanes until their data-readiness gates are met.
  Check the gate before starting work on a surface.
- [`docs/agent-context/next-slice.md`](docs/agent-context/next-slice.md) — the
  active slice, its required path, acceptance criteria, and what is deferred.
- the surface specification under `docs/product/` for whatever you are changing.
- [ADR-012](docs/adr/012-course-decisions-first.md) for why the course-decision
  product leads, and [ADR-011](docs/adr/011-theme-lab-and-design-freeze.md) for
  the design freeze that still constrains discretionary visual work. There is no
  ADR index; `ls docs/adr/` is the list.

Programme planning, accounts, cross-device synchronization, additional
institutions, and full national replication remain later options until the
course-decision loop demonstrates repeat value.

## Architecture

This repository contains one active product with two runtime applications and
one shared wire-contract package:

- `apps/student-web` is the Foldkit browser application. Its feature modules
  own URL state, explicit remote-data state, and local preferences.
- `packages/course-contracts` owns neutral TypeBox JSON schemas. It does not
  import Elysia or server domain modules.
- `apps/course-api` is the Elysia and Cloudflare application. Internal
  `course-decision` modules own facts, evidence, uncertainty, orchestration,
  caching, deadlines, and partial success.
- `apps/course-api/src/sources` validates provider data before application code
  consumes it.
- `infra/alchemy.run.ts` is the infrastructure composition root. The `infra`
  workspace isolates Alchemy's Effect runtime from the Foldkit application.

The browser and API remain separate because they have different runtime and
trust boundaries. Backend domain, service, and source seams are modules inside
the API application, not independently published workspace packages.

## Enduring invariants

Structural boundaries are enforced rather than described. See
`.oxlintrc.json` (domain purity) and
[`tests/architecture.test.ts`](tests/architecture.test.ts) (ambient clocks, SQL
in transport, appearance tokens, dependency direction). Read the failure message
before working around one.

The invariants that judgement still carries:

- Parse untrusted provider, storage, URL, and transport data at a boundary.
- Preserve unknown, unavailable, suppressed, stale, failed, and conflicting
  states. Never turn them into zero, false, empty, or favourable values.
  Unknown is neutral; it must never rank as favourable.
- Every public factual field and relation has a source, or is explicitly marked
  as fixture, student-authored, or inference. Derived classifications expose
  their evidence and uncertainty.
- A source failure does not erase independently available information.
- Do not pre-provision infrastructure or general frameworks for deferred
  capabilities.
- Generated artifacts are checked in and must be reproducible.

## Working in this repository

- Bun is the package manager and runner; do not add another root lockfile.
- TypeScript 7 is the compiler authority.
- Match the surrounding code's naming, structure, comment density, and idiom.
- Prefer explicit typed models, schemas, and interfaces when a functional
  distinction is established. They are executable context for delegated work;
  do not encode speculative abstractions before a student-facing need proves
  the distinction useful.
- Use judgment proportional to the change. Keep a slice small enough to verify
  through its observable behavior, and do not broaden it with unrelated cleanup.
- The common quality commands are `bun run check`, `bun run test`, and
  `bun run build`. Student-journey changes also run `bun run test:journeys`.
  Read [`docs/agent/verification.md`](docs/agent/verification.md) when preparing
  a handoff or choosing additional checks.

Subsystem guidance is progressively disclosed:

- Student web: [`.claude/rules/student-web.md`](.claude/rules/student-web.md)
- Backend and data:
  [`.claude/rules/backend-and-data.md`](.claude/rules/backend-and-data.md)
- Infrastructure:
  [`.claude/rules/infrastructure.md`](.claude/rules/infrastructure.md)

Claude Code loads those rules by path. Other agents should read the relevant file
before editing that subsystem.
