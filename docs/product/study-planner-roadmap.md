# Product roadmap: course decisions first

## Product statement

Help NTNU students discover, understand, shortlist, and compare courses using
trustworthy evidence.

The former programme-first study-planning roadmap is deferred. It remains useful
research and reusable domain code, but it no longer determines delivery order.

## Initial audience and boundary

- Current and prospective NTNU students choosing courses.
- Anonymous and local-first; no account is required.
- NTNU course data plus grades.no and DBH/HK-dir grade evidence.
- Current and recent course offerings rather than complete national history.
- Programme context is optional and comes after course discovery proves useful.

## Student jobs

- Find a course by code, title, or topic.
- Understand what work the course involves.
- Learn how it is assessed and what activity is obligatory.
- Determine whether collaboration, attendance, or location fits my situation.
- Interpret grade outcomes, failure rate, and sample size.
- Save promising courses and compare meaningful differences.
- Know when information is missing, stale, inferred, or conflicting.

## Product surfaces

### Discover

Fast course search with filters for teaching term, campus, level, language,
assessment, collaboration, attendance, and online availability. The empty state
offers useful example searches instead of programme onboarding.

### Understand

An evidence-backed course page covering content, learning outcomes, teaching,
assessment, obligatory activity, collaboration, attendance, prerequisites,
availability, and grade outcomes.

### Shortlist

Local bookmarks, notes, and student-owned preference lenses. Preferences change
ranking and highlighting; they do not rewrite source facts.

### Compare

Compare two to four courses over the same decision dimensions. Missing data stays
unknown rather than silently ranking as favourable.

### Programme context

After the preceding workflows demonstrate repeat use, optionally answer whether
a shortlisted course fits a selected programme or scenario.

## Delivery order

1. Exact-code walking skeleton for one evidence-rich course.
2. Fast NTNU search plus progressive enrichment.
3. Complete evidence-backed course detail.
4. Local bookmarks, notes, and preferences.
5. Course comparison.
6. Optional programme compatibility.

## Architecture budget

- Foldkit owns the new student frontend and explicit UI state transitions.
- Elysia remains a thin validated HTTP boundary.
- Effect is used for real orchestration complexity: parallel sources, typed
  failures, timeouts, retry policy, caching, and partial success.
- Alchemy v2 initially provisions only the Worker and D1 resources used by the
  delivered workflow.
- Search uses upstream data directly. Exact matches, opened courses, bookmarks,
  and comparisons are enriched and cached progressively.

## Deferred

- mandatory programme onboarding;
- roadmap editing and progress tracking;
- Workbench and custom views;
- authentication and cross-device synchronization;
- second-institution support;
- full national replication and evidence archives;
- scheduled ingestion fleets, knowledge graphs, and constraint solvers.

The exploratory [future-pathways note](./future-pathways.md) records how
programme-aware discovery, planning, scheduling, and cross-institution
eligibility could eventually form a constrained study state space. It preserves
the direction without moving those capabilities ahead of the current product
gates.

## Product gates

- An exact course code produces a useful result in one interaction.
- A visitor reaches evidence-backed course detail without configuration.
- Assessment, obligatory work, collaboration, attendance, and grade outcomes are
  either explained or explicitly unknown.
- A source outage does not erase facts available from other sources.
- A student can bookmark and compare courses in under two minutes.
- Real students choose the product over manually opening several source sites.
