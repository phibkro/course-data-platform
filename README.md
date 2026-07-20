# Course Data Platform

A multi-institution, provenance-preserving course catalogue and public data API. The earlier NTNU course-search prototype is retained in `legacy/` while the platform is rebuilt as explicit vertical slices.

## First vertical slice

The current slice proves one complete request path:

```text
React PWA -> Eden client -> Elysia contract -> Effect use case -> repository -> D1
```

Implemented now:

- strict TypeScript monorepo boundaries;
- Effect domain values, capabilities, typed repository failure, and runtime composition;
- Elysia request and response validation;
- runtime-generated OpenAPI and an Eden first-party client;
- a D1 repository implementation and reviewed SQL migration;
- Cloudflare API and ingestion Worker entry points;
- React PWA shell with URL-owned search state and an explicit service worker;
- Bun 1.3, native TypeScript 7, TS6 compatibility checking, Oxlint, Oxfmt, Vite 8, Vitest, and Wrangler validation;
- Alchemy infrastructure composition kept isolated in `alchemy.run.ts`;
- the previous prototype preserved under `legacy/` for behavioral reference.

Not implemented in this slice:

- live DBH or institution ingestion;
- immutable R2 source archiving;
- Base UI / React Aria production components;
- user preference persistence;
- semantic course relations;
- a verified Alchemy deployment.

## Commands

```sh
bun install --frozen-lockfile
bun run validate
bun run build
bun run dev
```

The combined development command starts both services:

- PWA: `http://localhost:5173`
- API service index: `http://localhost:8787`
- OpenAPI UI: `http://localhost:8787/openapi`

`bun run dev:api` and `bun run dev:web` remain available when separate terminals are preferable. The API command applies pending local D1 migrations before starting Wrangler. Override the web app's API origin with `VITE_API_URL`.

The service worker is registered only in production builds. Development startup removes earlier Course Data Platform service workers and caches so Vite modules and HMR connections are never served from stale PWA caches. After upgrading from an older checkout that registered the service worker during development, one browser reload may be required while the old worker is removed.

Generate the checked-in public API document with:

```sh
bun run openapi
```

## Architecture

```text
untrusted source
  -> validated evidence
  -> temporal domain model
  -> Effect application use cases
  -> Elysia/OpenAPI transport
  -> Eden first-party client
  -> independent preference lens
```

See `docs/architecture/technical-implementation.md`, `docs/agent-context/next-slice.md`, `AGENTS.md`, and `docs/adr/`.

## Compiler policy

TypeScript 7.0.2's native Go compiler is the authoritative checker. The repository also installs the TypeScript 6 compatibility package and runs `tsc6` during full validation so compiler differences are detected immediately. Type environments are declared per package rather than inherited accidentally through a hoisted install.

Bun 1.3.14 is the canonical package manager and command runner. Vite/Rolldown remain responsible for the browser bundle, Vitest remains the test framework, and Wrangler remains responsible for Cloudflare Worker bundling.
