set shell := ["bash", "-uc"]

setup:
  bun install --frozen-lockfile

check:
  bun run check

test:
  bun run test

build:
  bun run build

validate:
  bun run validate

dev-web:
  bun run dev:web

dev-api:
  bun run dev:api

openapi:
  bun run openapi

dev:
  bun run dev

preview:
  bun run dev:preview
