#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v sops >/dev/null 2>&1; then
  echo "sops is required to deploy" >&2
  exit 1
fi

# Decrypted dotenv bytes flow only through the pipe into the deploy process's
# environment. Plaintext is never written to disk or emitted by this wrapper.
sops -d --output-type dotenv secrets/cf-deploy.env | bash -ceu '
  set -a
  source /dev/stdin
  set +a
  : "${CF_RUN_TOKEN:?CF_RUN_TOKEN is required}"
  : "${CF_ALCHEMY_PASSWORD:?CF_ALCHEMY_PASSWORD is required}"
  export COURSE_DATA_RUN_TOKEN="$CF_RUN_TOKEN"
  export ALCHEMY_PASSWORD="$CF_ALCHEMY_PASSWORD"
  unset CF_RUN_TOKEN CF_ALCHEMY_PASSWORD
  exec bunx alchemy deploy alchemy.run.ts
'
