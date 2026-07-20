# Technical implementation specification

## Decision summary

- Strict TypeScript 7 is the common implementation language; TypeScript 6 is retained as a compatibility oracle during the transition.
- Effect owns application services, typed failure, retries, and dependency composition.
- Elysia owns HTTP transport, runtime request/response validation, OpenAPI, and Eden inference.
- The first-party React PWA consumes the same API through Eden that external consumers can access through OpenAPI.
- Base UI is the default primitive layer; React Aria is reserved for complex collection semantics after a focused comparison spike.
- D1 stores canonical normalized records; R2 will preserve immutable source evidence.
- Queues and Workflows will orchestrate ingestion once source adapters are introduced.
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

## Near-term sequence

1. Prove Elysia under `workerd` with D1 bindings and response validation.
2. Add immutable raw-source storage in R2.
3. Implement the DBH source adapter against frozen fixtures.
4. Replace fixture records with normalized DBH records.
5. Port the useful interface behavior from `legacy/` into the new PWA.
6. Add a second institution adapter before stabilising the adapter contract.
