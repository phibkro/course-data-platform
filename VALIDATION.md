# Validation report

Validated on 2026-07-20 after adding programme-first onboarding, editable local scenarios, and declarative Workbench views.

## Passed

- TypeScript 7.0.2 native compiler across domain, application, study kernel, contracts, database, Workers, web, and root tooling.
- TypeScript 6.0.3 compatibility compiler across the same configurations.
- Oxfmt across 71 files.
- Oxlint with warnings denied: 0 warnings and 0 errors across 26 source files.
- Vitest: 17 tests across domain, application, study kernel, scenario export, and API transport.
- Runtime-schema OpenAPI generation includes `/v1/programmes`, `/v1/planner/baseline`, and `/v1/planner/demo`.
- Vite 8 production web build: 237.69 kB / 74.75 kB gzip initial JavaScript, 210.15 kB / 63.92 kB gzip lazy planner chunk, and 9.64 kB / 2.65 kB gzip CSS.
- API Worker Wrangler dry run: 1,592.47 KiB / 302.01 KiB gzip with the D1 binding.
- Ingestion Worker Wrangler dry run: 0.30 KiB / 0.22 KiB gzip.
- API tests verify programme onboarding metadata, selected-programme baseline generation, schema-versioned scenarios, and the declarative roadmap view.
- Kernel tests verify baseline generation, movement, removal, elective replacement, structured findings, view-spec validation, and portable round-tripping.
- Scenario export tests reject unrelated JSON and round-trip valid planning envelopes.

## Product status

The programme is still an explicitly marked illustrative fixture and not an official NTNU curriculum. The interaction model is now functional: users can choose a programme, edit and evaluate multiple scenarios, persist them in IndexedDB, import/export them, and inspect the complete kernel projection in Workbench.

## Bundle observation

The planner executes the validation and study kernel in the browser, but it is route-split into a lazy chunk. The Explore projection remains close to the previous initial bundle size. A later performance slice should still consider separating pure kernel operations from Effect Schema decoders to reduce the planner chunk itself.
