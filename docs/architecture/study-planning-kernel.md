# Study-planning kernel

## Purpose

The kernel is the institution-independent semantic centre of the platform. Sources describe what institutions report; the kernel represents what a student can explore, compare, plan, and evaluate.

## Boundaries

### Catalogue kernel

Temporal institutions, programmes, programme versions, courses, course versions, offerings, and evidence.

### Planning kernel

Requirement groups, study terms, planning scenarios, course placements, evaluation policy, and structured findings.

### Personal context

Optional completed/current courses, preferences, and user-authored scenarios. Public catalogue queries never require identity.

### Knowledge kernel — deferred

Concept coverage, prerequisite knowledge, overlap, and readiness. It remains separate from formal curriculum evaluation.

## Invariants

- A scenario always references one programme version and one data revision.
- A course may appear at most once in a scenario.
- Moving a course changes placement, not formal requirement identity.
- Formal requirements and personal plans are separate objects.
- Relation authority is explicit: official, administrative, inferred, or fixture.
- Findings are data structures with codes, severity, evidence, and related entities.
- Unknown or unavailable data is not interpreted as false.

## Initial operations

- Generate a baseline scenario from recommended term positions.
- Clone a scenario.
- Place, move, or remove a course.
- Calculate credits per term and across the scenario.
- Evaluate required-course, choose-N, minimum-credit, and term-load rules.
- Serialize and restore a portable scenario.

## Extension path

Future requirements include elective credit bands, minimum levels, ordered sequences, exclusions, campus and offering constraints, timetable collisions, exchange terms, waivers, and institution-specific rule plugins.

The kernel should eventually support deterministic candidate generation and optional solver-backed optimization. A solver may propose scenarios, but the canonical evaluator remains responsible for explaining whether a scenario satisfies the programme model.
