# Scan and persist: decision signals and source publication

- Status: Active execution anchor
- Date: 2026-07-24
- Product loop: `Explore -> Inspect -> List -> Compare`
- Shared interaction contract:
  [`student-experience-contract.md`](./student-experience-contract.md)
- Current milestone: `Scan -> Save -> Compare`
- Delivered: outcome strip and English/Norwegian interface (`main`, 2026-07-24)
- In progress: assessment scan signals

## Outcome

A student can scan a broad NTNU catalogue, recognize how candidate courses are
assessed, notice historically unusual outcomes or work constraints, and save
promising courses without opening several external systems.

The catalogue remains immediately usable when enrichment is loading, stale, or
unavailable. Every enriched signal retains its source, period, observation time,
and uncertainty.

This plan deliberately couples student-visible improvements to the smallest data
infrastructure needed to support them. D1/R2 replication is not accepted as a
milestone unless it makes Explore, Inspect, List, or Compare faster, more
reliable, or more informative.

## Student acceptance journey

At 375 px and at desktop width, a student can:

1. Search or browse without choosing a programme or creating an account.
2. Recognize the course identity, offering, and campus before enrichment.
3. Read a stable visual assessment grammar once course evidence arrives.
4. Read an HK-dir outcome strip with scale, returned-bucket distribution,
   failure rate, sample size, and observed result period when those facts are
   known.
5. Distinguish unchecked, loading, inferred, conflicting, unavailable, failed,
   and stale signals without treating any of them as zero or false.
6. Open the full course detail for prose, higher-fidelity charts, and source
   evidence.
7. Save the course locally and compare it with two to four alternatives.

## Information hierarchy

Each catalogue item has three layers.

### 1. Identity and availability

- course code and title;
- credits when known;
- teaching term and campus;
- bookmark action when List is implemented.

This layer comes from the fast catalogue path and must not wait for enrichment.

### 2. Decision profile

- assessment form and composition;
- obligatory work;
- collaboration;
- attendance;
- remote-participation evidence;
- selected work-form signals.

This layer is progressively enriched only for an exact match, a visible card,
an opened course, or a saved course.

### 3. Uni Planner insight

Historically observed outcomes are the distinctive cross-source value and
receive more visual emphasis than commodity catalogue metadata:

- grading scale;
- compact returned-bucket distribution;
- failure rate;
- sample size;
- observed result period;
- HK-dir attribution and freshness.

The distribution is primary. Failure rate without its sample size and observed
period is never presented as a standalone difficulty score.

## Visual grammar

### Assessment forms

Product views consume semantic icons through `apps/student-web/src/icons.ts`.
They do not import Phosphor directly.

| Domain value | Semantic meaning | Compact label |
| --- | --- | --- |
| `written-exam` | supervised written examination | Written |
| `oral-exam` | oral examination | Oral |
| `home-exam` | take-home examination | Home exam |
| `project` | assessed project | Project |
| `portfolio` | portfolio or folder assessment | Portfolio |
| `practical` | practical assessment | Practical |
| `assignment` | assessed submission | Assignment |
| `other` | source evidence exists but is not classified | Other |

A combination is rendered as its constituent forms in source order rather than
as an ambiguous combination icon. Known weights appear beside the relevant
part. Unknown weights remain absent, not zero.

Icons supplement meaning:

- compact signals have an accessible group description;
- tooltips work on pointer hover and keyboard focus;
- short visible labels appear where space permits;
- full prose remains available in Inspect;
- neither colour nor icon shape is the only accessible representation;
- inferred signals are visually distinguishable from direct source facts.

### Catalogue outcome strip

The first chart is an HTML/CSS micro-chart with an ASCII-like rhythm, not a
literal text chart:

```text
A  B  C  D  E  F
▂  ▅  █  ▆  ▃  ▂       10.7% failed
                      n=1,951 · 2022–25
```

The semantic structure retains the grade labels, exact values, accessible
summary, and source state. Letter, pass/fail, and mixed scales have different
grammars. Only buckets returned with known, non-suppressed counts render as
bars. A returned zero from a privacy-protected DBH table is treated as
suppressed, not as a known zero. An absent bucket is not synthesized as zero
until the provider contract proves that omission means zero.

The visible mobile strip always retains the failure rate, sample size, and
observed period when known. Pointer or focus tooltips are supplementary.
Nonzero bars have a minimum visual height; the accessible values remain
authoritative.

### Detail outcomes

Inspect may use a higher-fidelity SVG chart following the visual conventions of
shadcn/Recharts while remaining a Foldkit interaction:

- exact values on focus and pointer interaction;
- axes and labels when they improve interpretation;
- year or semester comparison when the period data supports it;
- Material semantic tokens for colour;
- a prose/table equivalent for assistive technology;
- reduced-motion support.

React and React chart components are not introduced into the Foldkit tree.

## Data ownership

### R2 evidence archive

R2 stores exact source responses and observation manifests. Object keys are
content addressed where practical:

```text
evidence/dbh/table-308/sha256/<hash>.json
evidence/dbh/table-308/observations/<time>-<hash>.json
evidence/ntnu/course/<course>/<year>/sha256/<hash>.html
evidence/ntnu/catalogue/sha256/<hash>.json
```

R2 answers, “What exactly did the provider return?” It is not queried for every
catalogue card.

### D1 serving projection

D1 stores validated, normalized, indexed projections and publication pointers.
It answers, “What can the product query efficiently?”

The DBH course-outcome projection requires:

- institution identity;
- canonical course code and provider version code;
- year and semester;
- grade bucket and candidate count;
- grading scale;
- source record and content hash;
- observation and publication revision;
- derived rollups tied to their input revision.

The NTNU projection requires:

- stable course identity;
- academic-year course version;
- current offerings;
- extracted assessment parts and work signals;
- source evidence and observation time;
- validity/tombstone state;
- publication revision.

Database rows remain infrastructure types. Public facts continue through
`packages/course-model` and `packages/contracts`.

## Publication and freshness

### DBH/HK-dir

DBH is period-addressed and append-mostly, not assumed permanently immutable.
Corrections produce a new observed dataset revision. Public DBH tables may
anonymize counts below three. A returned zero in a protected count field is
therefore suppression, not evidence of zero candidates.

1. Fetch a bounded institution/period dataset during development.
2. Archive exact bytes and the request manifest in R2.
3. Parse all untrusted fields at the source boundary.
4. Normalize grade buckets into a candidate D1 revision.
5. Validate identity coverage, totals, rejection rates, and source references.
6. Atomically advance the published revision.
7. Keep serving the last valid revision when a later run fails.

Current and previous reporting periods are checked more frequently. Older
periods are reconciled weekly or monthly. An unchanged content hash is a no-op.

Grades.no may remain an independent comparison source during migration, but
normal product availability must not depend on it.

Outcome aggregation uses assessed results only: A–F and G–H contribute to the
sample denominator; F and H contribute to failure. Withdrawn, absent, and other
non-assessed codes are excluded. The denominator definition belongs in source
help and the full detail view so the quick signal stays compact without silently
implying that every published row was assessed. Mixed-scale failure combines F
and H and is labelled as mixed.

### NTNU

NTNU uses a last-known-good read-through model:

1. Serve the current published D1 projection immediately.
2. Report freshness with the returned facts.
3. Queue refresh for stale, opened, visible, exact-match, or saved courses.
4. Validate the candidate capture and publish atomically.
5. Retain history when a course changes or stops being offered.

A course missing from one response is not immediately deleted. Complete
reconciliation or an explicit upstream deletion closes its current validity
range while retaining older course versions.

The official NTNU API is evaluated for identities, `lastUpdated`, incremental
change detection, and deletion markers. The catalogue endpoint and course page
remain available for facts the API does not expose.

## Serving path

The target request flow is:

```text
student-web
  -> course-api contract
  -> Effect course service
  -> published D1 projection
  -> response with revision and freshness
       \-> Queue refresh when policy says stale

scheduled ingest
  -> upstream source
  -> R2 exact evidence
  -> parser and quality gates
  -> D1 candidate revision
  -> atomic publication
```

HTTP edge caching accelerates revisioned responses but is not the source of
truth. ETags derive from canonical request input, published dataset revision,
and response schema version.

## Internationalization and translation contributions

The initial interface supports English (`en`) and Norwegian Bokmål (`nb`) using
BCP 47 locale identifiers. English is the complete fallback catalogue.

Localization is explicit application state:

- the URL can carry a shareable locale override;
- a validated local preference persists the student's choice;
- first visit may negotiate from browser language;
- Foldkit views receive a locale and typed message formatter rather than import
  global mutable translation state;
- `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.ListFormat`, and plural
  rules format values instead of concatenating locale-specific strings;
- accessible names, source states, chart summaries, errors, and empty/loading
  states are translated alongside visible labels.

Repository-owned catalogues use stable semantic keys. CI validates that every
catalogue:

- contains no unknown keys;
- satisfies the required baseline keys or declares fallback intentionally;
- preserves interpolation variables and plural branches;
- contains static message strings rather than executable formatter functions.

Translation contributions should be content-only pull requests wherever
possible. A contributor guide documents locale naming, tone, terminology,
screenshots, local validation, and how to add a future locale without modifying
the interaction model.

Interface localization is separate from source-language evidence. NTNU prose
remains in its observed language and is labelled accordingly; the product does
not silently present machine translation as an official source fact. A future
translated view must retain the original text and attribution.

## Delivery slices

### Slice 1: Outcome strip

Status: Delivered on `main` (2026-07-24).

Student decision: “Do these historical outcomes deserve closer inspection?”

- Add grade distribution to the batched course-summary contract from model,
  through mapping and DTOs, to generated OpenAPI.
- Request year and semester with each DBH bucket and derive the observed period
  from returned assessed rows rather than echoing the requested window.
- Treat protected zero counts as suppressed and do not calculate incomplete
  sample, distribution, or failure facts as if they were complete.
- Render a compact letter or pass/fail chart on enriched catalogue cards.
- Attach failure rate, sample size, observed period, state, and `HK-dir (DBH)`
  attribution.
- Preserve the current non-blocking enrichment request.
- Cover known, loading, absent, pass/fail, mixed, partial, suppressed, and
  failed states.

Acceptance: a student can compare the shape and reliability of historical
outcomes across visible cards without opening each detail page.

### Enabling slice: English and Norwegian interface

Status: Delivered on `main` (2026-07-24).

Student decision: “Can I understand and share the course-decision interface in
my preferred language?”

- Add typed `en` and `nb` catalogues and locale-aware formatting.
- Add a compact language choice without creating another primary navigation
  destination.
- Keep locale in explicit URL/local application state with English fallback.
- Translate Explore, Inspect, source/fact states, outcome summaries, and
  accessibility text before List and Compare multiply the message surface.
- Add a [translation-contribution guide](./localization.md) and catalogue
  validation command.

Acceptance: the Explore-to-Inspect journey works in English and Norwegian at
375 px and desktop width, a shared URL preserves its language, and a
translation-only PR can be validated without changing the interaction model.

This enabling slice may proceed independently of DBH persistence but lands
before Assessment scan signals and Save/Compare.

### Slice 2: Published DBH course outcomes

Student decision: the same outcome strip remains fast and available during DBH
outages.

- Add table-308 archive and normalized course-grade projection.
- Implement the course-outcome D1 adapter behind the course-service repository
  capability. It may reuse proven revision/publication concepts, but it does
  not expose planner-era rows or let the old application determine the new
  public contract.
- Switch `getGradeSummaries` to a repository capability.
- Schedule bounded current-period refresh.
- Return publication revision and freshness.
- Provision only DBH resources and tables in this slice. NTNU storage is
  provisioned only when Slice 5 begins.

Acceptance: Explore and Inspect serve the last published outcome revision with
DBH network access disabled.

Publication tests prove that readers never observe a partial revision, an
unchanged content hash is a no-op, and failed validation retains the last valid
revision.

### Slice 3: Assessment scan signals

Status: In progress on `agent/assessment-scan-signals`.

Student decision: “How will I be assessed, and what kind of work is involved?”

- Harden assessment-part extraction against the golden corpus.
- Enrich only exact, visible, opened, or saved courses with cancellation and a
  concurrency bound.
- Render semantic assessment composition and inference state.
- Surface obligatory work and collaboration without overclaiming.

Acceptance: a student can distinguish exam-only, project-heavy, portfolio,
oral, and mixed-assessment courses while browsing.

This student-visible work and Save/Compare do not wait for Slice 2 if DBH
publication takes longer than expected.

### Slice 4: Save and compare

Student decision: “Which candidates should I keep, and how do they differ?”

- Add local account-free bookmarks and notes.
- Persist validated local state and tolerate schema upgrades.
- Select two to four saved courses.
- Compare assessment, work, constraints, and outcomes using the same signal
  grammar.

Acceptance: a first-time student can save and compare two courses in under two
minutes without an account.

### Slice 5: NTNU last-known-good projection

Student decision: current course facts remain usable and visibly fresh through
upstream slowness or failure.

- Archive and publish observed course versions.
- Add queued stale-while-refresh behaviour.
- Reconcile current offerings and retain historical versions.
- Measure whether local search should replace or complement NTNU search.

Acceptance: an opened or saved course remains inspectable during an NTNU
outage, with staleness stated rather than hidden.

## Quality gates

Each slice includes, in proportion to its change:

- pure domain and parser tests;
- source fixtures with capture metadata;
- contract and Elysia response tests;
- Foldkit Story and Scene coverage;
- 375 px mobile and desktop Agent Browser journeys;
- keyboard and accessible-name checks;
- partial-source-failure checks;
- TypeScript, lint, formatting, tests, OpenAPI generation, and builds.

The golden corpus grows to 10–20 courses spanning:

- each assessment form and mixed forms;
- known and unknown weights;
- letter and pass/fail grading;
- small and large samples;
- no DBH outcomes;
- a returned privacy-suppressed count;
- an absent grade bucket that is not synthesized as zero;
- a mixed letter/pass-fail history;
- a non-assessed grade code excluded from the denominator;
- high and low observed failure rates;
- missing, inferred, conflicting, stale, and failed evidence.

## Measurements and stop conditions

Track:

- time to first usable catalogue result;
- time until visible cards are enriched;
- upstream requests per browsing session;
- enrichment cache hit rate after D1 publication;
- card height and courses visible per viewport;
- time to correctly answer assessment and outcome questions;
- time to save and compare two courses.

Stop or simplify when:

- enrichment makes first results wait;
- a visual signal cannot explain its evidence state;
- a new table or Worker does not serve a current acceptance journey;
- the dense card becomes harder to scan than opening Inspect;
- source-derived classifications imply certainty the evidence does not support.

## Deferred

- authentication and cross-device synchronization;
- programme compatibility and planning;
- scheduling and conflict detection;
- second-institution adapters;
- national DBH replication;
- generalized analytics infrastructure;
- discretionary design-system expansion.

## Decision log

- 2026-07-24: Historical outcomes are promoted as a primary catalogue insight.
- 2026-07-24: The catalogue uses compact semantic charts; Inspect may use
  higher-fidelity SVG charts.
- 2026-07-24: R2 owns exact evidence and D1 owns published serving projections.
- 2026-07-24: DBH is treated as append-mostly and revisioned, not permanently
  immutable.
- 2026-07-24: NTNU uses last-known-good projections with queued refresh rather
  than hard expiry and deletion.
- 2026-07-24: Slice 1 stays on the existing live batched DBH path so the
  persistence slice is driven by a proven product contract.
- 2026-07-24: The course-summary contract adds distribution and per-period
  capture; the prior requested window is not presented as observed coverage.
- 2026-07-24: DBH protected zero counts are treated conservatively as
  suppressed, and absent buckets are not synthesized as known zero.
- 2026-07-24: Outcome failure uses assessed results as its denominator and
  explicitly excludes non-assessed codes.
- 2026-07-24: English and Norwegian Bokmål are first-party interface locales;
  source prose retains its observed language and provenance.
