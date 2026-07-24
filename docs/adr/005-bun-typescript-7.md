# ADR-005: Bun and native TypeScript 7

## Status

Accepted.

## Context

The platform favors fast feedback, explicit package contexts, and compatibility with Elysia, Vite, Cloudflare Workers, and agent-driven development. TypeScript 7 is the stable Go-based compiler used by the repository.

## Decision

- Bun 1.3.14 is the canonical package manager and command runner.
- Bun uses the isolated linker to expose undeclared dependencies.
- TypeScript 7.0.2 is installed under `@typescript/native` and provides the sole authoritative `tsc` binary.
- The TypeScript 6 package remains installed only to satisfy current ecosystem
  peer and programmatic-API expectations; repository scripts never execute it.
- Full validation runs TypeScript 7 over the explicit list of package configurations.
- The shared TypeScript configuration declares no ambient type packages. Each application or infrastructure package declares its runtime types explicitly.
- Vite/Rolldown, Vitest, and Wrangler retain their existing responsibilities; adopting Bun does not change the production Cloudflare runtime.

## Consequences

Type-checking stays fast, accidental ambient dependencies are caught early,
and the compatibility package is no longer treated as an oracle whose
differences can override the TypeScript 7 result.
