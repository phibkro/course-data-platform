# R3b deploy — minimal Cloudflare API token (least-privilege)

> Historical note: this document describes the deferred legacy replication
> stack. The active `CourseDecisionProduct` production stack now binds the
> student web Worker to `planner.phibkro.org`. Deploying that active stack
> therefore also requires permission to manage Worker routes/custom domains
> and read the `phibkro.org` zone; the “no Zone scope needed” statements below
> apply only to the older workers.dev-only design.

**Purpose:** the smallest scoped Cloudflare API token that runs the FULL `alchemy deploy alchemy.run.ts`
(Workers ×3 + D1 + R2 + Queues + Static-Assets SPA + live ingestion). Create it so the operator hands over
a least-privilege token, **not** their global key. Derived from the actual `alchemy.run.ts` /
`apps/*/wrangler.jsonc` config + official Cloudflare API-token-permissions docs.

## Copy-pasteable permission set (Create Custom Token — every stock template over-grants)

```
Account · Workers Scripts · Edit
Account · D1 · Edit
Account · Workers R2 Storage · Edit
Account · Queues · Edit
Account · Account Settings · Read
User · User Details · Read
User · Memberships · Read
```

- **Account Resources:** Include → _your specific account_ (not "All accounts").
- **Zone Resources:** none — **no Zone scope needed** (workers.dev only; no custom domain / DNS / routes).
- **TTL:** set "Valid until" bounded to the deploy day (≤24h); delete after — it's one-shot.
- **IP filtering:** pin to the deployer's egress IP if stable (verify the egress IP first — a wrong entry
  silently 403s the whole deploy). If IP is dynamic, lean on the short TTL.

## What each permission covers (only resources `alchemy.run.ts` actually provisions)

| Permission                                             | Covers                                                                                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account · Workers Scripts · Edit                       | deploy all 3 workers **+** secret (`RUN_TOKEN`), cron triggers, observability, SPA static-assets upload, per-script `workers.dev` subdomain — all ride the script-upload API |
| Account · D1 · Edit                                    | create DB + apply migrations `0001..0007` + read/write                                                                                                                       |
| Account · Workers R2 Storage · Edit                    | create the `evidence` bucket + object read/write (the provenance archive)                                                                                                    |
| Account · Queues · Edit                                | create `sync` queue + producer + consumer                                                                                                                                    |
| Account · Account Settings · Read                      | account + `workers.dev` subdomain resolution                                                                                                                                 |
| User · User Details · Read + User · Memberships · Read | non-interactive account resolution by Wrangler/Alchemy                                                                                                                       |

## Required-broad vs droppable

- **Required-broad (no finer split exists):** `Workers Scripts · Edit` — the single group that authorizes
  script upload, secrets, cron, observability config, static-asset sessions, and workers.dev subdomain.
  Everything else in the set is Read-only or a single resource type.
- **Droppable (excluded here on purpose):**
  - `Workers KV Storage` — no KV in this app.
  - `Workers Routes` / any Zone permission — no custom domain/route.
  - `Workers Tail · Read` — only for `wrangler tail`/log streaming, **not** for deploying (observability at
    deploy time doesn't need it). Add `Account · Workers Tail · Read` only if this token must also read logs.

## Notes

- Neither Cloudflare "Edit Cloudflare Workers" template nor the Workers-Builds CI token is a drop-in: both
  carry `Workers KV Storage` + `Workers Routes` (Zone) you don't need, and both **omit D1 and Queues** which
  you do. Hence the custom token above.
- If `alchemy deploy` errors on a specific missing permission, add exactly that group (least-privilege
  iteration) — but this set covers every resource the stack provisions.
- Sources: Cloudflare API-token-permissions reference, token templates, Workers Builds CI token, Workers
  Logs docs (official).

_Deploy remains HELD (operator ruling) until this token + account ID + a `COURSE_DATA_RUN_TOKEN` value are
provided; then the staged `scratchpad/r3b-deploy-and-gate.sh` runs deploy → live-ingest 10 → gate deployed
artifact → hold public exposure for operator sign-off._
