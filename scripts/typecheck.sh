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
  packages/domain/tsconfig.json
  packages/course-model/tsconfig.json
  packages/course-service/tsconfig.json
  packages/application/tsconfig.json
  packages/study-kernel/tsconfig.json
  packages/contracts/tsconfig.json
  packages/database/tsconfig.json
  packages/source-dbh/tsconfig.json
  packages/source-grades/tsconfig.json
  packages/source-ntnu/tsconfig.json
  packages/source-ntnu-course/tsconfig.json
  apps/api-worker/tsconfig.json
  apps/course-api/tsconfig.json
  apps/ingest-worker/tsconfig.json
  apps/student-web/tsconfig.json
  apps/web/tsconfig.json
  tsconfig.alchemy.json
  tsconfig.json
)

printf 'Type-checking with TypeScript 7 (%s)\n' "$($BINARY --version)"
for config in "${CONFIGS[@]}"; do
  printf '  %s\n' "$config"
  "$BINARY" -p "$config" --checkers "${TS_CHECKERS:-4}"
done
