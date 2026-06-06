# Local Development

Pod Tracker's supported app lives in `apps/web`.

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

## Docker Compose

Docker Compose is used for local and self-hosted service orchestration.
Add services only when they have a product integration:

- PostgreSQL for Drizzle schema and app data.
- Valkey for rate limiting and later queues.
- MinIO for S3-compatible object storage when static assets are not
  enough.
- Umami for respectful analytics.
- GlitchTip or a Sentry-compatible endpoint for error reporting.

Do not wire optional services into runtime code before the app uses them.
Keep app runtime database credentials separate from migration/admin
credentials.

The Compose PostgreSQL service publishes to `localhost:55432`:

```sh
docker compose up -d postgres
```

## Drizzle

Drizzle migrations are the schema history. The schema lives in
`apps/web/src/db/schema`. Generated migrations live in
`apps/web/src/db/migrations`.

Development seed data lives in `apps/web/src/db/seed.ts` and uses only
fake `example.test` identities, synthetic locations, and hashed fake
event-token values.

Test migrations against real PostgreSQL through the documented Docker
Compose workflow:

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
