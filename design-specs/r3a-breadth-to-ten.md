# Design-spec: R3a — breadth-to-ten live journey unlocks Compare@10 (pre-deploy proof)

> **Historical design spec — superseded by ADR-012.** Retain this as platform
> context; it is not the active product backlog.

**Author:** wE:p1 (lead/advisor). **Builds for:** `course-engineer`. **Status:** frozen when its PR opens.
**Base:** stacked on the F3 tip `e64e427` (`agent/f3-catalogue-fixture-free`).
**Repo location once committed:** `design-specs/r3a-breadth-to-ten.md` (base commit of the stacked branch).

---

## The felt journey

One replication run ingests **all ten** `NTNU_PROGRAMMES` from live sources (NTNU curriculum + DBH tables
347/208), reconciles + atomically publishes each, and the served platform then shows **ten published,
live-provenanced programmes** — at which point **Compare@10 unlocks** (`GET /v1/programmes` `meta.compareEnabled
= true`, `programmeCount = 10`) and `compareProgrammes` returns a real comparison instead of
`CompareUnavailableError`. Below ten published, Compare stays locked.

## Why (the remaining pre-deploy proof)

F1 (live DBH→serving) and F3 (fixture-free catalogue) are closed; Compare@10 already counts **published**
scopes (`listProgrammeVersions` JOINs `dataset_publication.current_revision_id`). What is NOT yet proven end
to end: that a **live** run actually yields **ten published** programmes and flips the unlock. This is deploy
gate #3 (Compare@10) + the breadth half of the north star, proven locally before the irreversible deploy.

## Goal

A single documented live run publishes ten programmes; the served endpoints reflect ten published,
fixture-free, live-provenanced programmes; Compare unlocks at exactly ten (9 → locked, 10 → unlocked).

## Constraints (SPECIFIC on behavior; FREE on mechanism)

- Reuse the existing Queue pipeline (`worker.ts`), parsers, `reconcile`, and the `dataset_publication`
  atomic protocol UNCHANGED. No new visibility mechanism.
- Real sources: the run fetches NTNU + DBH **live** (fail loud on unreachable/shape-mismatch — a mock is a
  green-stub failure for this proof). Local D1 + R2 (wrangler/Miniflare) is fine; no external Cloudflare.
- **Do NOT weaken or work around the quality gate** (`curriculumRejections === 0`) to force a publish. If a
  programme is rejected, let it be rejected and **report it** (see DoD #4) — the F2 policy is the operator's
  call, not a silent edit here.
- Compare@10 must remain gated on **published** count (unchanged). 9 published → locked; 10 → unlocked.
- No `fetch`/clock/random in domain/parsers; no SQL in handlers; `bun run validate` green.

## Falsifiers / DoD

1. **Ten published, live.** After one live run, `GET /v1/programmes` returns `meta.programmeCount = 10`,
   `meta.compareEnabled = true`; each of the ten carries live DBH + NTNU provenance (a served
   `source_record.raw_payload` sha256 == an R2 `evidence/dbh/table-<id>/sha256/<hash>` object from the run).
2. **Compare unlocks at exactly ten.** With 9 published → `compareProgrammes` fails `CompareUnavailableError`
   / UI locked; with 10 → returns a comparison. (A test may drive both sides deterministically.)
3. **Fixture-free at breadth.** With the ten published, `GET /v1/courses` and `/v1/programmes` return **zero**
   `source_provider='fixture'` rows (F3 holds at breadth).
4. **Rejection report (F2 evidence — REQUIRED even if empty).** The run reports, per programme, publish
   success vs rejection and the rejection reason/count (curriculum + DBH). This tells the operator whether the
   hard-zero gate actually blocks any of the ten real programmes. Surface it (log / PR body / a small report
   artifact) — do not hide a partial outcome.
5. **One documented trigger + `bun run validate` green.** A single action drives the ten-programme run; a test
   proves the unlock boundary (9 vs 10). The live run (real network) is the experiential proof; tests are
   necessary-not-sufficient.

## Out of scope (separate specs — 1:1)

- **R3b: the real Cloudflare deploy** — operator-gated (cost-approved + advisor sign-off on the deployed
  artifact; deploy gates 4/5/6 = idempotency/rollback/credentials on the REAL remote). Do NOT deploy.
- **F2 policy change** (strict vs publish-with-partial-rejections) — operator decision; this spec only
  _measures_ the impact, it does not change the gate.
- F4 error-body archive namespace.

## PR (1:1 with this spec)

Open when the ten-programme live journey is experienceable and Compare unlocks. **The PR description IS the
report** — the exact trigger + the two GETs + the 9-vs-10 unlock demonstration + the per-programme rejection
report (DoD #4) + one line on what's real. Then stack the next spec; do not block on merge.
