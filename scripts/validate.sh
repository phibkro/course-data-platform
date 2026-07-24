#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bun run openapi
bun run fmt:check
bun run lint
bun run check:types
bun run test

printf '\nValidation completed successfully with TypeScript 7.\n'
