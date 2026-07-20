# ADR-005: Bun and native TypeScript 7

## Status

Accepted.

## Context

The platform favors fast feedback, explicit package contexts, and compatibility with Elysia, Vite, Cloudflare Workers, and agent-driven development. TypeScript 7 is now the stable Go-based compiler, but it does not expose the legacy programmatic compiler API in 7.0. Some ecosystem tools may still require that API.

## Decision

- Bun 1.3.14 is the canonical package manager and command runner.
- Bun uses the isolated linker to expose undeclared dependencies.
- TypeScript 7.0.2 is installed under `@typescript/native` and provides the authoritative `tsc` binary.
- `@typescript/typescript6` is installed through the `typescript` dependency name so tools that import the legacy compiler API remain compatible; it also provides `tsc6`.
- Full validation runs both compilers over the same explicit list of package configurations.
- The shared TypeScript configuration declares no ambient type packages. Each application or infrastructure package declares its runtime types explicitly.
- Vite/Rolldown, Vitest, and Wrangler retain their existing responsibilities; adopting Bun does not change the production Cloudflare runtime.

## Consequences

The default type-check is substantially faster, and accidental ambient dependencies are caught earlier. The repository carries one additional compatibility compiler until TypeScript 7 exposes a stable programmatic API and the relevant toolchain no longer needs TypeScript 6. Validation is intentionally slower than the default developer check because it executes both compilers.
