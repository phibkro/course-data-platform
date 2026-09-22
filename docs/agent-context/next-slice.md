# Active vertical slice: feedback exposure and repeat-use evidence

> Product contract: [`../product/course-decision-contract.md`](../product/course-decision-contract.md)
> Shipped capability: [`../../README.md`](../../README.md)
> Verification evidence: [`../../VALIDATION.md`](../../VALIDATION.md)

## Current status

The application code supports a contextual feedback row on course details and
comparison. `VITE_FEEDBACK_URL` controls the row. The application shows the
row only when the value is a valid HTTPS URL. `.env.example` documents the
variable.

Production does not set `VITE_FEEDBACK_URL`. A production browser check on
2026-09-23 found no feedback prompt or link on course details. Therefore, the
feedback mechanism is not exposed to students. No feedback channel or
repeat-use evidence is recorded.

Git contains the history of delivered slices. The README owns the current list
of shipped capabilities. Do not copy that list into this file.

## Goal

Learn whether the shipped decision support changes student behavior. Collect
feedback where students inspect or compare courses. Use repeat use as the first
product-validation signal.

## Required path

| Step | State |
|---|---|
| Implement an HTTPS-gated feedback row on course details and comparison | Delivered |
| Document `VITE_FEEDBACK_URL` | Delivered |
| Select one operator-owned HTTPS channel | Not configured |
| Set the production variable and deploy | Not configured |
| Verify both production decision screens | Pending deployment |
| Record the channel and repeat-use evidence in `VALIDATION.md` | Pending exposure |

Use one static HTTPS link. Do not add accounts, analytics SDKs, backend storage,
or modal prompts.

## Exposure acceptance

The feedback mechanism is exposed only when all these conditions are true:

1. Production has an operator-owned `VITE_FEEDBACK_URL` value.
2. Course details show the feedback link.
3. Comparison shows the same feedback link.
4. `VALIDATION.md` names the monitored channel and the exposure date.

## Success criteria

The slice succeeds only when the validation ledger records at least two of
these signals:

1. The same voluntary identifier appears in the channel in more than one week.
2. Submissions arrive in at least three calendar weeks after the release week.
3. A student reports a later save, compare, or decision journey after earlier feedback.

If none of these signals appear after an honest exposure period, stop decision
feature expansion and revisit the product premise.

## Product gate

Programme compatibility and planning stay deferred until repeat-use evidence
meets the success criteria. Authentication, cross-device sync, full catalogue
replication, scheduled ingestion, second-institution support, and discretionary
design-system expansion also stay deferred.

ADR-011 continues to freeze discretionary theme work. Use the existing Material
You tokens and Foldkit primitives.
