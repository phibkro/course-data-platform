# Translation contributions

The student interface supports English (`en`) and Norwegian Bokmål (`nb`).
Interface language is explicit `lang` URL state with a validated local
preference; English is the fallback.

## Improving a translation

Interface messages live in
`apps/student-web/src/i18n.ts`. A translation-only pull request should change
string values in the relevant catalogue and avoid interaction, styling, source,
or model changes.

Before opening a pull request:

```sh
bun run i18n:check
bun run --cwd apps/student-web test -- i18n.test.ts scene.test.ts
```

The validator rejects missing or unknown semantic keys and mismatched
interpolation variables. TypeScript also checks that first-party catalogues have
the same complete key set.

Use the following tone:

- concise and student-facing;
- ordinary university terminology rather than literal word-for-word English;
- preserve course codes, source names, and official institutional terms;
- keep accessible names equivalent to the visible action;
- do not translate or rewrite prose received from NTNU, HK-dir, grades.no, or
  another source.

Source prose remains in its observed language because silently translated text
could be mistaken for an official source statement. A future translated source
view must retain the original wording and attribution.

## Adding a locale

Use a valid BCP 47 locale identifier, add a complete catalogue, register its
`Intl` locale tag and display name, and add one localized Explore and Inspect
scene. Locale selection must remain URL-backed application state; do not add
global mutable language state.
