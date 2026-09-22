---
paths:
  - "apps/course-api/**/*"
  - "packages/course-contracts/**/*"
---

# Backend and data

This guidance applies to `apps/course-api` and
`packages/course-contracts`.

Enforced elsewhere, so do not re-derive from prose: domain purity lives in
`.oxlintrc.json`, and dependency direction plus "no SQL in an Elysia module"
live in `tests/architecture.test.ts`.

- Ambient types stay local to each workspace. Do not add globals to the shared
  TypeScript base.
- Source modules parse provider-specific data and map it into the course model.
  Applications never consume unvalidated source responses.
- Pass `fetch`, clocks, and hashing as explicit dependencies.
  `apps/course-api/src/course-decision/live.ts` defines these capabilities.
- Use Effect at orchestration boundaries where typed failure, concurrency,
  retries, timeouts, or dependency composition justify it. Not as a default
  wrapper.
- Elysia handlers are transport adapters. Keep SQL behind repository
  capabilities, and do not use decorators or global mutable state as the
  application dependency system.
- Public routes declare successful and error schemas. The first-party client may
  use Eden, while OpenAPI remains the public contract; `bun run openapi`
  regenerates the checked-in artifact.
- Cache and fetch policy follows observed product demand and source freshness.
  Do not replicate a complete upstream dataset merely because storage exists.
- Tests preserve partial success and every non-known factual state — unknown,
  unavailable, suppressed, stale, failed, and conflicting.
- Constrained property tests own structural parser, evidence, reconciliation,
  cache, and concurrency laws. Captured source fixtures own provider phrase and
  response-shape semantics; neither substitutes for the other.
