# Course decision contract

## Product promise

A student can decide whether a course deserves further consideration without
manually combining several NTNU and grade-statistics pages.

The product explains available evidence. It does not pretend that inferred work
form, attendance, collaboration, or difficulty is an official fact.

## Golden tasks

1. Search an exact course code and recognize the intended course.
2. Determine what students learn and how teaching is organized.
3. Determine whether assessment is an exam, project, portfolio, or combination.
4. Find obligatory assignments and attendance requirements.
5. Determine whether work is individual, collaborative, or unknown.
6. Assess whether remote participation appears possible.
7. Interpret grade distribution, failure rate, and sample size.
8. Bookmark a course and compare it with another candidate.

The first walking skeleton implements tasks 1–7 for `TDT4136`. Task 8 follows
after course detail is reliable.

## Golden course set

The checked-in fixture set should grow to 10–20 current or recent NTNU courses
covering:

- written school exam;
- oral exam;
- portfolio assessment;
- project-heavy work;
- group projects;
- individual projects;
- obligatory exercises;
- attendance requirements;
- online or hybrid teaching;
- high and low observed failure rates;
- unavailable grade statistics;
- ambiguous or conflicting source evidence.

The set is a product and extractor test corpus, not a claim that these courses
represent all NTNU study patterns.

## Fact states

Every decision-relevant fact is in exactly one state:

- `known`: supported by one or more compatible evidence records;
- `unknown`: no source supplied enough information;
- `unavailable`: a source does not expose the fact;
- `suppressed`: the provider intentionally withheld it;
- `conflicting`: available evidence disagrees materially.

Zero, `false`, and an empty list are valid known values and must not encode one
of the other states.

## Evidence

Evidence records identify:

- provider and source kind;
- canonical source URL or source record identifier;
- source period or course term where applicable;
- observation timestamp;
- the excerpt, structured field, or statistic supporting the fact;
- whether the product displays a source fact or an inference.

Derived classifications additionally identify the rule that produced them.

## Initial course summary

Search results need only:

- stable course identity;
- code and localized title;
- credits when known;
- current or requested teaching term;
- campus or delivery locations when known;
- language when known;
- a small number of evidence-backed assessment/work-form signals;
- enrichment state.

Search results must remain useful before complete enrichment.

## Initial CourseInsight

Course detail is organized into:

- identity and availability;
- content and learning outcomes;
- teaching and expected work form;
- assessment;
- obligatory activity;
- collaboration;
- attendance, location, and online evidence;
- prerequisites and access restrictions;
- grade outcomes;
- per-source status, freshness, and warnings.

Grade outcomes include the covered period, sample size, grade distribution,
failure rate, and only those aggregate measures actually supported by the
provider.

## Partial success

The course service combines independent source results. NTNU course content
remains available if a grade provider fails; grade history remains available if
page enrichment fails. The protocol reports source-level status and warnings
alongside the usable result.

## Initial release boundary

- NTNU only.
- No authentication.
- No programme selection.
- No planner or progress model.
- No full-catalogue replication prerequisite.
- Search live; enrich exact matches and opened courses; cache after the live
  path and invalidation requirements are understood.
