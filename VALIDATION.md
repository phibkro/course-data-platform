# Validation report

Validated in the build environment on 2026-07-20.

## Passed

The fast validation suite and production builds are separate commands so failures remain easy to localize:

- `bun run validate`
- `bun run build`

- Oxfmt formatting check
- Oxlint with warnings denied
- native TypeScript 7.0.2 checks across explicit package contexts
- TypeScript 6 compatibility checks across the same contexts
- domain, application, and Elysia transport tests
- API Worker Wrangler dry-run build
- ingestion Worker Wrangler dry-run build
- React/Vite production build
- OpenAPI generation from Elysia runtime schemas
- local D1 migration from an empty database
- local API smoke request through Wrangler/workerd
- local web-server smoke request
- Bun isolated-lockfile portability audit: no private registry, local `/tmp`, or `file:` dependencies

## Deliberately deferred

- DBH network ingestion and reconciliation
- R2 evidence archive
- Queue and Workflow execution
- Base UI / React Aria component spike
- Playwright browser suite
- Alchemy package compilation and deployment
- temporary public deployment

Alchemy is pinned in `infra/versions.json`, but it is not included in the default dependency installation until its provider graph can be installed and validated reliably in the execution environment.

## Compiler comparison

Measured in this build environment over the eight package/tooling configurations:

- TypeScript 7.0.2: 3.55 seconds, 265,644 KB peak RSS
- TypeScript 6 compatibility compiler: 10.71 seconds, 452,612 KB peak RSS

Both produced zero diagnostics. These figures are directional rather than a general benchmark; the repository is still small.

## macOS development hotfix

The July 20 follow-up fixes a Bash 3.2 portability bug in the TypeScript 6 compatibility lane, adds a discoverable API root and health route, and provides a combined `bun run dev` command that starts the API and PWA together. Pending local D1 migrations are applied before Wrangler starts.

The original full validation and production builds passed on the preceding source revision. The hotfix was additionally checked with Bash syntax validation and JSON parsing in the packaging environment; the reporter's macOS run had already confirmed the unchanged TypeScript 7, test, Vite, and Wrangler build paths.

## Development service-worker regression fix

Validated after reproducing the Firefox failure caused by an older development service worker caching Vite module URLs from a previous checkout:

- service-worker registration is production-only;
- development startup unregisters prior Course Data Platform workers and removes their caches;
- the production worker ignores cross-origin requests, including the local API Worker;
- unavailable same-origin API requests return an explicit 503 Problem Details response rather than `Response.error()`;
- local API CORS is covered by a regression test for `http://localhost:5173`;
- TypeScript 7, TypeScript 6 compatibility, Oxlint, Oxfmt, Vitest, Vite, and both Worker dry-run builds pass.
