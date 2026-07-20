# ADR-002: Elysia as provisional HTTP transport

## Status

Provisional pending a Cloudflare acceptance suite.

## Decision

Use Elysia for explicit request/response schemas, OpenAPI generation, and Eden first-party contracts. Keep Elysia confined to the transport package. Hono remains the fallback if the experimental Cloudflare adapter fails runtime, bundle, cold-start, or tooling requirements.
