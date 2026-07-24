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

- a browse-first live NTNU catalogue with code/title search, teaching-term,
  campus, study-level, open-admission, and English-language filters;
- relevance, title, and course-code sorting plus incremental pagination;
- URL-backed catalogue state and a decision-oriented course detail;
- explicit evidence and per-source status for every factual result;
- independent partial success when detail or grade providers fail;
- ordinary-term, bounded grade aggregation with pass/fail outcomes kept
  separate from ordinal letter grades;
- Foldkit loading, success, partial, empty, and error scenes;
- responsive Material You styling with desktop sidebar and mobile bottom bar;
- TypeBox boundary contracts, public OpenAPI, and browser-facing response
  validation;
- TypeScript 7 as the sole compiler authority;
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
for explicit offline UI work. If port 8787 is already occupied, choose one
consistent port for the combined stack with `COURSE_API_PORT=8788 bun run dev`.

If the host shell does not expose Node directly but Nix is available,
`bun run dev` automatically re-enters the repository development shell. This
keeps the default onboarding path to one command on the workstation.

Run the previous platform deliberately with `bun run legacy:dev:platform`.

Generate the checked-in public API document with:

```sh
bun run openapi
```

## Infrastructure

Alchemy v2 uses the new stack ID `CourseDecisionProduct` and new resource IDs,
so it does not adopt, mutate, or destroy the earlier v1-managed resources.
The production student web is bound declaratively to
`https://planner.phibkro.org`; Cloudflare manages its Worker custom-domain
binding and certificate as part of the stack.
Inspect the two-resource change before a first deployment:

```sh
bun run infra:plan:prod
bun run deploy:prod
```

The unsuffixed `infra:plan` and `deploy` commands target Alchemy's per-user
development stage. Production is intentionally separate and requires
Cloudflare authentication. `deploy:prod` refuses to run unless the checkout is
clean, on `main`, and exactly matches `origin/main`; production releases are
explicit even though `main` is the canonical production source.

PR previews use isolated Alchemy stages rather than a long-lived deployment
branch. From a clean, pushed PR branch, deploy PR 6 with:

```sh
bun run deploy:preview -- 6
```

This creates or updates the `pr-6` stage and prints its public `workers.dev`
URL. Preview source links point to the exact deployed commit. The production
custom domain is attached only to the `prod` stage, so previews cannot claim
`planner.phibkro.org`. Destroy the isolated stage after the PR closes:

```sh
bunx alchemy destroy --stage pr-6 alchemy.run.ts
```

Preview deployment is manual until Cloudflare and Alchemy CI credentials are
configured deliberately; opening a PR does not create a failing or
over-privileged GitHub workflow.

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

TypeScript 7.0.2's native Go compiler is the sole checker. Type environments
are declared per package rather than inherited accidentally through a hoisted
install.

Bun 1.3.14 is the canonical package manager and command runner. Vite/Rolldown remain responsible for the browser bundle, Vitest remains the test framework, and Wrangler remains responsible for Cloudflare Worker bundling.

## License and support

Course Data Platform is free software licensed under
[GNU AGPL version 3 only](LICENSE). Network deployments expose a link to the
corresponding source from the student interface.

An optional student support link can be enabled with `VITE_TIP_URL`. It is
shown only when the value is a valid HTTPS URL; no payment provider or account
is assumed by the application.
