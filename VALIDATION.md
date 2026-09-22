# Validation report

Validated on 2026-09-23 for the consolidated course-decision product.

This file records verification evidence. [`README.md`](README.md) and
[`docs/product/course-decision-contract.md`](docs/product/course-decision-contract.md)
own the product description and intended student tasks.

## Student journeys

`bun run test:journeys` exercised seven named journeys in real Chromium:

1. `GJ-01` — find a plausible course through search and refinement, then open Inspect with the keyboard;
2. `GJ-02` — inspect assessment uncertainty through the real local HTTP/API/DTO/client/Foldkit path;
3. `GJ-03` — continue and save while outcome evidence is unavailable rather than treating it as zero;
4. `GJ-04` — save, annotate, reload, remove, and confirm the immediate result without an account;
5. `GJ-05` — label a shortlist and apply Any, All, Exclude, and Unlabeled collection rules;
6. `GJ-06` — inspect, save two courses, annotate and label one, compare differences, and reload;
7. `GJ-07` — preserve corrupt or future local state until explicit recovery, then exercise mobile EN/NB rendering.

The run passed **7/7 journeys** in 9.9 seconds. Fixture desktop, mobile, and deterministic real-HTTP projects include keyboard, responsive-overflow, and axe checks at meaningful journey checkpoints. No external provider network is required.

## Seam and architecture checks

`bun run validate` regenerated OpenAPI and passed formatting, lint, localization, TypeScript 7, Vitest, and the executable architecture boundaries:

```text
Test Files  15 passed (15)
Tests       117 passed (117)
Duration    1.15 s
```

The reduced suite separates four kinds of evidence:

- constrained `fast-check` properties for fact/evidence states, parser corruption, reconciliation order, partial success, cache coalescing, bounded concurrency, saved-state transitions, collection algebra, URL round trips, and comparison cardinality;
- captured provider fixtures for NTNU and grade-source language and response semantics;
- Foldkit transition and semantic Scene tests for loading, empty, partial, failed, persistence, and stale-response behavior;
- eight architecture invariants for explicit clocks, transport persistence boundaries, semantic colour roles and contrast, active workspaces, and dependency direction.

Generated properties do not replace captured semantic examples. Browser journeys do not replace provider-boundary qualification.

## Production build

`bun run build` passed the TypeScript 7 check and produced both deployable applications:

```text
course-api Worker dry run: 1416.10 KiB / gzip 269.61 KiB
student-web entry JavaScript: 718.85 KiB / gzip 192.46 KiB
student-web CSS: 77.98 KiB / gzip 13.90 KiB
```

Vite reports the existing advisory that the student-web JavaScript chunk exceeds 500 kB before gzip. The warning does not fail the build; no runtime behavior was changed to conceal it.

## Current boundary

The verified value loop is:

```text
Explore → Inspect attributed evidence → Save / annotate / label locally → Compare
```

The shipped product also has two local decision-support surfaces:

- Schedule shows dated NTNU activities for saved courses by ISO week.
- Progress imports local result history and supports manual results, trends, and local backup.

Programme planning, authentication, cross-device synchronization,
recommendations, persistent named collections, full offline factual caching,
and second-institution support remain outside the shipped product boundary.

## Product validation

The application contains a contextual feedback row for course details and
comparison. `VITE_FEEDBACK_URL` controls the row and rejects non-HTTPS values.

Production does not currently set `VITE_FEEDBACK_URL`. Therefore, production
does not show a feedback link. No feedback channel or repeat-use evidence is
recorded yet.

The next validation step is to configure one operator-owned HTTPS channel.
Then verify the link on both decision screens and record the channel here.
