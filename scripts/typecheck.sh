#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BINARY="$ROOT/node_modules/.bin/tsc"

if [[ ! -x "$BINARY" ]]; then
  printf 'Compiler not found: %s\n' "$BINARY" >&2
  exit 1
fi

CONFIGS=(
  packages/course-contracts/tsconfig.json
  apps/course-api/tsconfig.json
  apps/student-web/tsconfig.json
  apps/student-web/tsconfig.e2e.json
  infra/tsconfig.json
  tsconfig.json
)

printf 'Type-checking with TypeScript 7 (%s)\n' "$($BINARY --version)"
for config in "${CONFIGS[@]}"; do
  printf '  %s\n' "$config"
  "$BINARY" -p "$config" --checkers "${TS_CHECKERS:-4}"
done
