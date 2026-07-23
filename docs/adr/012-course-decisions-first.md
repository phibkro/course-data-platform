# ADR-012: Course decisions first

## Status

Accepted

## Context

The programme-first platform established strong boundaries for provenance,
versioning, ingestion, planning, and deployment. Its browser experience does not
yet answer the practical questions students ask when choosing a course.

An earlier direct-source prototype provides more immediate value by combining
course content, teaching methods, assessment, obligatory work, collaboration,
attendance signals, and grade outcomes. Its source integration is less mature,
but it validates a more useful product model.

Continuing the existing delivery sequence would increase system capability
without first proving repeat student use.

## Decision

The active product is an NTNU course-decision application:

1. Discover a course without programme onboarding.
2. Understand its content, work, assessment, constraints, and outcomes.
3. Shortlist promising courses locally.
4. Compare candidates.
5. Add optional programme compatibility only after those workflows prove useful.

The prototype is treated as a product specification and source-integration
reference. The existing platform is treated as a toolbox. Neither implementation
is adopted wholesale.

The new student application uses Foldkit with repository-owned Material You
tokens and source-owned component recipes. Elysia remains the HTTP boundary.
Effect is introduced where source orchestration is genuinely complicated.
Alchemy v2 initially provisions only resources used by the current workflow.

## Consequences

- The existing React planner and ingestion system remain available during the
  walking-skeleton transition but are not expanded.
- Programme planning, Workbench, authentication, multiple institutions, full
  replication, and speculative infrastructure are deferred.
- Course facts, evidence, uncertainty, and source-level partial failure become
  the primary domain concerns.
- A feature is accepted by a browser-visible student task, not by an
  infrastructure milestone alone.
- Foldkit and Alchemy v2 introduce pre-1.0/beta ecosystem risk. That risk is
  contained by keeping the first application and stack deliberately small.
- React shadcn components are not mixed into Foldkit. The project retains the
  source-ownership practice and Material semantic design language.

## Revisit criteria

Revisit the deferred planning direction when real students repeatedly use
discovery, details, shortlisting, and comparison and identify programme fit as
the next blocking question.
