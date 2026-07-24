# Student experience contract

- Status: Active product and interaction contract
- Date: 2026-07-24
- Active value loop: `Explore -> Inspect -> List -> Compare`

## Purpose

Uni Planner reduces the number of facts and constraints a student must collect
and reconcile manually. It does not expose the source systems as a generic
database browser.

The application remains useful without an account, programme selection, or a
complete plan. Programme and planning context progressively improve relevance;
they are not onboarding requirements.

## Surface vocabulary

- **Explore** finds plausible courses and explains why they may be relevant.
- **Inspect** is the history-tracked course detail opened from Explore or List.
  It is not a top-level destination.
- **List** owns saved courses, notes, and the two-to-four-course Compare mode.
- **Schedule** will test saved or planned courses against offering and timetable
  constraints.
- **Degree** will show programme progress, requirements, and future paths.
- **More** owns preferences, language, provenance, data status, licensing, and
  optional project support.

Schedule and Degree may appear as reserved destinations, but they do not become
interactive product surfaces until their data-readiness gates are met.

## Shared concepts

Every surface consumes the same explicit concepts:

- `CourseIdentity`: stable institution/course key, code, and localized title;
- `OfferingContext`: requested academic period, campuses, availability, and
  teaching language;
- `Fact<T>`: known, unknown, unavailable, suppressed, or conflicting, with
  evidence;
- `DecisionProfile`: assessment, obligatory activity, collaboration,
  attendance, remote participation, and work-form evidence;
- `OutcomeSummary`: distribution, failure rate, sample, observed period, and
  provenance;
- `SavedCourseState`: bookmark, note, and comparison selection owned by the
  student;
- `ProgrammeContext`: optional programme version/cohort and authoritative or
  inferred required, elective, recommended, and permitted relations;
- `PlanningContext`: student-owned term placement and structured findings,
  separate from official curriculum and actual progress.

Unknown is neutral. It must never rank as favourable or be encoded as zero,
false, or an empty collection.

## Stable course summary

Course summaries preserve the same regions and field order across list, grid,
mobile, and desktop projections.

### Identity and offering

- course code and title;
- credits;
- requested or inferred teaching period;
- campus;
- optional programme relationship when context exists.

These facts come from the fast catalogue path and do not wait for enrichment.
Missing values retain their slot and show a precise state such as `Unknown`,
`Not published`, or `Conflicting`.

### Decision profile

- assessment;
- obligatory activity;
- collaboration;
- later: attendance and remote-participation evidence.

Routine facts use stable labeled rows. Pills are reserved for compact,
multi-valued categories or exceptional signals. Icons supplement visible prose
and accessible names; they never replace them.

### Uni Planner insight

Cross-source outcomes and unusual evidence-backed constraints are visually
distinct from commodity catalogue metadata. Historical outcomes retain the
distribution, failure rate, sample size, covered period, and HK-dir attribution
when known.

The whole summary has one Inspect target. Bookmark and source links are explicit
higher-priority controls and must not be hidden inside the whole-card target.

## Progressive refinement

The always-visible Explore controls are:

- course search;
- campus;
- optional programme lens when implemented;
- active-refinement summary and Refine action.

The teaching period is inferred from the current Explore or Planning context and
shown on results. Its manual override lives in Refine.

Refine presents sections in student-decision order:

1. **Fits my studies** — required, elective, recommended, or permitted after
   programme data exists;
2. **Practical fit** — campus, language, online/attendance, and open admission;
3. **Work and assessment** — assessment form, obligatory activity, and
   collaboration;
4. **Catalogue metadata** — level, explicit period override, and administrative
   fields;
5. **Advanced ordering** — alphabetical and course-code ordering.

Programme-aware filters must not collapse distinct questions into a single
“available to my degree” boolean:

- **curriculum membership** says that a course occurs in a specific, versioned
  programme curriculum;
- **requirement relation** says whether it is required, one option in an
  elective group, recommended, or otherwise permitted;
- **access eligibility** says whether enrolment is open, restricted, or
  conflicting for the student's context;
- **offering availability** says whether that course is actually offered in the
  selected period and location.

The first programme-backed Explore slice selects one explicit programme version,
then offers `In this curriculum`, `Required`, and `Elective` filters. Restricted
access and unknown eligibility remain visible findings rather than silently
removing courses. Every relation carries its source and data revision.

Text queries rank by textual relevance. With programme context, ranking starts
with requirement relationship, then schedule fit, future paths unlocked,
offering certainty, and decision usefulness. Ranking reasons must be visible.

Programme popularity is deferred until it has a scoped cohort, denominator,
period, provenance, and privacy treatment. The product does not expose an
unexplained global popularity score.

## Responsive and accessibility contract

- The sidebar and bottom bar derive from one canonical route model.
- Desktop/tablet use the sidebar; phone-sized app containers use at most five
  bottom destinations.
- Course summary internals respond to their container; the global app-shell
  switch may use viewport and device constraints.
- Mobile retains the same information order as desktop.
- All pointer actions have keyboard equivalents and visible focus.
- English and Norwegian accessible names are tested with the visible interface.
- Automated real-browser axe checks cover loaded Explore, open Refine, and
  Inspect at phone and desktop widths without suppressing colour contrast.
- Automated checks complement, but do not replace, keyboard, zoom/reflow,
  screen-reader, comprehension, and touch-ergonomics review.

## Parallel readiness

| Surface | Readiness gate | Work allowed now |
| --- | --- | --- |
| Explore / Inspect | Existing catalogue and evidence contracts | Stable summaries, progressive Refine, accessibility |
| List / Compare | Versioned local saved-course schema | Bookmark, note, compare using the shared summary grammar |
| More | No new source dependency | Language, preferences, provenance/data status, license/support |
| Schedule | Validated timetable/offering-event contract | Acceptance journeys and fixtures only |
| Degree | Published, versioned programme dataset with typed relations | Acceptance journeys and fixtures only |
| Programme-aware Explore | One reliable programme projection | Required/obligatory filtering before popularity ranking |

The next safe parallel implementation lanes are accessibility/token correctness,
the Explore summary/refinement redesign, and the local List foundation.
Schedule and Degree remain specification lanes until their gates are satisfied.
