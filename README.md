# Course Data Platform

A multi-institution, provenance-preserving study-planning platform. The system is built as a headless kernel with curated projections for course exploration, programme roadmaps, comparison, progress tracking, and full data inspection. The earlier NTNU course-search prototype is retained in `legacy/` while the platform is rebuilt as explicit vertical slices.

## Current vertical slices

The catalogue slice proves one complete request path:

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
- a pure study-planning kernel with programme requirements, baseline roadmaps, scenario operations, credit calculations, and structured findings;
- programme-first onboarding backed by a versioned programme catalogue contract;
- editable planning scenarios with move, remove, restore, elective replacement, clone, rename, import, and export operations;
- IndexedDB-backed local scenario and programme-context persistence;
- a validated declarative Workbench view specification served with each planner projection;
- the previous prototype preserved under `legacy/` for behavioral reference;
- a persistent Theme Lab with Mist/Emerald/Indigo as the default and independent schedule/chart palettes.

Not implemented in this slice:

- live DBH or institution ingestion;
- immutable R2 source archiving;
- React Aria collection components beyond the current Base UI foundation;
- optional account synchronization for preferences and scenarios;
- official programme ingestion replacing the explicitly marked fixture;
- semantic course relations or the deferred knowledge graph;
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

## Interface foundation

The web application uses shadcn-style source-owned components backed by Base UI, Tailwind CSS 4, Material 3 semantic tokens, and a semantic Phosphor icon layer. Material Symbols load lazily only when a Phosphor fallback is required. Explore is the default public catalogue. Desktop uses a sidebar; mobile uses bottom navigation for Explore, Plan, and Saved. Workbench and data status are secondary advanced surfaces.

Use `bun run ui:info` to inspect the shadcn configuration, `bun run ui:add -- <component>` to add a source-owned component, and `bun run ui:diff` to review registry drift before accepting generated updates.

Open **Appearance** in the app shell to use the live Theme Lab. Theme preferences are validated, stored locally, and exportable as JSON. The checked-in product default is Mist surfaces, an Emerald theme, and an Indigo chart palette.

Developer preset commands:

```sh
bun run theme:resolve
bun run theme:decode -- <preset-code>
bun run theme:open -- <preset-code>
bun run theme:apply -- <preset-code>
```

`theme:apply` uses shadcn's theme-only preset application. Review the source diff before committing. ADR-011 freezes further design-system expansion unless accessibility or a functional requirement exposes a concrete gap.

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

See `docs/architecture/technical-implementation.md`, `docs/architecture/study-planning-kernel.md`, `docs/architecture/workbench-views.md`, `docs/architecture/local-planning-state.md`, `docs/product/study-planner-roadmap.md`, `docs/agent-context/next-slice.md`, `AGENTS.md`, and `docs/adr/`.

## Compiler policy

TypeScript 7.0.2's native Go compiler is the authoritative checker. The repository also installs the TypeScript 6 compatibility package and runs `tsc6` during full validation so compiler differences are detected immediately. Type environments are declared per package rather than inherited accidentally through a hoisted install.

Bun 1.3.14 is the canonical package manager and command runner. Vite/Rolldown remain responsible for the browser bundle, Vitest remains the test framework, and Wrangler remains responsible for Cloudflare Worker bundling.
