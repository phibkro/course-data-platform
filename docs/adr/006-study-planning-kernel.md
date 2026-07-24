# ADR-006: Study-planning kernel and product projections

- Status: Accepted
- Date: 2026-07-20

## Context

The initial product was framed as a course browser. The useful long-term system is broader: students explore programmes, compare alternatives, construct term-by-term roadmaps, track progress, and inspect the underlying public data. These workflows share the same temporal catalogue, programme requirements, provenance, and evaluation logic.

Hardcoding each workflow as an independent page would duplicate semantics and allow the same programme or course relation to mean different things across the application.

## Decision

Build a headless study-planning kernel. The kernel owns canonical entities, typed relations, deterministic planning operations, and structured explanations. User-facing interfaces are projections over this kernel.

Initial projections are:

- Explore: institution, programme, and course discovery.
- Compare: programme and roadmap comparison.
- Plan: term-by-term scenario construction.
- Track: actual progress against an official programme version.
- Workbench: full kernel controls, provenance, and custom projections.

The kernel must:

- be independent of React, Elysia, Cloudflare, and storage implementations;
- receive all context explicitly, including programme version and data revision;
- distinguish official curriculum, planned scenarios, and actual progress;
- return structured findings rather than presentation strings alone;
- preserve relation authority and evidence;
- serialize planning scenarios without an account or server session.

## Consequences

The programme roadmap becomes the central product model rather than an extension of the course list. UI state may choose a projection, but it may not redefine programme semantics.

The first implementation is deliberately small: required courses, choose-N groups, minimum-credit requirements, term placement, credit totals, and findings. More expressive constraints can be introduced without changing scenario identity or projection boundaries.
