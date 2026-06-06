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
As Postgres, Valkey, object storage, analytics, and error reporting
become required runtime dependencies, readiness should check only the
services required to serve user traffic safely.

## Backup And Restore

Backups are sensitive production data and must stay outside the
repository. The scripts under `deploy/scripts/` use
`POD_TRACKER_DATABASE_URL` for backup and
`POD_TRACKER_RESTORE_DATABASE_URL` for restore targets.

Run restore drills only against non-production databases unless Stephen
has approved a production maintenance window and a specific recovery
plan.

Local drill outline:

1. Create a non-production source database.
2. Apply Drizzle migrations.
3. Insert non-sensitive marker data.
4. Take a backup.
5. Restore into a second non-production database.
6. Re-run migrations.
7. Verify readiness-critical tables, Drizzle migration history, and the
   marker data.
