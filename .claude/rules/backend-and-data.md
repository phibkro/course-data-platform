---
paths:
  - "apps/course-api/**/*"
  - "packages/**/*"
---

# Backend and data

Scoped to the **course-decision stack**: `apps/course-api` and the
`course-model` / `source-ntnu-course` / `source-grades` / `course-service` /
`contracts` packages. The legacy planner packages under `packages/` share this
path glob but not this guidance — see
[`legacy-planner.md`](legacy-planner.md) before editing them.

Enforced elsewhere, so do not re-derive from prose: domain purity lives in
`.oxlintrc.json`, and dependency direction plus "no SQL in an Elysia module"
live in `tests/architecture.test.ts`.

- Package ambient types stay local to each package; do not repair them by adding
  globals to the shared TypeScript base.
- Source packages parse provider-specific data and map it into the course model.
  Applications never consume unvalidated source responses.
- Capabilities that domain code cannot own — `fetch`, the clock, hashing — are
  passed as explicit dependencies. `LiveCourseDecisionDependencies` in
  `packages/course-service/src/live.ts` is the shape to follow.
- Use Effect at orchestration boundaries where typed failure, concurrency,
  retries, timeouts, or dependency composition justify it. Not as a default
  wrapper.
- Elysia handlers are transport adapters. Keep SQL behind repository
  capabilities, and do not use decorators or global mutable state as the
  application dependency system.
- Public routes declare successful and error schemas. The first-party client may
  use Eden, while OpenAPI remains the public contract; `bun run openapi`
  regenerates the checked-in artifact.
- Cache and ingest policy follows observed product demand and source freshness.
  Do not replicate a complete upstream dataset merely because storage exists.
- Tests preserve partial success and every non-known factual state — unknown,
  unavailable, suppressed, stale, failed, and conflicting.
