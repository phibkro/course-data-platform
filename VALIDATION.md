# Validation report

Validated on 2026-07-22 for the Live Replication & Freshness R3 release candidate.

## Passed

- TypeScript 7.0.2 native compiler across domain, application, study kernel, contracts, database, Workers, web, and root tooling.
- TypeScript 6.0.3 compatibility compiler across the same configurations.
- Oxfmt across the changed R3 source and configuration files.
- Oxlint with warnings denied: 0 warnings and 0 errors.
- Vitest: 36 tests across 13 files covering domain values, source adapters, application use cases, study kernel, D1 reconciliation, API transport, scenario compatibility, freshness failure state, and export/import.
- Runtime-schema OpenAPI generation includes D1-backed `/v1/programmes`, `/v1/compare`, `/v1/data-status`, and planner responses with declared success and error schemas.
- Vite 8 production web build: 393.04 kB / 121.84 kB gzip initial JavaScript, 211.84 kB / 64.36 kB gzip lazy planner chunk, and 56.21 kB / 10.85 kB gzip CSS.
- API Worker Wrangler dry run: 1,652.32 KiB / 310.17 KiB gzip with the D1 binding.
- Ingestion Worker Wrangler dry run: 543.07 KiB / 105.99 KiB gzip with D1, R2, Queue, and cron bindings.
- Source tests verify exact-byte archiving, boundary parsing, unavailable-credit preservation, and provenance for DBH and machine-readable NTNU evidence.
- D1 integration tests verify idempotent reconciliation, official versus administrative relation authority, structured rejection persistence, per-field provenance, and study-kernel round-tripping.
- API tests verify that programme listing, baseline generation, and the default planner projection use the persisted NTNU programme version and fail explicitly when data is unavailable.
- Kernel tests verify baseline generation, movement, removal, elective replacement, structured findings, view-spec validation, and portable round-tripping.
- Scenario tests verify export/import and explicit preservation warnings for saved scenarios whose programme version or data revision is absent from the current catalogue.

## R3 live-capture gate

Ten official NTNU 2026 responses were captured from the machine-readable study-plan endpoint on 2026-07-22 and parsed without rejection: BIT, BPROG, BFY, BLOG, BØAT, BBEV, BERGO, HSGSOB, HSGBVB, and LTARKIV. Each response has six terms; together they contain 280 curriculum course entries. Exact byte lengths and SHA-256 values were observed in the release transcript. Wrangler-emulated D1/R2/Queue bindings accepted the scheduled workflow and preserved explicit stale state through forced upstream failure. Live egress from local `workerd` could not be used because the execution sandbox's TLS interception certificate is not trusted by `workerd`; the approved real Cloudflare deployment is the authoritative live-network gate.

## Product status

The release candidate archives exact NTNU/DBH evidence in R2, atomically publishes normalized curriculum revisions to D1, runs incremental/full/periodic work through Queue and cron, and serves last-valid data with honest per-source freshness. Compare is enforced at ten distinct published programmes in both application and UI. Deployment and public-endpoint evidence are recorded after the required correctness review.

## Bundle observation

The planner executes validation and study-kernel operations in the browser and remains route-split into a lazy chunk. The initial application bundle has grown with the post-arc design-system and data-path work; a later performance slice should profile the current bundle and consider separating pure kernel operations from Effect Schema decoders.
