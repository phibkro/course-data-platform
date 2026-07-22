# Technical implementation specification

## Decision summary

- Strict TypeScript 7 is the common implementation language; TypeScript 6 is retained as a compatibility oracle during the transition.
- Effect owns application services, typed failure, retries, and dependency composition.
- Elysia owns HTTP transport, runtime request/response validation, OpenAPI, and Eden inference.
- The first-party React PWA consumes the same API through Eden that external consumers can access through OpenAPI.
- Base UI is the default primitive layer; React Aria is reserved for complex collection semantics after a focused comparison spike.
- D1 stores canonical published revisions; R2 preserves immutable, content-addressed source evidence.
- Cloudflare Queues and cron triggers orchestrate NTNU incremental/full scans and DBH periodic checks.
- Alchemy is isolated to infrastructure composition.
- Bun is the package manager and task runner, while Vite/Rolldown and Wrangler remain the target-specific bundlers.

## Current vertical slice

`GET /v1/courses` crosses all architectural boundaries:

1. Elysia validates query parameters.
2. The route invokes an Effect use case.
3. The use case depends on a `CourseRepository` capability.
4. The repository is implemented either in memory or with a typed D1 adapter. Drizzle remains a planned schema/query layer after the Cloudflare runtime spike is stable.
5. Domain objects are mapped to public DTOs.
6. Elysia validates the response and publishes it through OpenAPI.
7. Eden provides the first-party client type used by the PWA.

## Live replication slice

1. Archive exact NTNU and DBH response bytes plus observation manifests in R2.
2. Parse untrusted responses at the source boundary, preserving unavailable factual values.
3. Build a candidate revision and atomically advance a D1 publication pointer only after quality validation.
4. Run NTNU incrementally every 15 minutes with overlap, reconcile fully nightly, and check DBH daily.
5. Serve the last valid revision through outages while recording an explicit stale source state.
6. Unlock Compare only when ten distinct programme identities are published.
