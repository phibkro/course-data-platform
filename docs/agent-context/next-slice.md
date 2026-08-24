# Next vertical slice: validation infrastructure

> Contract anchor: [`../product/course-decision-contract.md`](../product/course-decision-contract.md)
> Validation ledger: [`../../../VALIDATION.md`](../../../VALIDATION.md)

## Delivered on main

Assessment signals while browsing, saved lists with labelled collections,
course comparison, and the Effect 4.0 RC migration ARE the delivered state on
`main` (`920854e`, via merged PRs #7, #9, and #12):

- the browse-first catalogue with code/title search, teaching-term, campus,
  study-level, open-admission, and language filters, sorting, incremental
  pagination, and URL-backed state;
- bounded enrichment of visible, opened, or shortlisted courses with semantic
  assessment and collaboration signals, each carrying an explicit Fact state
  (unchecked, loading, checked, known, inferred, conflicting, unavailable,
  failed) and surviving filter changes without attaching evidence to the wrong
  course;
- ordinary-term grade aggregation with pass/fail outcomes kept separate from
  ordinal letter grades, and independent partial success when either provider
  fails;
- a local, account-free saved list with labelled collections and comparison of
  two to four courses across workload, assessment, obligatory work,
  collaboration, attendance, remote feasibility, and grade outcomes;
- Effect 4.0 RC as the runtime foundation.

This file no longer describes those slices as upcoming; their history lives in
git.

## Goal

Learn whether the delivered decision support changes student behaviour before
building anything that presumes it does. Give students a visible way to react
where they decide, and treat evidence of repeat use as the first
product-validation signal.

## Required path

```text
decision screens (course insight, comparison)
  -> contextual feedback prompt/link, reusing the VITE_TIP_URL pattern
  -> a channel the operator actually reads
  -> recorded repeat-use evidence reviewed beside VALIDATION.md
```

Prefer the smallest honest mechanism: a static HTTPS link configured exactly
like the existing `VITE_TIP_URL` support-link variable — shown only when the
value is a valid HTTPS URL — surfaced contextually on decision screens. No
accounts, no survey framework, no new dependencies.

## Scope

1. Render one visible feedback affordance on the course-detail and comparison
   screens, built from existing Foldkit primitives and Material You tokens.
2. Reuse the environment-variable gating pattern: enabled only when the value
   is a valid HTTPS URL, hidden otherwise, documented like `VITE_TIP_URL`.
3. Point the link at a channel the operator reads, and name that channel in
   `VALIDATION.md`.
4. Grow nothing else: no analytics SDKs, no backend storage, no prompts
   disguised as modals.

## Success criteria: evidence of repeat use

The slice succeeds only when there is evidence of repeat use, meaning at least
two of:

1. Returning submitters: the same voluntary identifier (a nickname or reply
   address the student chooses to give) appears in the channel in more than
   one distinct week.
2. Sustained cadence: submissions arrive in at least three different calendar
   weeks after the release week, rather than clustering around launch only.
3. Continued decision journeys: the channel receives descriptions of students
   returning to save, compare, or decide again after having submitted
   feedback earlier.

If, after an honest exposure period, none of these signals appear, that is a
real result: stop expanding decision features and revisit the product premise
instead.

## Immediately after (gated)

Programme compatibility and planning
([`../product/future-pathways.md`](../product/future-pathways.md)) stays
deferred until the repeat-use evidence above exists. This gate follows
ADR-012 (course decisions first) and the ADR-011 design freeze: no planning
machinery may borrow attention before the current promise is validated.

## Still deferred

- programme compatibility and planning, until validation evidence exists;
- authentication and cross-device sync;
- full catalogue replication and scheduled ingestion;
- second-institution support;
- discretionary design-system expansion.

## Design-system constraint

ADR-011 continues to freeze discretionary theme work. Reuse the existing
Material You semantic tokens and Foldkit primitives. The feedback affordance
may add no visual machinery beyond one contextual row per decision screen.
