# Handoff — course-data-platform LEAD/ADVISOR (wE:p1)

> **Historical handoff — superseded by ADR-012.** The active product is the
> browse-first course decision experience described in `README.md` and
> `docs/agent-context/next-slice.md`. Do not resume this replication epic as
> the default product path.

**Rewritten:** 2026-07-22 by the fresh relaunch-lead, AFTER reconciling the ground with reality.
**Supersedes** the prior handoff (which described a pre-`216a308` world and told you to re-send a now-dead
F1 spec — do NOT do that). **Your role:** LEAD + ADVISOR + operator-interface. You do **not** implement —
you author frozen design-specs, drive `course-engineer`, and gate its output against the real journey on
committed content. Durable memory backs this:
`~/.claude/projects/-srv-share-projects-course-data-platform/memory/course-data-live-replication-epic.md`.

---

## ⚡ IMMEDIATE NEXT ACTION (do this first)

**F1 is DONE (PR #3 accepted). F3 is in flight.** Check whether `course-engineer` has opened the **F3** PR
(`design-specs/f3-catalogue-fixture-free.md`, stacked off F1 tip `0705927`).

```
herdr agent get course-engineer                     # status (needs a 2nd Enter to submit — see §4)
herdr pane read wE:p2 --source visible --lines 20   # ACK / branch / PR?
gh pr list --state open                             # F3 PR up?
```

- **F3 PR open** → run the real-journey gate (§3, adapted): `bun run validate` green on a **clean worktree**
  at the PR tip, then drive `GET /v1/courses` and confirm **zero `source_provider='fixture'`** rows + the
  published-programme courses still appear + removing the `0001` seeds changes nothing served.
- **Still building** → don't idle; author the retro-fit specs for `216a308` (breadth/Compare/Alchemy) so the
  spec ledger matches the tree (§5 step 3).
- **Drifted / composer polluted** → re-bind to the spec FILE (§4).

### F1 outcome (done — do not redo)

PR #3 `agent/f1-close-dbh-serving` tip **`0705927`** (base `216a308`) — **ACCEPTED**. DBH records now
reconciled into serving from archived R2 evidence; fixture serving path retired. Gated on committed content:
`bun run validate` GREEN; drove the REAL journey vs live DBH (347→1 rec, 208→8 recs; served `raw_payload`
sha256 == archived R2 object byte-for-byte). First submission was red (fmt + a no-suite `.test.ts`) → sent
back → fixed in `0705927`, logic byte-identical. **NOT merged** (operator batches the stack; main still
`ac99aae`). Gate worktree: `…/scratchpad/gate-wt`.

---

## 1. Where we actually are (gated on committed content, clean tree)

North star (unchanged): fixtures **fully replaced** by live, provenance-tracked ingestion, served
**publicly** on a real (cost-approved) Cloudflare deploy. Operator-locked: **Compare unlocks at exactly 10
programmes**; **R3 = real external Cloudflare deploy behind an advisor gate**.

**The engineer lost its F1 spec to compaction and free-lanced `216a308`** — a **green but off-spec
2421-line mega-commit** on `agent/live-replication-r3`:

- Bundles F1-partial + R3 breadth (10 programmes via Queue) + Compare projection/UI + freshness API +
  **Alchemy Cloudflare stack definition** — one commit, **no design-spec base, no stacked branch**, jumping
  the operator's R3 HOLD. Violates the on-trial 1:1 discipline.
- ✅ **Green**: `bun run lint` 0, TS7 + TS6 clean, **36/36 tests pass**. **Local-only, unpushed, fully
  reversible.**
- ✅ **Deploy gate INTACT**: `alchemy.run.ts` auto-runs `app.finalize()` but is hard-guarded by
  `COURSE_DATA_RUN_TOKEN` (throws without it); **no `.alchemy` state → no deploy executed.**
- 🔴 **F1 NOT closed** (green ≠ done): `replicateDbhEvidence` (`apps/ingest-worker/src/replicate-dbh.ts:126`)
  parses archived DBH bytes then **discards the records** (returns only `acceptedCount`). `worker.ts`
  `processNtnu` reconciles NTNU with **empty** dbh arrays (`:231-232`); `processDbh` archives-only, never
  reconciles. The only non-empty DBH reconcile is the **fixture-fed** `official-curriculum-input.ts` (six
  fixture `import`s). → served programmes carry **zero live DBH provenance**; fixtures still on the path.

**Operator ruling (this session): BANK `216a308` + forward-fix F1.** Do NOT reset it. Close the real DBH
seam as a follow-up, then retro-fit specs to the tree.

## 2. In-flight NOW — F1-close (DBH evidence → serving; fixtures removable)

**Frozen spec:** `/tmp/course-data-platform-designspec-f1-close-dbh-serving.md` (supersedes the old
live-fetch→serving spec — NTNU is already live-reconciled; this targets the **remaining DBH gap**). The
engineer commits it VERBATIM to **`design-specs/f1-close-dbh-serving.md`** as the base of a stacked branch
**off `216a308`**.

**Essence:** thread the DBH records (derived from the bytes archived this run — return them from the parse,
or re-read+re-parse from R2; FREE which) into `reconcile` **together with** the live NTNU curriculum, per
programme. Reuse `parseTable347/208` + `reconcile` + the `dataset_publication` atomic protocol UNCHANGED
(concurrency/outage test stays green). Retire the fixture `import` path from serving.
**Headline falsifier:** with `packages/*/fixtures/*` removed AND the fixture imports gone, a run + `GET
/v1/programmes` + `/v1/planner/baseline` still return a programme whose DBH `source_record.raw_payload`
sha256 == an R2 object under `evidence/dbh/table-<id>/sha256/<hash>` from that run.

## 3. 🔬 REAL-JOURNEY GATE (when the F1 PR opens — gate committed content on a CLEAN tree, NOT the summary)

1. `git fetch` + checkout the branch on a **clean tree** (`git status` clean; my untracked `docs/handoff.md`
   is the only expected dirt — set it aside if it trips fmt).
2. `bun run validate` green; the concurrency/quality-gate/outage test in `curriculum-ingestion.test.ts`
   still green (atomic publish not regressed).
3. **Drive the real journey:** trigger a replication run (curl the ingest-worker entrypoint), then `GET
/v1/programmes` + `/v1/planner/baseline`.
4. **DBH provenance trace:** served programme's DBH `source_record.raw_payload` sha256 **==** an object under
   `evidence/dbh/table-<id>/sha256/<hash>` from that run; `observed_at` == the run's `retrievedAt`
   (recompute the hash — do not trust a summary).
5. **Headline falsifier:** remove `packages/*/fixtures/*` + the fixture imports in
   `official-curriculum-input.ts`; re-run; serving STILL returns a **live DBH-provenanced** programme. Breaks
   → REJECT, F1 not closed.
6. Accept only when 1–5 observed green on the committed artifact. Then let it stack the next spec — never
   block on merge.

## 4. Engineer coordination (`course-engineer`, codex, wE:p2)

- Address by **name** (`herdr agent send course-engineer …`), never `wX:pY`.
- **Binding = the design-spec FILE, not chat** (new `/srv/share/projects/CLAUDE.md` rule). A chat-only spec
  dies on compaction. If it drifts, re-point it at `design-specs/f1-close-dbh-serving.md`.
- **Composer-pollution recovery** (bit me this session — two `herdr agent send` drafts concatenated):
  `C-c`/`C-u`/`Escape` do NOT clear the codex composer; `herdr pane send-keys wE:p2 Backspace` batched
  (~900/call, ~5 calls for a full draft) clears it → placeholder `› Summarize recent commits` = empty →
  then `herdr agent send` clean text + `herdr pane send-keys wE:p2 Enter`.
- **Do the gating yourself** — I told it NOT to self-run a cross-provider advisor gate (it was mid
  `agent-dispatch --read-only claude` when interrupted). The lead gates F1.

## 5. Ordered next steps

1. Confirm ACK + spec-as-base (⚡ above). Let it build; don't idle.
2. When the F1 PR opens → run the §3 real-journey gate on a clean tree. Accept/reject on the artifact.
3. On accept: **retro-fit design-specs** for what `216a308` already shipped (breadth / Compare / Alchemy
   stack) so the spec ledger matches the tree; then dispatch **F3** (catalogue fixture-free, §6) as the next
   stacked branch. Never block on merge.
4. Then R3 breadth-to-10 (already largely in `216a308` — verify against a proper spec), then the **gated
   deploy** (`/tmp/course-data-r3-deploy-gate.md`; explicit advisor sign-off on the deployed artifact before
   the irreversible public deploy).
5. Surface to the operator only genuinely NEW decisions (F2 below is pending); otherwise self-propel.

## 6. Findings / context NOT recoverable from code or commits

- **F1 (HIGH)** — DBH live fetch not reconciled into serving. _In flight (§2)._
- **F2 (MED, operator decision PENDING)** — quality gate `curriculumRejections === 0` (`curriculum.ts`)
  rejects a whole programme's publication on one malformed row. Brittle for breadth-to-10 (one bad row could
  block the Compare@10 unlock). **Ask operator: one bad row sinks a programme, or publish-with-recorded-
  partial-rejections?** Not yet answered.
- **F3 (LOW-MED)** — `/v1/courses` serves un-snapshotted / `0001` fixture-seed courses ungated
  (`TDT4136`/`TTM4215`/`TDT4258`, `source_provider='fixture'`) via the `NOT EXISTS (snapshot)` UNION arm in
  `createD1CourseRepository`. Next spec after F1: "catalogue is fixture-free" — serve only current-published-
  revision courses; migrate away the seed rows; test asserts zero `source_provider='fixture'` served.
- **F4 (LOW)** — R1 archives error-response bodies into the table-evidence namespace **before** the
  `response.ok` check (`replicate-dbh.ts`); a 5xx/HTML body can land under `evidence/dbh/table-<id>/…`. Fold
  into a later spec.
- **Deploy transport / provenance details** (DBH endpoint, NTNU portlet fragility, exact-byte archival):
  see the durable memory + `216a308` code.
- **Artifacts (survive relaunch):** F1-close spec `/tmp/course-data-platform-designspec-f1-close-dbh-serving.md`;
  R3 deploy gate `/tmp/course-data-r3-deploy-gate.md`; durable memory (above).

---

_Fresh-you: start at ⚡ IMMEDIATE NEXT ACTION. `216a308` is banked — do not reset it._
