# Local Development

Pod Tracker is in a side-by-side rewrite period.

- Rust V1 remains the production reference in `crates/`.
- The TypeScript/Next.js rewrite lives in `apps/web`.
- Do not delete or destabilize Rust V1 until the replacement covers the
  core flows and cutover is approved.

## TypeScript Rewrite

Use pnpm from the repo root:

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
```

The root pnpm workspace includes `apps/web`. The web app uses Next.js App
Router, TypeScript strict mode, Tailwind CSS, Radix primitives,
`lucide-react`, Motion, Vitest, Testing Library, and Playwright.

The local development server defaults to:

```text
http://localhost:3000
```

The Playwright smoke server uses:

```text
http://127.0.0.1:3100
```

Health probes:

```text
/healthz
/readyz
```

`next build` must fail on TypeScript errors. Keep `ignoreBuildErrors:
false` in `apps/web/next.config.ts`.

## Motion Rule

Motion is available for focused transitions that clarify state changes:
selection, counter changes, route-level panel changes, confirmations, and
recoverable error states. Do not use motion to slow repeated life-counter
taps or to decorate otherwise static planning pages.

## Docker Compose Direction

The TypeScript target uses Docker Compose for local and self-hosted
service orchestration. Add services when they have a product integration:

- PostgreSQL for Drizzle schema and app data.
- Valkey for rate limiting and later queues.
- MinIO for S3-compatible object storage when static assets are not
  enough.
- Umami for respectful analytics.
- GlitchTip or a Sentry-compatible endpoint for error reporting.

Do not wire optional services into runtime code before the app uses them.
Keep app runtime database credentials separate from migration/admin
credentials.

## Drizzle Direction

Drizzle migrations are the target schema history for the TypeScript app.
SQLx migrations remain the Rust V1 schema history until cutover.

The rewrite schema now lives in `apps/web/src/db/schema`. The generated
Drizzle migration history lives in `apps/web/src/db/migrations`.
Development seed data lives in `apps/web/src/db/seed.ts` and uses only
fake `example.test` identities, synthetic locations, and hashed fake
event-token values. Database helpers now include scoped event-planning
reads plus token-scoped public-safe event and guest RSVP aggregate reads.
The read-only public invite route at
`/invites/events/[inviteToken]` now calls the public-safe event API and
does not expose host addresses, location notes, RSVP notes, emails, raw
tokens, token hashes, or guest names. Authenticated RSVP flows, guest RSVP
writes, address disclosure, and event mutations are still intentionally
unimplemented.

When Drizzle exists, test migrations against real PostgreSQL through the
documented Docker Compose workflow:

```sh
pnpm db:check
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm db:test
```

`pnpm db:test` also runs an in-memory migration smoke with PGlite so
constraint, index, and cascade coverage can run on machines where Docker
or `psql` is not installed. That does not replace the Docker/PostgreSQL
gate before persistence features are claimed complete.

## Rust V1 Development

Observed local baseline on 2026-05-17:

```text
rustc 1.95.0
cargo 1.95.0
PostgreSQL server 17.9 Homebrew
psql 17.10 Homebrew
```

The committed `rust-toolchain.toml` pins Rust 1.95.0 with `rustfmt` and
`clippy`.

Copy `.env.example` to `.env` and edit values for local credentials. The
example file contains no secrets.

```sh
cp .env.example .env
```

Default local Rust database URL:

```text
postgres://pod_tracker:pod_tracker@localhost:5432/pod_tracker?sslmode=disable
```

The first Rust migration creates extensions. `pg_stat_statements` usually
requires an admin/superuser role, so set
`POD_TRACKER_MIGRATION_DATABASE_URL` to a local admin connection string if
the app role cannot create it.

Useful Rust commands:

```sh
just run
just worker
just migrate-status
just migrate-up
just migrate-down
just migrate-smoke
just sqlx-migrate-smoke
```

The Rust web server defaults to `http://localhost:8080`. With no
`POD_TRACKER_DATABASE_URL`, `/healthz` can still report process health
and `/readyz` reports that database readiness cannot be proven.

Use the Rust workspace gate when touching Rust code:

```sh
just fmt
just check
just test
```

SQLx query macros inspect the database named by `DATABASE_URL` during
compile checks. If the long-lived local `pod_tracker` database is stale
or the app role cannot introspect the `core` and `ops` schemas, run the
gate against a freshly migrated temporary database instead of changing
production-like credentials.
