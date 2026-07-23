# Course Decision Product

An evidence-backed NTNU course browser for answering the questions students
actually have before choosing a subject: what it covers, how teaching works,
what work is obligatory, how it is assessed, whether collaboration or
attendance is explicit, and what historical grade outcomes look like.

The active product is a Foldkit web application backed by a small Elysia API.
It fetches NTNU course data plus grades.no and DBH grade evidence, validates
every source at the boundary, and preserves unavailable, conflicting, inferred,
and fixture states instead of presenting guesses as facts.

## Active slice

```text
Foldkit web -> Elysia/OpenAPI -> Effect service
                              -> NTNU course search/detail
                              -> grades.no + DBH/HK-dir outcomes
```

Implemented now:

- exact course-code search and a decision-oriented course detail;
- explicit evidence and per-source status for every factual result;
- independent partial success when detail or grade providers fail;
- ordinary-term, bounded grade aggregation with pass/fail outcomes kept
  separate from ordinal letter grades;
- Foldkit loading, success, partial, empty, and error scenes;
- responsive Material You styling with desktop sidebar and mobile bottom bar;
- TypeBox boundary contracts, public OpenAPI, and browser-facing response
  validation;
- TypeScript 7 authority plus TypeScript 6 compatibility;
- a minimal, parallel Alchemy v2 stack containing only the course API and
  student web application.

The earlier programme planner, replication pipeline, D1/R2/Queue stack, and
Workbench remain in the repository as a legacy platform baseline. They are not
part of the default development, build, or deployment path.

## Commands

```sh
bun install --frozen-lockfile
bun run validate
bun run build
bun run dev
```

The combined development command starts the active product:

- Student web: `http://localhost:5173`
- API service index: `http://localhost:8787`
- OpenAPI UI: `http://localhost:8787/openapi`

There is no database migration or account setup in the active slice. The API
does need outbound access to the public source APIs. `bun run dev:api` and
`VITE_API_URL=http://localhost:8787 bun run dev:web` are available for separate
terminals. Override that origin when needed; use `VITE_USE_FIXTURE=true` only
for explicit offline UI work.

Run the previous platform deliberately with `bun run legacy:dev:platform`.

Generate the checked-in public API document with:

```sh
bun run openapi
```

## Infrastructure

Alchemy v2 uses the new stack ID `CourseDecisionProduct` and new resource IDs,
so it does not adopt, mutate, or destroy the earlier v1-managed resources.
Inspect the two-resource change before a first deployment:

```sh
bun run infra:plan
bun run deploy
```

Deployment is intentionally not part of onboarding and requires separate
Cloudflare authentication.

## Architecture

```text
untrusted HTTP source
  -> validated evidence
  -> course decision model
  -> Effect service
  -> Elysia/OpenAPI transport
  -> validated Foldkit client
```

See `docs/product/course-decision-contract.md`,
`docs/adr/012-course-decisions-first.md`, `docs/agent-context/next-slice.md`,
and `AGENTS.md`.

## Compiler policy

TypeScript 7.0.2's native Go compiler is the authoritative checker. The repository also installs the TypeScript 6 compatibility package and runs `tsc6` during full validation so compiler differences are detected immediately. Type environments are declared per package rather than inherited accidentally through a hoisted install.

Bun 1.3.14 is the canonical package manager and command runner. Vite/Rolldown remain responsible for the browser bundle, Vitest remains the test framework, and Wrangler remains responsible for Cloudflare Worker bundling.
