# Student web

The Foldkit application lets an anonymous student browse the live NTNU
catalogue, scan independently loaded HK-dir grade signals, and inspect an
evidence-backed `CourseInsightResponse`. Catalogue, enrichment, detail, and
failure states remain explicit in the model.

Set `VITE_API_URL` to the course API origin. The client validates search, batch
grade-summary, and course-detail responses against the public contracts before
they enter the Foldkit model.

Development uses the checked-in partial-result fixture when no API URL is
provided. Production builds never opt into the fixture implicitly; set
`VITE_USE_FIXTURE=true` explicitly only for a fixture-backed preview.

Production output is an installable PWA. The service worker caches only the app
shell and same-origin static assets. API requests are never cached by the
service worker, so stale course evidence is not presented as live data. Phones
use bottom navigation; tablet and desktop viewports use the sidebar. A minimum
height condition keeps landscape phones on bottom navigation.

```sh
bun run dev
bun run typecheck
bun run test
bun run build
```
