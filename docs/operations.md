# Operations

Pod Tracker is in a side-by-side rewrite period. The Rust deployment is
the live production shape until the TypeScript app is complete, verified,
and approved for cutover.

Production actions still require explicit approval before deploying,
migrating, restarting services, changing Caddy or Cloudflare, or
accessing private production data.

## Current Rust V1 Shape

```text
Cloudflare DNS
  -> Ubuntu VM
  -> Caddy
  -> pod-tracker-web
  -> pod-tracker-worker
  -> PostgreSQL service
```

Current paths:

```text
/opt/pod-tracker/releases/       immutable release directories
/opt/pod-tracker/current         symlink to active release
/etc/pod-tracker/env             production environment file
/var/lib/pod-tracker             app-owned durable files if needed
/var/log/pod-tracker             app logs if file logging is added later
/var/backups/pod-tracker         PostgreSQL dump files
```

The checked-in Rust deploy assets under `deploy/` remain valid for V1.
Do not remove systemd, Caddy, backup, restore, or Rust deployment files
until the TypeScript production cutover is approved and stable.

## Future TypeScript Shape

Target production shape:

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
reporting DSNs, database dumps, or production logs.

## Docker Compose Direction

The TypeScript deployment target uses Docker Compose for local and
self-hosted service orchestration. Compose should eventually cover:

- `web`: the Next.js app.
- `postgres`: the app database.
- `valkey`: cache, rate limiting, and later queue support.
- `minio`: S3-compatible object storage when needed.
- `umami`: respectful analytics without private payloads.
- `glitchtip` or equivalent Sentry-compatible service for error
  reporting.
- `caddy`: reverse proxy and TLS boundary.

Optional services should use profiles or clear documentation so a minimal
local app can run without every service.

## Caddy And Cloudflare

Caddy should proxy to the Next.js service only after the TypeScript
service has health checks and a verified non-production deployment.
Cloudflare DNS/proxy or Tunnel changes require explicit approval.

Future Caddy config must be validated locally before production use:

```sh
caddy validate --config deploy/caddy/Caddyfile
```

Do not commit Cloudflare tokens, Tunnel credentials, real hostnames beyond
publicly intended names, or private origin details.

## Health And Readiness

The TypeScript app exposes:

```text
/healthz
/readyz
```

At scaffold time these prove the Next.js process and route handler are
alive. As Postgres, Valkey, object storage, analytics, and error reporting
become required runtime dependencies, readiness should check only the
services required to serve user traffic safely.

## Backup And Restore

Rust V1 backup and restore scripts remain under `deploy/scripts/`.
Backups are sensitive production data and must stay outside the
repository.

The TypeScript deployment shape needs a fresh backup and restore drill
before production cutover:

1. Create a non-production database.
2. Apply Drizzle migrations.
3. Insert non-sensitive marker data.
4. Take a backup through the future compose/Postgres backup path.
5. Restore into a second non-production database.
6. Re-run migrations.
7. Verify readiness-critical tables, migration history, and marker data.

## Rust V1 Deploy Reference

Run from a clean checkout on the VM only with approval:

```sh
sudo deploy/scripts/deploy.sh
```

The Rust deploy script creates an immutable release directory, copies the
Rust workspace and deploy assets, builds `pod-tracker-web`,
`pod-tracker-worker`, and `pod-tracker-migrate` with Cargo, applies SQLx
migrations with `POD_TRACKER_MIGRATION_DATABASE_URL`, advances
`/opt/pod-tracker/current`, restarts the web and worker services, and
reloads Caddy.

Check Rust V1 health:

```sh
systemctl status pod-tracker-web.service
systemctl status pod-tracker-worker.service
curl -fsS https://pod-tracker.app/healthz
curl -fsS https://pod-tracker.app/readyz
```

Production restore requires an explicit maintenance window, a fresh
backup, stopped services, and confirmation that the target URL is the
intended database.
