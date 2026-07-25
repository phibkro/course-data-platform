# Course Data Platform — agent context

## Product

Uni Planner helps NTNU students discover, understand, save, and compare courses
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

## Two stacks

This repository holds the current course-decision product and an older planner
that predates it. Both layer the same way — `apps -> infrastructure packages ->
application -> domain` — but they are separate lineages, and the distinction
decides where new work belongs.

**Current — the course-decision stack.** New product contracts are defined here.

- `packages/course-model` owns course facts, evidence, uncertainty, and pure
  derived classifications.
- `packages/source-ntnu-course` and `packages/source-grades` validate provider
  data and map it into the course model.
- `packages/course-service` coordinates sources, partial success, caching,
  retries, and timeouts when that complexity is present.
- `packages/contracts` owns public DTOs and mappings, never database rows.
- `apps/course-api` is the thin Elysia transport composition root.
- `apps/student-web` is the Foldkit application. Its model owns URL state,
  explicit remote-data state, and local preferences.
- `alchemy.run.ts` is the infrastructure composition root. Only `course-api` and
  `student-web` are built and deployed.

**Legacy — the planner stack.** `apps/web` (React), `apps/api-worker`,
`apps/ingest-worker`, `packages/{domain,study-kernel,application,database,
source-dbh,source-ntnu}`, and `legacy/ntnu-course-search`.

Maintain, do not extend. These are excluded from build and deploy, but lint,
`check:types`, and `test` still cover them, so breaking them blocks CI. Keep them
compiling and passing; do not add features to them, do not treat their patterns
as precedent for new work, and do not delete them in passing.

Two edges cross the two-stack boundary, and both are worth knowing before moving
code: `packages/contracts` depends on `packages/study-kernel`, and it imports `t`
from `elysia` — so every application, including the browser SPA, pulls Elysia in
transitively.

## Enduring invariants

Four structural boundaries are enforced rather than described — see
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
- Official curriculum, student scenarios, and actual progress are separate
  objects.
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
  `bun run build`. Read [`docs/agent/verification.md`](docs/agent/verification.md)
  when preparing a handoff or choosing additional checks.

Subsystem guidance is progressively disclosed:

- Student web: [`.claude/rules/student-web.md`](.claude/rules/student-web.md)
- Backend and data:
  [`.claude/rules/backend-and-data.md`](.claude/rules/backend-and-data.md)
- Infrastructure:
  [`.claude/rules/infrastructure.md`](.claude/rules/infrastructure.md)
- Legacy planner stack: [`.claude/rules/legacy-planner.md`](.claude/rules/legacy-planner.md)

Claude Code loads those rules by path. Other agents should read the relevant file
before editing that subsystem.
