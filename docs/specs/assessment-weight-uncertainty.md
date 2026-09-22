# Preserve assessment-weight uncertainty in Inspect

Status: frozen

## Student journey

A student opens a course whose structured ordinary assessment components have
invalid total weights, while its assessment prose still supports recognizable
forms. Inspect retains those inferred forms and explains why their weights are
unknown. It must not imply that the invalid percentages were accepted or that
the independently supported forms are invalid.

This is a bounded correction to
[`scan-and-persist-design.md`](../product/scan-and-persist-design.md), not a new
assessment model or a broader enrichment project.

## Contract

- Carry the parser's structured-assessment unavailability reason into the
  fallback components' unknown weight facts, with the source evidence reference.
- Preserve prose-derived forms and their inference attribution.
- Inspect displays the weight fact's uncertainty state and reason when no known
  percentage is available. Known percentages retain their existing display.
- Keep ordinary missing-weight reasons visible through the same fact boundary;
  do not special-case a string containing a particular total.
- Reuse the existing Fact/DTO shapes, mapper, Foldkit rendering, semantic styles,
  translations, and test tooling. No stack changes or deployment.

## Falsifiers and verification

1. Parse ordinary project/oral components weighted 60% + 60% with supporting
   prose. Both signals and insight retain the forms, reject known weights, and
   retain the exact 120%-total rejection reason and source evidence.
2. Inspect shows that reason alongside the forms and an unknown-weight label;
   no accepted 60% weight is rendered. A valid 60% + 40% control remains known.
3. Run the focused mapper and Foldkit scene tests, repository checks, and a
   local real-browser Inspect journey at desktop and 375px widths where tools
   permit. The browser uses real HTTP and the real API/DTO/client/render path
   with explicitly marked synthetic source evidence; it does not claim a live
   NTNU observation. Check the new rendered state with the existing Axe tool.
4. Record unavailable checks separately from product failures. Commit and
   verify the exact source from a clean worktree; leave operator edits intact.

Commands: `bun run validate`, `bun run build`, and `bun run test:journeys`. On
NixOS, select the installed browser with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
as in the golden journey suite.
