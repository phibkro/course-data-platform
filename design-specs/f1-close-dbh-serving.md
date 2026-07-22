# Design-spec: Close F1 — DBH evidence reconciled into serving (fixtures removable)

**Author:** wE:p1 (lead/advisor). **Builds for:** `course-engineer`. **Status:** frozen when its PR opens.
**Base:** stacked on `216a308` (current `agent/live-replication-r3` HEAD — the banked R3-breadth commit).
**Repo location once committed:** `design-specs/f1-close-dbh-serving.md` (base commit of the stacked branch).
**Supersedes:** `/tmp/course-data-platform-designspec-live-fetch-to-serving.md` (written for the pre-216a308 world; NTNU is now already live-reconciled — this spec targets the _remaining_ DBH gap).

---

## The felt journey (one feature, experienceable end-to-end)

An operator triggers one on-demand replication run **with the committed source fixtures absent**. The
platform fetches DBH live, archives exact bytes in R2, **parses those archived bytes into records, and
reconciles them together with the live NTNU curriculum** into an atomically-published revision. The served
programme endpoints (`/v1/programmes`, `/v1/planner/baseline`) return a programme whose **DBH-sourced**
provenance traces byte-for-byte to that live R2 capture. **Deleting the committed fixtures changes nothing
served.**

## Why this spec exists (the true residual gap after 216a308)

`216a308` banked R3 breadth, but the F1 seam is **still open on the DBH side**:

- `replicateDbhEvidence` (`apps/ingest-worker/src/replicate-dbh.ts:126`) fetches → archives exact bytes to
  `evidence/dbh/table-<id>/sha256/<hash>.json` → **parses** via `parseTable347/208` → then **discards the
  parsed records**, returning only `acceptedCount` (line ~188).
- `processDbh` (`worker.ts`) archives-only and **never reconciles**. `processNtnu` reconciles the live NTNU
  curriculum but passes **`dbhProgrammeRecords: []`, `dbhCourseRecords: []`** (`worker.ts:231-232`).
- The only non-empty DBH reconcile is the **fixture-fed** manual script
  `apps/api-worker/scripts/official-curriculum-input.ts` (imports six fixture JSONs; still wired as
  `ingest:official-curriculum`).

**Net:** served programmes carry NO live DBH provenance; DBH breadth/serving still depends on fixtures.
This spec closes that — DBH records flow from the archived R2 evidence into `reconcile`, and the fixture
`import`s leave the serving path.

## Goal

The served programme's DBH-sourced content is produced by a live `fetch → R2 archive → parse → reconcile →
atomic publish` pipeline, with **zero dependence on committed source-code fixtures** on the serving path.

## Constraints (SPECIFIC on behavior; FREE on mechanism below the line)

- **Reuse, don't duplicate:** existing pure parsers (`parseTable347/208`), the `reconcile` use case, and the
  `dataset_revision → dataset_publication` atomic protocol. Do not weaken them. The reader-isolation
  guarantee (partial imports invisible; last-valid served through failure) **must not regress** — the
  existing concurrency/quality-gate/outage test in `curriculum-ingestion.test.ts` stays green.
- **DBH records assembled from R2-archived evidence, not `import`:** the `ValidatedDbhRecord`s fed to
  `reconcile` must derive from the bytes archived this run (either returned directly from the parse of the
  archived bytes, or re-read from R2 and re-parsed — FREE which). They must NOT come from a committed
  `import ...fixture.json`.
- **DBH + NTNU reconciled together per programme:** a served programme must carry both its live NTNU
  curriculum and its live DBH records in the same published revision (the reconcile no longer runs with
  empty DBH arrays for served programmes). Coordinating the two queue consumers (or fetching DBH within the
  curriculum job, or reading the latest archived DBH evidence at reconcile time) is FREE mechanism.
- **Provenance integrity:** each served programme's DBH `source_record.raw_payload` sha256 **equals** the
  sha256 of an R2 object under `evidence/dbh/table-<id>/sha256/<hash>` written by the run; `observed_at`
  equals the run's `retrievedAt`.
- Network only at the composition root / behind a capability; no `fetch`/clock/random in domain or parser
  packages. No SQL in Elysia handlers. (AGENTS.md.)
- **Idempotent:** re-running identical upstream content yields no duplicate revisions or R2 body objects and
  re-advances the pointer to the same revision.
- **Retire the fixture serving path:** the fixture `import`s in `official-curriculum-input.ts` must leave the
  serving path. Deleting the fixture files must not break serving. (Removing/retiring the manual
  `ingest:official-curriculum` script is fine if nothing served depends on it.)

## Values

Provenance honesty (never serve fixtures dressed as live data) · reuse over parallel mechanism ·
correctness-by-construction: the headline falsifier is **structural** — remove the fixtures, serving still
returns a live DBH-provenanced programme.

---

## Falsifiers / DoD (the journey is experienceable AND every item holds)

1. **Fixture-independence — the headline falsifier.** Rename/remove the committed fixtures
   (`packages/source-dbh/fixtures/*`, `packages/source-ntnu/fixtures/*`) and the fixture `import`s in
   `official-curriculum-input.ts`; trigger a replication run; `GET /v1/programmes` and `/v1/planner/baseline`
   still return a programme carrying **live DBH-sourced** course/programme records. _If serving loses its DBH
   provenance (or breaks) when fixtures are gone, F1 is not closed._
2. **DBH provenance trace.** For the served programme, a DBH `source_record.raw_payload` sha256 == an object
   under `evidence/dbh/table-<id>/sha256/<hash>` written by the run; `observed_at` == the run's `retrievedAt`.
   (Byte-verifiable — recompute the hash; do not trust a summary.)
3. **DBH + NTNU together.** The served programme's published revision contains both its live NTNU curriculum
   and its live DBH records (reconcile is no longer called with empty DBH arrays for served programmes).
4. **Atomic publish preserved.** Publishes through the existing protocol; the concurrency +
   quality-gate-rejection + outage test stays green (readers never see a partial import).
5. **Idempotent.** Two runs of identical content → one revision, one R2 body object per content, stable
   pointer.
6. **One documented trigger.** A single action (curl the replication entrypoint) drives
   fetch→archive→parse→reconcile→publish; the served routes reflect it — **no fixture-fed manual script in
   the loop.**
7. `bun run validate` green; a new/updated test asserts the DBH records reach the served revision from
   archived evidence (the `fetch` seam may be injected with a captured response — that verifies the wiring;
   the _experienceable_ journey in falsifier 1, run against real DBH, is the proof; tests are
   necessary-not-sufficient).

## Out of scope (separate specs — 1:1 discipline)

- F3: `0001` fixture-seed courses leaking via `/v1/courses` (distinct journey: "catalogue is fixture-free").
- F2: hard-zero quality-gate policy (operator decision pending).
- F4: R1 archiving error-response bodies into the table-evidence namespace before the `response.ok` check.
- Retro-fitting design-specs for what 216a308 already delivered (breadth/Compare/Alchemy) — lead will
  backfill those separately so the spec ledger matches the tree.
- Real Cloudflare deploy (gated separately: `/tmp/course-data-r3-deploy-gate.md`).

## PR (1:1 with this spec)

Open the PR only when the e2e journey is experienceable: trigger → live DBH-provenanced served programme,
fixtures removable. **The PR description IS the report** — exact steps to experience it (the curl + the GETs +
the fixture-removal check + the sha256 == R2-object trace) and one line on what's real. Then **stack the next
spec on a new branch; do not block on merge.**
