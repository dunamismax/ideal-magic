# Pod Tracker Web

Next.js App Router application for the TypeScript rewrite.

Run from the repo root:

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:check
pnpm db:test
```

Local infrastructure lives in the root `compose.yaml`.

```sh
docker compose up -d postgres valkey minio
docker compose --profile analytics up -d umami
docker compose --profile errors up -d glitchtip
```

Use `docker-compose` with the same arguments if this machine has the
standalone Compose binary instead of Docker Compose v2.

Drizzle schema and migrations live under `src/db`. Generate and check the
TypeScript rewrite schema from the repo root:

```sh
pnpm db:generate
pnpm db:check
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm db:test
```

Set `POD_TRACKER_MIGRATION_DATABASE_URL` for migration/admin work and
`POD_TRACKER_DATABASE_URL` for app runtime database access. The seed
command is idempotent and inserts only fake `example.test` identities,
synthetic playgroup planning data, and a clearly fake location.

This app is intentionally side-by-side with the Rust V1 workspace until
the TypeScript core flows are implemented, verified, and approved for
cutover.
