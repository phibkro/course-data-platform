# Validation report

Validated on 2026-07-22 after completing the provenance ingestion, NTNU curriculum reconciliation, and persisted-serving arc.

## Passed

- TypeScript 7.0.2 native compiler across domain, application, study kernel, contracts, database, Workers, web, and root tooling.
- TypeScript 6.0.3 compatibility compiler across the same configurations.
- Oxfmt across 115 files.
- Oxlint with warnings denied: 0 warnings and 0 errors.
- Vitest: 31 tests across 11 files covering domain values, source adapters, application use cases, study kernel, D1 reconciliation, API transport, scenario compatibility, and export/import.
- Runtime-schema OpenAPI generation includes D1-backed `/v1/programmes`, `/v1/planner/baseline`, and `/v1/planner/demo` responses with freshness metadata, capability warnings, and declared error responses.
- Vite 8 production web build: 385.01 kB / 119.92 kB gzip initial JavaScript, 211.84 kB / 64.36 kB gzip lazy planner chunk, and 56.13 kB / 10.83 kB gzip CSS.
- API Worker Wrangler dry run: 1,636.09 KiB / 308.23 KiB gzip with the D1 binding.
- Ingestion Worker Wrangler dry run: 0.30 KiB / 0.22 KiB gzip.
- Source tests verify boundary parsing and provenance for real-captured DBH and machine-readable NTNU evidence.
- D1 integration tests verify idempotent reconciliation, official versus administrative relation authority, structured rejection persistence, per-field provenance, and study-kernel round-tripping.
- API tests verify that programme listing, baseline generation, and the default planner projection use the persisted NTNU programme version and fail explicitly when data is unavailable.
- Kernel tests verify baseline generation, movement, removal, elective replacement, structured findings, view-spec validation, and portable round-tripping.
- Scenario tests verify export/import and explicit preservation warnings for saved scenarios whose programme version or data revision is absent from the current catalogue.

## Product status

The served planner now reads an evidence-backed NTNU BIT 2024 programme version from D1. Its official six-term curriculum came from a real machine-readable NTNU study-plan capture, while DBH course-to-programme associations remain distinguishable as administrative authority. Users can choose the programme, edit and evaluate multiple scenarios, persist them in IndexedDB, import/export them, and inspect the complete persisted projection in Workbench. Freshness metadata is real for the captured revision, but population remains a manual local reconcile: live upstream fetching, immutable R2 evidence archiving, atomic candidate publication, and scheduled orchestration are not implemented yet.

## Bundle observation

The planner executes validation and study-kernel operations in the browser and remains route-split into a lazy chunk. The initial application bundle has grown with the post-arc design-system and data-path work; a later performance slice should profile the current bundle and consider separating pure kernel operations from Effect Schema decoders.
