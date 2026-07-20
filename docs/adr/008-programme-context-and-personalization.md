# ADR-008: Programme context, capability degradation, and optional identity

- Status: Accepted
- Date: 2026-07-20

## Context

Faculty and department navigation reflects institutional administration rather than student intent. Most students know or are considering a programme. Different institutions expose different levels of programme, curriculum, enrolment, and progression data.

## Decision

Programme selection is the primary context for ordinary users. Institution, faculty, and department remain available as advanced filters.

Programme-course relations retain their semantics and authority:

- required in official plan;
- elective in official plan;
- recommended in official plan;
- explicitly permitted;
- primary reporting programme;
- historically taken by programme students;
- inferred or semantically similar.

These relations must never be collapsed into one `available` boolean.

Institution adapters publish a capability manifest. The UI degrades explicitly when formal curriculum or student context is unavailable.

Personal context is manual and local-first:

- institution and programme;
- cohort and specialisation;
- completed, attempted, and current courses;
- scenarios, bookmarks, and preference lenses.

Feide is optional. Basic OIDC may provide identity and home institution. Where `groups-edu` and the institution's FS integration are available, programme, cohort, field, and current-course groups may populate the study context. Manual correction and anonymous use remain fully supported.

Direct Studentweb scraping is out of scope. Richer progression or result data must use approved Feide/FS interfaces and explicit user consent.

## Consequences

Authentication enhances context but is not the product gate. Institution capability differences become visible product information rather than hidden failures.
