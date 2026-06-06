# Operations

Pod Tracker is a self-hosted TypeScript/Next.js application backed by
PostgreSQL. Production actions still require Stephen's explicit approval
before deploying, migrating, restarting services, changing Caddy or
Cloudflare, sending messages, or accessing private production data.

## Target Shape

```text
Cloudflare DNS or Cloudflare Tunnel
  -> Caddy
  -> Next.js web service
  -> PostgreSQL
  -> optional Valkey
  -> optional MinIO
  -> optional Umami
  -> optional GlitchTip or Sentry-compatible endpoint
```

PostgreSQL remains the source of truth. Valkey, MinIO, Umami, and error
reporting should be added when the app has real integration points for
rate limiting, queues, object storage, analytics, or error capture.

Keep runtime credentials separate from migration/admin credentials. Never
commit production environment values, database URLs, invite tokens,
private Caddy fragments, Cloudflare tokens, analytics credentials, error
reporting DSNs, database dumps, backups, or production logs.

## Docker Compose

Docker Compose is the local and self-hosted service orchestration path.
The current root `compose.yaml` provides PostgreSQL and optional Valkey,
MinIO, Umami, and GlitchTip services.

```sh
docker compose up -d postgres
docker compose --profile optional up -d valkey minio
docker compose --profile analytics up -d umami
docker compose --profile errors up -d glitchtip
```

Optional services should stay behind profiles or clear documentation so a
minimal local app can run without every service.

For production-shaped self-hosting, run the Next.js app as the web
service with `NODE_ENV=production`, `HOSTNAME=127.0.0.1`, `PORT=3000`,
and the placeholder-only environment shape in
`deploy/env/production.env.example`. Build and start from `apps/web`:

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/web build
pnpm --dir apps/web start
```

PostgreSQL is required for cutover traffic. Valkey is required when
production rate-limited routes are enabled. MinIO is optional until the
app stores runtime objects outside the database/static assets. Umami and
GlitchTip/Sentry-compatible reporting are optional observability
endpoints and are disabled when their environment variables are unset.
Caddy should be the public reverse proxy in front of the local Next.js
service.

## Caddy And Cloudflare

The checked-in Caddyfile is a production-shape example that proxies to a
local Next.js service on `127.0.0.1:3000`. Validate it locally before
production use:

```sh
caddy validate --adapter caddyfile --config deploy/caddy/Caddyfile
```

Cloudflare DNS/proxy or Tunnel changes require explicit approval. Do not
commit Cloudflare tokens, Tunnel credentials, private hostnames, or
private origin details.

## Health And Readiness

The app exposes:

```text
/healthz
/readyz
```

These endpoints should prove the process and the route handler are alive.
`/healthz` is a cheap liveness check and reports whether the required
database URL is configured. `/readyz` checks Next.js route readiness plus
a PostgreSQL `select 1`; it returns `503` when the database URL is
missing or PostgreSQL is unavailable. Valkey, object storage, analytics,
and error reporting stay out of readiness until they are required to
serve cutover traffic safely.

## Backup And Restore

Backups are sensitive production data and must stay outside the
repository. The scripts under `deploy/scripts/` use
`POD_TRACKER_DATABASE_URL` for backup and
`POD_TRACKER_RESTORE_DATABASE_URL` for restore targets.

Run restore drills only against non-production databases unless Stephen
has approved a production maintenance window and a specific recovery
plan.

Use `pg_dump` and `pg_restore` from the same PostgreSQL major version as
the target server, or a newer compatible client. The current Compose
PostgreSQL service is version 18; PostgreSQL 17 client tools will not run
the local drill against it.

Local drill outline:

1. Create a non-production source database.
2. Apply Drizzle migrations.
3. Insert non-sensitive marker data.
4. Take a backup.
5. Restore into a second non-production database.
6. Re-run migrations.
7. Verify readiness-critical tables, Drizzle migration history, and the
   marker data.
