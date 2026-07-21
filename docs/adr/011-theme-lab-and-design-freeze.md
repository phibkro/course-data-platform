# ADR-011: Theme lab, personal appearance, and design freeze

## Status

Accepted.

## Context

The application now has a shadcn-style Base UI foundation, Tailwind CSS 4, Material 3 semantic tokens, and a semantic Phosphor icon layer. Before deeper programme and catalogue work, we want one bounded way to inspect alternate visual directions and preserve a user's preferred schedule palette.

Unbounded visual iteration would delay proving the product's core value: programme discovery, course browsing, and study-roadmap planning.

## Decision

The product ships a small Theme Lab that controls four serializable dimensions:

- base surface colour;
- primary theme colour;
- chart/schedule palette;
- light, dark, or system appearance.

The checked-in default is:

- base: Mist;
- theme: Emerald;
- chart: Indigo;
- appearance: System.

Preferences are validated, stored locally, exportable as JSON, and applied through semantic CSS variables. Product components do not read concrete colour values.

The shadcn CLI remains available for developer experimentation through `preset resolve`, `preset open`, and theme-only `preset apply`. Applying a CLI preset requires reviewing the resulting source diff before committing it.

The chart palette is deliberately separate from the application accent. It may later be stored per planning scenario so students can visually distinguish alternative schedules without changing the whole application theme.

## Consequences

- Theme changes do not rewrite product components.
- The app can offer appearance personalization without authentication.
- Schedule visualization colours have a stable future storage boundary.
- Base UI and Material semantic roles remain the interaction and token substrates.
- Design-system expansion is frozen after this slice unless a functional requirement exposes a concrete gap.

## Design-freeze exit criteria

Further visual-system work requires one of:

- an accessibility defect;
- a functional workflow blocked by a missing primitive;
- measured readability or performance evidence;
- a new chart/graph requirement that cannot use existing semantic tokens.

The next development work returns to evidence-backed programmes, real course data, and planner utility.
