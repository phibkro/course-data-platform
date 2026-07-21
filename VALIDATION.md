# Validation report

Validated on 2026-07-20 after introducing the study-planning kernel and the first Plan/Workbench projections.

## Passed

- TypeScript 7.0.2 native compiler across domain, application, study kernel, contracts, database, Workers, web, and root tooling.
- TypeScript 6.0.3 compatibility compiler across the same configurations.
- Oxfmt check across 69 files.
- Oxlint with warnings denied: 0 warnings and 0 errors across 24 source files.
- Vitest: 11 tests across domain, application, study kernel, and API transport.
- Runtime-schema OpenAPI generation includes `/v1/planner/demo`.
- Vite 8 production web build: 239.46 kB JavaScript / 75.03 kB gzip and 6.19 kB CSS / 1.94 kB gzip.
- API contract test verifies the illustrative six-term roadmap and structured evaluation result.
- Kernel tests verify baseline generation, course movement, missing-requirement findings, and portable scenario round-tripping.

## Not repeated in this environment

Wrangler dry-run builds were not repeated because the fallback npm installation available in this sandbox did not reproduce Bun's complete isolated dependency graph for Wrangler. The Worker source and contracts passed both compiler lanes and the Elysia transport tests. Run the authoritative repository commands under the pinned Bun/Nix environment:

```sh
bun install --frozen-lockfile
bun run validate
bun run build
```

## Product status

The Plan and Workbench screens are intentionally driven by an illustrative fixture, not an official NTNU curriculum. The next slice replaces the fixture with one evidence-backed programme version and adds editable, locally persisted scenarios.
