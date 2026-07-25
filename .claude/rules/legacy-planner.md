---
paths:
  - "apps/web/**/*"
  - "apps/api-worker/**/*"
  - "apps/ingest-worker/**/*"
  - "packages/domain/**/*"
  - "packages/study-kernel/**/*"
  - "packages/application/**/*"
  - "packages/database/**/*"
  - "packages/source-dbh/**/*"
  - "packages/source-ntnu/**/*"
  - "legacy/**/*"
---

# Legacy planner stack

**Maintain, do not extend.**

This is the programme-planner lineage that predates the course-decision product
(ADR-012). `apps/web` is React with Base UI and a Theme Lab; `apps/api-worker`
and `apps/ingest-worker` are D1-backed Cloudflare workers; the packages here
carry the planner's own domain, kernel, ports, and persistence.

None of it is built or deployed — `scripts/build.sh` and `alchemy.run.ts` cover
only `apps/course-api` and `apps/student-web`. But `bun run lint`,
`bun run check:types`, and `bun run test` all still cover it, so breaking it
blocks CI.

What that means in practice:

- Keep it compiling and passing. Fix it when a shared change breaks it, when a
  dependency bump requires it, or when a real defect is reported.
- Do not add features here, and do not migrate new product work into it.
- Do not treat its patterns as precedent. It layers `database -> application`
  (ports implemented by infrastructure); the course-decision stack has
  `course-service -> source-*` (a coordinator composing adapters). Both are
  inward, but only the current stack defines new contracts.
- Do not delete it in passing. Removing an application is a product decision
  with its own ADR, not cleanup.
- `legacy/ntnu-course-search` is the pre-monorepo vanilla-JS worker and is
  excluded from lint entirely (`ignorePatterns` in `.oxlintrc.json`).

Two edges keep this stack on the current stack's critical path, so changes here
are not as isolated as they look:

- `packages/contracts` depends on `packages/study-kernel`.
- `apps/web` imports `apps/api-worker` directly — an app-on-app edge recorded as
  a known exception in `tests/architecture.test.ts`. Do not add another.

`apps/ingest-worker` holds raw SQL inline rather than behind a repository
capability. That is a real deviation from the backend guidance, contained here
and not to be copied forward.
