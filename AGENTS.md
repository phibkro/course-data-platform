# Course Data Platform — agent guide

## Mission

Build a provenance-preserving, multi-institution study-planning platform. The system is a headless kernel with projections for explore, compare, plan, track, and workbench workflows.

## Architecture direction

Dependencies flow inward:

`apps -> infrastructure packages -> application -> domain`

- `packages/domain` contains domain values and invariants. It must not import React, Elysia, Cloudflare, Drizzle, or Alchemy.
- `packages/study-kernel` contains pure, deterministic programme-roadmap operations and structured evaluation findings. It must not import React, Elysia, Cloudflare, Drizzle, or Alchemy.
- `packages/application` contains use cases and capability interfaces expressed with Effect.
- `packages/contracts` contains public HTTP DTOs and mappings. It must not expose database rows.
- `packages/database` implements application capabilities with D1; Drizzle may be introduced behind the repository boundary.
- `apps/api-worker` is the Elysia transport composition root.
- `apps/web` owns URL state, remote query state, and local preferences.
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
- Official curriculum, planned scenarios, and actual progress are separate objects.
- Planner operations receive programme version and data revision explicitly; no hidden current programme or cohort.
- Do not call `fetch`, clocks, randomness, D1, R2, or Cloudflare bindings from domain code.
- Do not put SQL in Elysia handlers.
- Do not use Elysia decorators or global state as the application dependency system.
- Route schemas must declare successful and error responses.
- The first-party client may use Eden, but OpenAPI remains the public contract.
- Generated artifacts are checked in and CI must fail when regeneration changes them.

## Adding a feature

1. Write or refine the domain invariant.
2. Add an application capability/use case.
3. Implement it in an infrastructure package.
4. Map it into an explicit protocol DTO.
5. Add the Elysia route with response schemas.
6. Consume it through Eden in the PWA.
7. Add domain, transport, and browser-level tests as applicable.
