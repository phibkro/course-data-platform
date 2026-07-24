#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bun run check:types
bun run --cwd apps/course-api build
bun run --cwd apps/student-web build
