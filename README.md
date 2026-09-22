# Course Lens

An evidence-backed NTNU course browser for answering the questions students
actually have before choosing a subject: what it covers, how teaching works,
what work is obligatory, how it is assessed, whether collaboration or
attendance is explicit, and what historical grade outcomes look like.

The active product is a Foldkit web application backed by a small Elysia API.
It fetches NTNU course data and official DBH/HK-dir outcome evidence. It
validates every source at the boundary. It preserves unavailable, suppressed,
inferred, conflicting, and fixture states instead of presenting guesses as facts.

## Active slice

```text
Foldkit web -> TypeBox HTTP contract -> Elysia transport -> Effect service
                                                    -> NTNU search/detail/schedule
                                                    -> DBH grades + exam activity
```

Implemented now:

- a browse-first live NTNU catalogue with code/title search, teaching-term,
  campus, study-level, open-admission, and English-language filters;
- relevance, title, and course-code sorting plus incremental pagination;
- URL-backed catalogue state and a decision-oriented course detail;
- explicit evidence and per-source status for every factual result;
- independent partial success when detail or grade providers fail;
- assessment and collaboration signals on browse cards, enriched only for
  visible or shortlisted courses;
- a local saved list with labelled collections and comparison of two to four
  courses;
- a weekly timetable for saved courses, with URL-backed ISO-week selection,
  dated NTNU activities, source freshness, and named provider limitations;
- ordinary-term, bounded grade aggregation with pass/fail outcomes kept
  separate from ordinal letter grades;
- official DBH exam registrations, attendance, pass, failure, and repeat-pass
  totals with privacy-protected cells kept suppressed;
- a browser-local Progress view imports NTNU or UiO result-history PDFs and shows the original document before parsing;
- students review imported rows, add results, filter history, select calculation rules, and inspect grade and semester trends;
- the view keeps session undo history and offers versioned JSON backup and restore without an account;
- Foldkit loading, success, partial, empty, and error scenes;
- responsive Material You styling with desktop sidebar and mobile bottom bar;
- TypeBox boundary contracts, public OpenAPI, and browser-facing response
  validation;
- TypeScript 7 as the sole compiler authority;
- a minimal, parallel Alchemy v2 stack containing only the course API and
  student web application.

## Commands

```sh
bun install --frozen-lockfile
bun run validate
bun run build
bun run dev
```

Golden student journeys run in real Chromium at phone and desktop widths. They
exercise the fixture-backed PWA plus a deterministic browser-to-HTTP-to-Foldkit
path, and include keyboard and axe checks. The Linux Nix development shell pins
the browser and publishes its executable path to Playwright:

```sh
nix develop --command bun run test:journeys
```

Outside that shell, provide `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` or install the
Playwright-managed browser for the current host.

Pull requests and pushes to `main` run both the validation suite and the golden
journey gate.

The combined development command starts the active product:

- Student web: `http://localhost:5173`
- API service index: `http://localhost:8787`
- OpenAPI UI: `http://localhost:8787/openapi`

There is no database migration or account setup in the active slice. The API
does need outbound access to the public source APIs. `bun run dev:api` and
`VITE_API_URL=http://localhost:8787 bun run dev:web` are available for separate
terminals. Override that origin when needed; use `VITE_USE_FIXTURE=true` only
for explicit offline UI work. If port 8787 is already occupied, choose one
consistent port for the combined stack with `COURSE_API_PORT=8788 bun run dev`.

If the host shell does not expose Node directly but Nix is available,
`bun run dev` automatically re-enters the repository development shell. This
keeps the default onboarding path to one command on the workstation.

Generate the checked-in public API document with:

```sh
bun run openapi
```

## Infrastructure

Alchemy v2 runs from the isolated `infra` workspace and owns production only:
the course API Worker, its source-cache KV namespace, the student web Worker,
and the `planner.phibkro.org` custom domain. The production Worker names live
once in `infra/previews/*.wrangler.json`; the Alchemy composition root imports
those names.

Inspect and deploy the production stack with:

```sh
bun run infra:plan:prod
bun run deploy:prod
```

`deploy:prod` refuses to run unless the checkout is clean, on `main`, and
exactly matches `origin/main`. There are no unsuffixed Alchemy development
deploy commands.

PR deployments use Cloudflare Worker Previews under the two production Workers.
They do not create persistent Workers, Alchemy stages, custom domains, or KV
namespaces. The API Preview is deployed first; the student web Preview is then
built against its stable Preview URL. GitHub Actions updates `pr-<number>` on
each same-repository PR push, comments the web URL, and deletes both Previews
and the comment when the PR closes. Forked PRs never receive deployment
credentials.

The automation is gated by the `PREVIEW_DEPLOYMENTS_ENABLED` repository
variable. After this workflow version is on the default branch, provision its
account-owned credential with a Cloudflare administrator token that may create
account API tokens:

```sh
CLOUDFLARE_ACCOUNT_ID=<account-id> \
CLOUDFLARE_API_TOKEN=<token-manager-token> \
GITHUB_TOKEN="$(gh auth token)" \
  infra/node_modules/.bin/alchemy deploy infra/stacks/github.ts --yes
```

The stack creates an account-scoped CI token granting only `Workers Scripts
Write`, stores it and the account ID as repository secrets, and enables the
workflow. The CI token cannot manage zones or the production custom domain.

For an exceptional manual Preview from a clean, pushed PR branch, run:

```sh
bun run deploy:preview -- 6
```

Preview source links point to the exact deployed commit. Each named Preview has
a stable URL for the latest push and an immutable URL per deployment. Production
continues to serve from `planner.phibkro.org`.

## Architecture

```text
untrusted HTTP source
  -> validated provider module
  -> course-decision model
  -> Effect service
  -> Elysia/OpenAPI transport
  -> neutral TypeBox wire contract
  -> validated Foldkit client
```

See `docs/product/course-decision-contract.md`,
`docs/adr/012-course-decisions-first.md`, `docs/agent-context/next-slice.md`,
and `AGENTS.md`.

## Compiler policy

TypeScript 7.0.2's native Go compiler is the sole checker. Each runtime
workspace declares its own type environment.

Bun 1.3.14 is the package manager and command runner. Vite builds the browser application. Vitest runs tests. Wrangler builds the Cloudflare Worker.

## License and support

Course Data Platform is free software licensed under
[GNU AGPL version 3 only](LICENSE). Network deployments expose a link to the
corresponding source from the student interface.

An optional student support link can be enabled with `VITE_TIP_URL`. It is
shown only when the value is a valid HTTPS URL; no payment provider or account
is assumed by the application.
