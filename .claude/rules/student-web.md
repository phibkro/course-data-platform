---
paths:
  - "apps/student-web/**/*"
---

# Student web

This application uses Foldkit, not React. Follow the existing message/model/
command architecture, and let one Foldkit primitive own each overlay or
collection interaction — do not mix in a second focus or collection system
inside the same tree.

The Foldkit architecture rules themselves are enforced, not described:
`@foldkit/oxlint-plugin` runs 24 `foldkit/*` rules through `bun run lint`,
covering message and command naming, submodel routing, view keying, lazy-view
stability, module-level mutable state, and route strings. Read the rule name in a
lint failure rather than inferring the convention from surrounding code.

What lint cannot check, and you must:

- Explore is useful without programme context, onboarding, an account, or
  pre-existing local state.
- Mobile primary navigation is a bottom bar; wider layouts use the sidebar. Do
  not add another equally prominent top-level navigation surface.
- URL state, remote-data state, and local preferences stay separate and explicit
  in the application model. A visual draft must not mutate persisted state before
  its explicit Apply action.
- Reuse shared projections when they preserve each surface's information purpose;
  do not force identical content into Explore, List, and Inspect.
- Build or generalize a component when a live workflow demonstrates the need, not
  to restart a design-system programme — ADR-011 still freezes discretionary
  theme work.

Appearance and localization have their own gates:

- `apps/student-web/src/styles.css` is the token source. Product components
  consume the semantic tokens; `tests/architecture.test.ts` fails on a raw colour
  literal or a Tailwind palette utility in a component.
- Interface strings live in the message catalogue. `bun run i18n:check` (part of
  `bun run check`) validates catalogue coverage — add both EN and NB.
- `bun run test:a11y` drives the real-browser axe journeys. It is a separate CI
  step, not part of `bun run check`; run it when rendered structure, focus,
  colour, or responsive behavior changes.
- Preserve keyboard, touch, focus-return, history, and non-visual semantics when
  changing an interaction. Automated checks complement that review; they do not
  replace it.

Read the relevant surface specification under `docs/product/` before changing
student-visible behavior, and check that surface's gate in the **Parallel
readiness** table in `docs/product/student-experience-contract.md`.
