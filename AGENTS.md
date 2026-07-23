# Course Data Platform — agent guide

## Mission

Help NTNU students discover, understand, shortlist, and compare courses using
trustworthy evidence.

The current release is an anonymous, local-first NTNU course-decision product.
Multi-institution study planning remains a possible later direction, not the
current product scope. A vertical slice is successful only when it adds a
student-visible capability in the browser.

## Current product scope

- Search NTNU courses without selecting a programme.
- Explain course content, teaching, assessment, obligatory activity,
  collaboration, attendance, prerequisites, availability, and grade outcomes.
- Attribute facts to sources and preserve unknown, unavailable, suppressed, and
  conflicting states.
- Let students bookmark, annotate, filter, and compare courses locally without
  an account.
- Enrich exact matches, opened courses, bookmarks, and comparisons on demand;
  cache based on observed use rather than replicating the full catalogue first.

Deferred until the course-decision workflow demonstrates repeat use:

- programme roadmap editing and progress tracking;
- Workbench and custom projections;
- authentication and account synchronization;
- second-institution adapters;
- full national replication, knowledge graphs, and constraint solving.

## Architecture direction

Dependencies flow inward:

`apps -> infrastructure packages -> application -> domain`

- `packages/course-model` is the intended home for course facts, evidence,
  uncertainty, and pure derived classifications. It must not import a UI or
  runtime framework.
- Source packages parse provider-specific responses and map them into the course
  model. They do not expose unvalidated source data to applications.
- `packages/course-service` orchestrates sources, partial success, caching,
  retries, and timeouts with Effect when that complexity is present.
- `packages/contracts` contains public HTTP DTOs and mappings. It must not expose database rows.
- `apps/course-api` is the intended thin Elysia transport composition root.
- `apps/student-web` is the intended Foldkit application. Its model owns URL
  state, explicit remote-data state, and local preferences.
- Existing planner packages and applications are maintained while the new
  walking skeleton is built, but they do not determine new product contracts.
- `infra` is represented by `alchemy.run.ts`; no package outside the composition roots imports Alchemy.

## Canonical commands

- `bun install --frozen-lockfile`
- `bun run check`
- `bun run check:types` — authoritative TypeScript 7 check
- `bun run check:types:ts6` — TypeScript 6 compatibility check
- `bun run check:types:compat` — both compilers
- `bun run test`
- `bun run build`
- `bun run validate`
- `bun run dev:web`
- `bun run dev:api`
- `bun run openapi`

## Non-negotiable rules

- Bun is the package manager and runner; do not add a second root lockfile.
- TypeScript 7 is authoritative, while TypeScript 6 compatibility must remain green.
- Each package declares its own ambient type context; do not repair missing declarations by adding globals to the shared base config.
- Parse all untrusted data at the boundary.
- Preserve unknown, unavailable, suppressed, and conflicting states; do not collapse them to zero or false.
- Every public factual field and relation must be attributable to a source or explicitly marked as a fixture/inference.
- Derived labels such as `remote-friendly` or `project-heavy` must expose their
  evidence and uncertainty; they are not source facts.
- A source failure must not erase independently available course information.
- Do not pre-provision infrastructure for a deferred capability.
- Official curriculum, planned scenarios, and actual progress are separate objects.
- Planner operations receive programme version and data revision explicitly; no hidden current programme or cohort.
- Do not call `fetch`, clocks, randomness, D1, R2, or Cloudflare bindings from domain code.
- Do not put SQL in Elysia handlers.
- Do not use Elysia decorators or global state as the application dependency system.
- Route schemas must declare successful and error responses.
- The first-party client may use Eden, but OpenAPI remains the public contract.
- Generated artifacts are checked in and CI must fail when regeneration changes them.

## Web interface boundaries

- Foldkit is the frontend architecture for the new student application. Do not
  introduce React components into its interaction tree.
- Use the shadcn source-ownership philosophy, not React shadcn components.
  Interactive primitives are implemented with Foldkit's accessible UI
  facilities and styled with repository-owned Material You semantic tokens.
- Build a component only when a live workflow requires it. Do not restart a
  general design-system or theme-lab programme.
- Explore is the default public experience. It must be useful without programme
  context, onboarding, an account, or pre-existing local state.
- Mobile primary navigation is a bottom bar; desktop primary navigation is a sidebar. Do not add another equally prominent top-level tab strip.
- One primitive owns each overlay or collection interaction. Do not mix
  Foldkit UI with a second focus or collection system inside the same tree.
- Appearance is expressed through semantic tokens. The default is Mist + Emerald + Indigo; do not add direct palette values to product components.
- ADR-011 freezes discretionary design-system work. Continue visual work only for accessibility defects or concrete functional blockers.

## Adding a feature

1. Name the student decision or task that improves.
2. Define the observable browser acceptance criterion.
3. Write or refine the course fact, evidence, or domain invariant.
4. Add source/application behavior only as required by that task.
5. Map it into an explicit protocol DTO.
6. Add the thin Elysia route with successful and error response schemas.
7. Consume it through an explicit Foldkit message and model transition.
8. Add source-fixture, domain, transport, Foldkit Story/Scene, and browser tests
   in proportion to the slice.
