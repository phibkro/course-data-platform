# List, collections, and course comparison

- Status: Active implementation specification
- Date: 2026-07-25
- Product loop: `Explore -> Inspect -> Save -> Label -> Compare`
- Depends on:
  [`student-experience-contract.md`](./student-experience-contract.md)
- Feeds:
  [`schedule-and-external-sync.md`](./schedule-and-external-sync.md) and
  [`degree-overview-and-pathways.md`](./degree-overview-and-pathways.md)

## Outcome

List is the student's local decision workspace, not a bookmark archive. A
student can save a course without interrupting Explore, remember why it was
interesting, organize it with reusable labels, derive useful collections, and
compare two to four candidates over the same evidence-backed dimensions.

The complete journey works without an account:

1. Save a course from Explore or Inspect in one action.
2. Optionally add labels or a note after saving.
3. Open List and filter the saved set by labels.
4. Select two to four courses.
5. Compare meaningful differences.
6. Send a selected collection to Schedule or a Degree scenario later.

## Interaction intent

List is a student memory aid and decision surface, not a taxonomy
administration tool. A student may be comparing courses between classes, on a
phone, without having decided what their categories mean yet. The interaction
therefore optimizes for low-risk exploration and later cleanup:

- saving first must remain easier than organizing first;
- browsing a colour, typing a draft name, opening Refine, or switching display
  density has no hidden data effect;
- Apply is the explicit boundary for a label mutation;
- `Unlabeled` behaves like an inbox for saved courses that still need
  organization;
- spatial grouping provides visual action context, while semantic structure
  provides the same context without vision;
- compact mode reduces scanning cost rather than merely shrinking the same
  card;
- named Collections preserve a useful question over the List; they do not
  create another place where a course can be lost or duplicated.

When a technically convenient interaction conflicts with reversibility,
predictability, or scanability, those student-facing properties win.

## Product boundary

There is one canonical saved-course set. Folders and independent lists are not
separate containers that copy or move courses.

The student-facing navigation label is **Saved** because it names the content
and follows directly from the Save action. **List** remains the domain term in
this specification and the stable `/list` route; changing internal names does
not improve the journey.

- **List** is every saved course.
- **Label** is a student-owned name and colour attached to zero or more saved
  courses.
- **Label view** is the derived set of saved courses carrying a label.
- **Combined view** is an unsaved bounded expression over labels.
- **Collection** is an optional student-named saved combined-view recipe. It
  stores rules, not copied course identities, so its membership changes as
  labels change.
- **Compare selection** is an ephemeral selection of two to four saved courses.

A course saved under several labels still has one saved-course identity, one
note, and one removal action.

## Student-owned state

The first persisted schema is conceptually:

```ts
type SavedCourseId = string;
type LabelId = string;

interface SavedCourse {
  readonly id: SavedCourseId;
  readonly institutionId: "ntnu";
  readonly courseCode: string;
  readonly savedAt: string;
  readonly note: string | null;
  readonly observedDataRevision: string | null;
}

interface Label {
  readonly id: LabelId;
  readonly name: string;
  readonly color: LabelColor;
}

interface LabelMembership {
  readonly savedCourseId: SavedCourseId;
  readonly labelId: LabelId;
}

interface LocalListState {
  readonly version: 1;
  readonly savedCourses: ReadonlyArray<SavedCourse>;
  readonly labels: ReadonlyArray<Label>;
  readonly memberships: ReadonlyArray<LabelMembership>;
}
```

The exact runtime representation may use records or arrays where Foldkit and
Effect schemas make invariants easier to preserve. The protocol semantics do
not change.

### Invariants

1. A saved course references a stable `CourseIdentity`; it does not own a copy
   of official facts.
2. `(institutionId, courseCode)` is unique in the saved set.
3. Label names are non-empty after trimming and unique under the application's
   documented normalized comparison.
4. A membership references an existing saved course and label.
5. Duplicate memberships are rejected.
6. Deleting a label deletes memberships only.
7. Removing a saved course atomically removes its memberships and any active
   Compare selection.
8. Notes and labels are student-authored. They never acquire official or
   inferred provenance and never satisfy a programme requirement.
9. Factual caches are separate from student-owned saved state. Cached summaries
   retain observation time and source revision.
10. Clock access remains in the web application boundary, not domain code.

## Persistence and recovery

The initial implementation uses local browser persistence. Its contents are
untrusted input and are parsed at startup through a versioned schema.

- A known older version is migrated explicitly and tested.
- An unsupported future version is not interpreted as the current version.
- Corrupt state never partially populates the Foldkit model.
- Recovery preserves the raw value long enough to offer export or reset.
- A visible, translated recovery message explains that saved data could not be
  loaded.
- Reset is explicit and destructive; it is never performed silently.

The PWA caches last-known factual summaries separately so List remains useful
offline. Opening an online List refreshes saved identities progressively.
Provider failure leaves the saved identity, labels, note, and last-known
summary visible with freshness stated.

A versioned JSON export/import is the first cross-device and backup mechanism.
Import parses the same boundary schema and previews additions, merges, and
conflicts before changing local state.

## Saving interaction

Bookmark is an explicit control on every Explore summary and Inspect view. It
has higher interaction priority than the whole-card Inspect target.

Saving is one action:

```text
Saved to List    Add labels    Undo
```

The application never requires label selection before saving. Repeated saving
is idempotent. Removing is undoable during the current interaction and never
removes source facts.

Accessible names distinguish `Save TDT4100 to List` from `Remove TDT4100 from
List`. State is exposed through text and semantics, not icon fill alone.

## Labels and colour

Labels classify student intent, examples including `Autumn 2027`, `Ask adviser`,
`Remote candidates`, and `UiO pathway`. A name such as `Remote candidates` is
not evidence that remote participation is officially supported.

Label colours come from a constrained set based on Tailwind colour families.
Product components consume repository-owned semantic label tokens with
light/dark pairs; they do not introduce direct palette utilities or hex values.

- Colour is never the only differentiator.
- The label name is always available to assistive technology.
- Text/background combinations pass contrast checks in every theme preset and
  colour mode.
- Renaming or recolouring a label updates every projection because membership
  refers to stable label identity.
- The editor is transactional. Name and colour changes remain draft state until
  the student chooses `Apply`; closing or cancelling discards them.
- Empty-name and duplicate-name feedback appears only after an Apply attempt,
  then updates as the student corrects the submitted draft.
- Creating a label from a course or bulk-selection context attaches it only in
  the same successful Apply transition. Browsing colours never creates or
  attaches a label.
- Repeated row actions use stable visible labels such as `Edit label` and
  `Delete label`. Row structure, focus order, and accessible descriptions
  provide the associated label context without producing visually ragged
  action text.
- The student-facing palette favours distinct Nordic nature names. `Sky`
  remains and `Blue` is retired because the two are not reliably
  distinguishable. Persisted legacy `blue` values are parsed at the storage
  boundary and migrated deterministically to `sky`; new state never writes
  `blue`.

## Collection composition

The filter model supports useful set operations without a recursive query
language:

```ts
type LabelPredicate =
  | { readonly type: "label"; readonly labelId: LabelId }
  | { readonly type: "unlabeled" };

interface LabelRule {
  readonly anyOf: ReadonlyArray<LabelPredicate>;
  readonly allOf: ReadonlyArray<LabelPredicate>;
  readonly noneOf: ReadonlyArray<LabelPredicate>;
}
```

For the universe `U` of saved courses:

- an empty `anyOf` group has identity `U`; otherwise it yields the union of its
  predicates;
- an empty `allOf` group has identity `U`; otherwise it yields the intersection
  of its predicates;
- the positive result is `anyOf ∩ allOf`;
- `noneOf` predicates are unioned and subtracted from that positive result;
- `unlabeled` is the derived set of saved courses with zero memberships;
- excluding `unlabeled` therefore means “show only labelled courses.”

The ordinary UI may initially expose one positive group as an `Any`/`All`
choice, but the canonical rule can represent both groups. This supports saved
recipes such as “any of AI or Design, all of Autumn 2027, excluding
Group-heavy” without a recursive expression builder.

Contradictory input, such as including and excluding the same predicate, is
normalized visibly rather than producing a surprising empty view. An
`allOf(unlabeled, label X)` rule is unsatisfiable by definition and is explained
or prevented before Apply rather than presented as an unexplained empty List.

The algebra has table-driven examples plus exhaustive small-universe tests.
Those tests cover empty groups, duplicate predicates, Any/All overlap,
exclusion, unlabeled membership, contradictory recipes, and permutation
invariance.

The ordinary UI starts with label chips and defaults to `Any`. `All` and
`Exclude` live in a progressively disclosed `Combine labels` control. The
current expression is restated in plain language:

> In Autumn 2027 and Remote candidates, excluding Group-heavy.

The URL may encode the active expression. It shares the filter recipe, not the
recipient's private saved data.

A student can save the active expression as a named Collection. A Collection
persists the normalized `LabelRule`, has stable identity, can be renamed or
deleted without affecting labels, and opens as the same shareable URL recipe.
Deleting a referenced label visibly simplifies affected Collections; it never
silently points the rule at another label.

## List information architecture

The page contains:

1. heading, saved count, and a route back to Explore;
2. a compact/card view switch;
3. label chips with collection counts;
4. active combined-view summary and clear action;
5. stable saved-course summaries;
6. a selection action tray when courses are selected;
7. recovery, offline, stale, and empty states.

Card view preserves the full decision profile, private note, labels, and
evidence summary. Compact view prioritizes course identity, offering, labels,
and primary actions in a stable scan line; secondary evidence remains available
through Inspect. The chosen density is a local display preference and does not
change collection membership or factual state.

The projection contract is reusable across Explore and List, but each surface
chooses its information content. Reuse must not make Explore display private
List notes or make compact List rows lose their label context.

`Refine` remains reachable at every scroll position. Mobile uses a fixed action
above the bottom navigation; wider layouts use a sticky control aligned with
the content or sidebar rather than a floating mobile-style button.

Saved summaries reuse the order defined in the student experience contract:

1. identity and current offering;
2. labels and private note;
3. decision profile;
4. Uni Planner outcome evidence;
5. freshness or changed-since-saved findings;
6. Inspect, Compare, Schedule, and remove actions.

Useful change findings include:

- assessment changed since the saved revision;
- the course is not offered in the selected period;
- new outcome evidence is available;
- schedule has not been checked;
- the current source is unavailable and last-known data is displayed.

Unknown never removes a stable information slot or ranks as favourable.

## Selection and bulk actions

Selection is distinct from bookmarking. Selecting saved courses reveals a
persistent action tray:

```text
3 selected    Compare    Check schedule    Add labels    Export
```

Bulk actions operate on explicit stable identities. Removal is secondary,
confirmed when material, and recoverable where practical.

## Compare

Compare is a mode within List, not a new primary destination. A validated
constructor accepts exactly two, three, or four distinct saved-course
identities. Other arities are not representable as an active comparison.

Comparison dimensions are stable:

1. identity, credits, term, and campus;
2. assessment parts and weights;
3. obligatory work;
4. collaboration;
5. attendance and remote evidence when available;
6. outcome scale, distribution, failure rate, sample, and observed period;
7. programme and pathway relations when those data gates open.

The default is difference-first: equal known values may collapse behind `Show
all`. Missing states remain explicit cells—unknown, unavailable, suppressed,
conflicting, stale, or failed—and never become zero, false, easy, or empty.

Desktop may use a matrix with a sticky dimension column. Mobile compares two
courses at a time or presents one dimension across selected candidates; it does
not compress four desktop columns into the viewport.

Compare selection is URL/session interaction state rather than durable student
data in the first release. Refresh and history preserve the active comparison
when the referenced courses remain saved.

## Responsive and accessible behaviour

- Mobile List preserves the same information order as desktop.
- Mobile bottom navigation uses equal vertical alignment for every destination;
  Explore does not protrude above its peers. Excess top padding is removed, and
  the narrow label `Style` replaces `Appearance` while the stable
  `/appearance` route remains unchanged.
- The bottom navigation activates List only when the first useful saved-course
  journey is delivered.
- Pointer, keyboard, and touch selection expose the same actions.
- Label composition has visible controls and does not depend on modifier keys,
  drag gestures, or colour.
- Focus returns predictably after dialogs and undo actions.
- English and Norwegian cover labels, comparison dimensions, recovery, offline,
  stale, empty, and error states.
- Axe journeys cover populated List, label editing, combined filtering, and
  Compare at phone and desktop widths.

## Handoffs

- `Check schedule` creates an explicit schedule scenario snapshot from the
  selected identities. It does not alias a live label collection.
- `Add to degree` creates or updates student-owned planning state only after the
  Degree data gate opens.
- Later changes to a source label produce a proposed diff; they never silently
  mutate a Schedule or Degree scenario.

## Delivery slices

### L1: Save and local recovery

- validated, versioned local state;
- one-tap Save/Remove in Explore and Inspect;
- `/list` route, empty state, saved identities, notes;
- reload, corrupt-state, offline, and provider-failure tests.

### L2: Labels and collections

- create, rename, recolour, and delete labels;
- attach/detach one or many saved courses;
- transactional Apply semantics and submission-timed validation;
- Any/All/Exclude/Unlabeled composition with exhaustive algebra tests;
- URL-backed filter state and translated plain-language summary.

### L2.1: List ergonomics and saved recipes

- compact/card projections and a persistent density choice;
- scroll-accessible Refine on mobile and desktop;
- named Collections that persist normalized label rules;
- explicit recovery when a referenced label is later deleted.

### L3: Compare

- structurally valid two-to-four selection;
- difference-first responsive comparison;
- explicit Fact states and evidence links;
- history and accessibility journeys.

### L4: Portability and handoff

- JSON backup/import preview;
- bulk export of course identities;
- explicit Schedule snapshot handoff once its data gate opens.

## Acceptance

- A first-time student saves and compares two courses in under two minutes
  without an account.
- Save does not interrupt browsing or wait for enrichment.
- Saved state and notes survive reload; corrupt/future state is recoverable and
  never silently discarded.
- A course belongs to several labelled collections without duplication.
- Any, All, and Exclude produce deterministic tested sets.
- Unlabeled is derived from membership and composes predictably with the same
  rule algebra.
- Label drafts never persist or attach until Apply succeeds.
- Compact and card views contain the same saved-course identities and label
  memberships.
- Removing a saved course clears dependent memberships and comparison state
  atomically.
- Compare preserves every non-known factual state.
- List remains useful during provider failure and while offline.
- The complete journey passes keyboard, 375 px mobile, desktop, EN/NB, axe,
  type, lint, test, OpenAPI, and build checks.

## Deferred

- accounts and server synchronization;
- public or collaborative collections;
- nested folders;
- arbitrary recursive collection expressions;
- social ranking and popularity. A later opt-in experiment may suggest labels
  only from thresholded aggregate counts, with normalization, abuse controls,
  and a clear explanation that private List contents otherwise remain local;
- automatic course recommendations;
- Schedule and Degree behaviour before their stated data gates.
