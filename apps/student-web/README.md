# Student web

The first Foldkit walking skeleton lets an anonymous student search `TDT4136`
and inspect a `CourseInsightResponse` through explicit idle, loading, success,
partial, and failure states.

Set `VITE_API_URL` to the course API origin. The client requests
`GET /v1/courses/:courseCode/insight` and validates the response against the
frozen contract before it enters the Foldkit model.

Development uses the checked-in partial-result fixture when no API URL is
provided. Production builds never opt into the fixture implicitly; set
`VITE_USE_FIXTURE=true` explicitly only for a fixture-backed preview.

```sh
bun run dev
bun run typecheck
bun run test
bun run build
```
