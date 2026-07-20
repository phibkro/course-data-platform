#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bun run check:types
bun run --cwd apps/ingest-worker build
bun run --cwd apps/web build
bun run --cwd apps/api-worker build
