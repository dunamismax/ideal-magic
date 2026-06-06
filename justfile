set dotenv-load := true

default:
  just --list

dev:
  pnpm --dir apps/web dev

build:
  pnpm --dir apps/web build

lint:
  pnpm --dir apps/web lint

typecheck:
  pnpm --dir apps/web typecheck

test:
  pnpm --dir apps/web test

test-integration:
  pnpm --dir apps/web test:integration

test-e2e:
  pnpm --dir apps/web test:e2e

check:
  git diff --check
  pnpm --dir apps/web typecheck
  pnpm --dir apps/web lint
  pnpm --dir apps/web test

db-check:
  pnpm --dir apps/web db:check

db-migrate:
  pnpm --dir apps/web db:migrate

db-seed:
  pnpm --dir apps/web db:seed

db-test:
  pnpm --dir apps/web db:test

caddy-validate:
  #!/usr/bin/env bash
  set -euo pipefail
  if ! command -v caddy >/dev/null 2>&1; then
    echo "caddy CLI is required for Caddyfile validation." >&2
    exit 127
  fi
  caddy validate --adapter caddyfile --config deploy/caddy/Caddyfile

backup-restore-drill:
  deploy/scripts/backup-restore-drill.sh
