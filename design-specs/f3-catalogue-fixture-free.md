# Design-spec: `/v1/courses` catalogue is fixture-free & publication-gated (F3)

**Author:** wE:p1 (lead/advisor). **Builds for:** `course-engineer`. **Status:** frozen when its PR opens.
**Base:** stacked on the F1-close branch (dispatch this only once the F1 PR is open — 1:1 discipline).
**Repo location once committed:** `design-specs/f3-catalogue-fixture-free.md` (base commit of its branch).

---

## The felt journey

Browsing the course catalogue (`GET /v1/courses`) returns only **published, source-provenanced** course
versions — zero fixture-seed rows, zero un-provenanced leaks. **Removing the fixture seeds changes nothing
served.**

## Problem (finding F3)

`createD1CourseRepository` (`packages/database/src/index.ts`) builds a `visible_course_versions` CTE whose
second `UNION ALL` arm includes **every** `course_versions` row with **no**
`dataset_revision_course_version` snapshot (`WHERE NOT EXISTS (… snapshot …)`). So the `0001_initial.sql`
fixture seeds — `TDT4136`, `TTM4215`, `TDT4258`, all `source_provider='fixture'` — and any un-snapshotted
course **bypass the publication gate and are served publicly.** Relative to the "fixture fully replaced"
north star, residual fixture rows leak into the catalogue.

## Goal

`/v1/courses` serves only course versions that belong to the current **published** revision (or an
explicitly provenanced catalogue source) — no un-provenanced passthrough, no fixture seeds.

## Constraints / Values

- Reuse the `dataset_publication` gate already in place; do not invent a parallel visibility mechanism.
- Remove/migrate away the `0001` fixture-seed course rows (`TDT4136`/`TTM4215`/`TDT4258` + fixture
  institution/course rows) — illustrative, not evidence. Prefer a migration that **deletes** them over
  leaving them gated, so the DB has no fixture provenance at all.
- Do not regress published-programme course visibility (published snapshots must still appear).
- Provenance honesty: every served course attributable to a real source. No SQL in handlers (lives in the
  repository — fine).

## Falsifiers / DoD

1. `GET /v1/courses` returns **zero** rows with `source_provider='fixture'`.
2. Removing the `0001` seed inserts (via the cleanup migration) changes nothing served — nothing depended
   on them.
3. A course appears **only** if it is in the current published revision's snapshot (or an explicitly
   provenanced catalogue source); the "NOT EXISTS snapshot" un-provenanced passthrough is gone.
4. No regression: published-programme courses still visible (drive the real `/v1/courses` journey and
   confirm the live-provenanced programme's courses appear).
5. `bun run validate` green; a test asserts (1) and (3).

## Out of scope

- F1 (in flight / just closed); F2 quality-gate policy (operator decision); F4 error-body archive; real
  deploy.

## PR (1:1 with this spec)

Open only when `GET /v1/courses` is fixture-free and published-gated end-to-end. **The PR description IS the
report** — steps to experience it + one line on what's real. Then stack the next spec; do not block on merge.
