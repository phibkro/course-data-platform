# Subject graph (research spike)

Status: research spike, 27 October 2026. Not part of Course Lens. Nothing in `apps/` or
`packages/` depends on it. ADR-009 and ADR-012 still hold: the product stays course-decision
first, and this folder exists to test whether a graph earns a place in it.

The question it tests: if NTNU subjects, programmes and a student's own history live in one
graph, can a student ask useful questions over it ("what can I take next?", "how much of my
programme have I covered?", "what is this course like?") and see the answer on a map?

## Model

Two node kinds and one edge shape.

| Node | Examples |
|---|---|
| `subject` | `TDT4100`, retired codes such as `SIF8005` (known only through overlaps) |
| `tag` | `programme:BIT-2023`, `group:BIT-2023/BITOBLIG23`, `exam:none`, `term:spring-2027`, `campus:Trondheim`, `cluster:9`, `plan:<student>` |

A tag is a node that carries metadata instead of teaching anything. A programme, a study
direction, a course group, an assessment type and a discovered cluster are all tags. Tags nest
through `part_of` edges (group → direction → programme → `kind:programme`), so "members of BIT"
includes every group below it.

Every edge has the same shape:

```text
{ s, t, kind, directed, w, q, ev }
  kind      relation name                      overlaps, requires, member, tagged, similar ...
  directed  asymmetric or not                  requires: true, overlaps: false
  w         weight or null                     overlap credits, cosine similarity
  q         qualifiers                         {role: compulsory, period: 3}, {grade, term}
  ev        [source, method, confidence]       ["ntnu-course-page-2026", "credit-reduction-table", 1]
```

Qualifiers keep the semantics ADR-008 asks for: a programme membership stays `compulsory` or
`elective` with its study period instead of collapsing into "available". Evidence keeps the
ADR-009 primitives: provenance, method version and confidence, so a parsed fact and a model
inference are never confused.

| Edge kind | Directed | Weight | Source | Confidence |
|---|---|---|---|---|
| `tagged` | yes | – | Course page fields; exam type and flags by rules or keywords | 1 for fields, 0.6–0.8 for rules |
| `member` | yes | – | NTNU study plan JSON (qualifiers: role, period, choice) | 1 |
| `admits` | yes | – | "Admission to a programme of study is required" | 1 |
| `overlaps` | no | credits | Credit-reduction tables, merged when both pages list the pair | 1 |
| `requires`, `recommends` | yes | – | Course codes mentioned in the prerequisite sections | 0.9 |
| `similar` | no | cosine | MiniLM embeddings of title, content and learning outcomes, top 6 above 0.55 | the cosine |
| `in_cluster` | yes | – | Louvain over similarity, overlap and prerequisite edges | 0.5 |
| `completed`, `taking`, `credited` | yes | – | Student-authored (private bundle only) | 1 |

## Pipeline

```text
.cache/pages/*.html  ─ parse_pages.py ─▶ .cache/courses.json
.cache/plans/*.json  ─┐
                      ├ build_graph.py ─▶ .cache/graph_base.json
                      │
          enrich.py   ─▶ .cache/graph.json   embeddings, similar edges, UMAP layout,
                                             Louvain clusters, pass rates, programme paths
          export.py   ─▶ data/graph.json     compact, committed, no personal data
          export.py --private ─▶ .cache/viewer-data.json   adds the personal plan
          viewer/build.py [--private] ─▶ one self-contained HTML viewer
```

`.cache/` is not committed: it holds 5,152 cached NTNU course pages (2026/27), study plans,
embeddings, grades.no counts and the personal plan. `data/graph.json` is reproducible from it.

Run (Python 3.12, `pip install sentence-transformers umap-learn networkx scikit-learn`):

```sh
python3 pipeline/parse_pages.py
python3 pipeline/build_graph.py
python3 pipeline/enrich.py
python3 pipeline/export.py [--private]
python3 viewer/build.py [--private]
```

## Query

The viewer evaluates a pipeline of set operators in the browser (about 75,000 edges, queries
run in milliseconds, so no database or index is needed):

```text
plan(philip) | frontier | filter(term:spring-2027, access:open, cr=7.5)
             | filter(!exam:school, !flag:group-work, !flag:attendance) | rank(ease) | take(30)
```

Sources: `all`, `code(...)`, `search(text)`, `tag(ns:value)`, `programme(CODE-YEAR[, role])`,
`plan(name)`, `cluster(n|word)`. Steps: `neighbours(kind)`, `closure(kinds...)`,
`dependents(kind)`, `similar(k)`, `frontier`, `filter(...)`, `nooverlap`, `minus(...)`,
`and(...)`, `or(...)`, `compare(...)`, `rank(ease|pass|cr|code)`, `take(n)`.

`frontier` = subjects whose `requires` targets are all done, not done, and not overlapping
anything done. `compare(B)` reports how much of B the current set covers and returns the rest.

The map is a UMAP layout of the embeddings, so distance means similar teaching content. A
programme is drawn as a path through the centroid of its courses in each study period, and a
personal plan as a path through each semester's courses: the "direction" of a set.

## What the spike shows, and its limits

- Prerequisites are sparse in NTNU's own data. Most informatics pages give prose
  ("software engineering or equivalent") rather than codes, so `requires` is mostly empty for
  TDT courses; `recommends` carries more. A model pass over the prose, keeping the quoted span
  as evidence, is the next step if readiness matters.
- Flags (`group-work`, `attendance`, `online`) are keyword hits on the page text: they mean
  "mentioned", not "required".
- Only 7 study plans are loaded (2023 cohorts). Cohort versioning is in the tag id.
- Cluster labels are title words; the clusters themselves depend on edge weights, which are
  fixed in `enrich.py` (`weights`).
- Pass rates exist only for the 700 open spring-2027 courses collected earlier.
