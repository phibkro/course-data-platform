# ADR-004: VoidZero toolchain

## Status

Accepted, with an environment-specific bootstrap exception.

## Decision

The target command surface is Vite+ with Vite, Vitest, Oxlint, Oxfmt, Rolldown, and the native TypeScript 7 compiler. The current scaffold exposes the underlying tools directly because this execution environment's npm proxy repeatedly failed to resolve Vite+ platform packages. No application architecture depends on that exception; adopting `vp` later only changes the command surface and root configuration.
