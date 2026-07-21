# ADR-010: shadcn/Base UI design system and responsive app shell

## Status

Accepted.

## Context

The first planner slices used bespoke React controls and a top-level tab strip. That was useful for proving the kernel, but it creates three problems:

1. ordinary catalogue browsing and advanced tools appear equally prominent;
2. accessible overlay, focus, and disabled-state behaviour would be rebuilt repeatedly;
3. product components have no shared semantic token or icon boundary.

The product should remain a fast public catalogue first. Planning, saved context, provenance, and kernel inspection are progressive layers.

## Decision

The web application uses:

- shadcn/ui source-owned component conventions;
- Base UI 1.6 primitives for accessible behaviour;
- Tailwind CSS 4.3 with repository-owned Material 3 semantic tokens;
- Phosphor Icons behind semantic application icon components;
- Material Symbols Rounded as a lazily loaded fallback for concepts absent from Phosphor.

The primary responsive navigation is:

- desktop: a persistent left sidebar;
- mobile: a three-destination bottom bar for Explore, Plan, and Saved;
- advanced tools: Workbench, data status, and API documentation behind secondary navigation.

Explore is the default route and unified search surface for courses, programmes, and institutions. Programme context is optional and introduced through a contextual call to action rather than mandatory onboarding.

## Boundaries

- `components/ui` owns shadcn-style primitives.
- `components/icons` owns all icon-library imports and semantic mappings.
- `components/navigation` owns responsive navigation behaviour.
- product components consume semantic icons and UI primitives, not Base UI or Phosphor directly.
- the study kernel remains independent of the design system.

## Consequences

The component source remains inspectable and editable. Material tokens preserve product identity rather than accepting the default shadcn visual style. Base UI portals require the application root to establish an isolated stacking context.

Phosphor icons use direct client-runtime imports to avoid traversing the package's full icon barrel during Vite development. Material Symbols are not loaded on ordinary page visits; the semantic fallback component requests the font stylesheet only when rendered.

The first migration intentionally leaves complex roadmap cards and controls on their existing CSS. They can move onto the shared primitives incrementally without blocking the Explore-first shell.
