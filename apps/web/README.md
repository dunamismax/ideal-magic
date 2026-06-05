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

The Compose PostgreSQL service is published on `localhost:55432` to avoid
colliding with host PostgreSQL installs or SSH tunnels on the default
`5432` port. The local migration defaults use that port.

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
synthetic playgroup planning data, hashed fake event-token values, and a
clearly fake location.

Production auth requires `BETTER_AUTH_SECRET` and an HTTPS
`BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` matching the public Caddy or
Cloudflare origin. Add comma-separated HTTPS origins to
`POD_TRACKER_TRUSTED_ORIGINS` only when the same deployment must accept
server actions or Better Auth requests through additional trusted
hostnames. Better Auth cookies are host-only, `HttpOnly`, `SameSite=Lax`,
and `Secure` in production.

SMTP2GO is the approved transactional email provider for auth email. Set
`SMTP2GO_API_KEY` and `POD_TRACKER_EMAIL_FROM` only in ignored local or
production environment files. `POD_TRACKER_EMAIL_REPLY_TO` is optional.
Better Auth uses SMTP2GO for account verification, password reset,
verification resend during unverified login, and confirmed email-change
flows. Tests use fakes and must not send real mail by default.

Set `VALKEY_URL` to a Redis-compatible Valkey endpoint to enable
production rate limiting for Better Auth writes, public guest RSVP
writes, group invites, and app-owned write actions. Local development
and tests fall back to in-memory counters when `VALKEY_URL` is unset;
production treats a missing or unavailable limiter as a request
protection failure.

Do not commit API keys, reset tokens, email contents, or private user
data. Password reset is enabled only through Better Auth's tokenized
email flow.

The database query layer includes scoped event-planning reads and
token-scoped public-safe event reads and guest RSVP writes. The public
invite route at `/invites/events/[inviteToken]` uses the public-safe event
API at `/api/public-events/[inviteToken]` for aggregate event timing,
location name, RSVP counts, guest counts, deck declaration counts, pod
counts, and logged-game counts. Guest RSVP writes are origin-checked and
return aggregate-only public data. Authenticated RSVP flows, address
disclosure, and broader Postgres event mutations are implemented through
the logged-in Game Night surfaces.

This app is intentionally side-by-side with the Rust V1 workspace until
the TypeScript core flows are implemented, verified, and approved for
cutover.
