# Workbench and declarative views

## Principle

A workbench view is a serializable projection specification, not arbitrary executable UI code. It selects kernel entities, traverses typed relations, applies filters and ranking, and chooses a presentation.

## Planned view definition

A definition will contain:

- source entity and dataset revision;
- canonical filters;
- relation traversal steps;
- grouping and sorting;
- selected fields;
- visualization type;
- saved parameters;
- provenance-display policy.

## Built-in projections

- Course browser
- Programme roadmap
- Programme comparison matrix
- Workload and assessment view
- Prerequisite map
- Grade-risk view
- Data freshness and provenance explorer

## Custom views

A user or agent should eventually be able to express:

> Show English-taught spring electives available to my programme, grouped by subject area and sorted by assessment workload.

The agent creates a validated view specification. It does not generate untrusted application code.

## MVP

The current Workbench projection exposes the programme, scenario, evaluation, relation authority, and complete JSON representation. Query building and multiple visualization types come after the programme-roadmap interaction is validated.
