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
```

Local infrastructure lives in the root `compose.yaml`.

```sh
docker compose up -d postgres valkey minio
docker compose --profile analytics up -d umami
docker compose --profile errors up -d glitchtip
```

Use `docker-compose` with the same arguments if this machine has the
standalone Compose binary instead of Docker Compose v2.

This app is intentionally side-by-side with the Rust V1 workspace until
the TypeScript core flows are implemented, verified, and approved for
cutover.
