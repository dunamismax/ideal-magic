# Pod Tracker

**Live self-hosted V1 URL:** [https://pod-tracker.app/](https://pod-tracker.app/)

Pod Tracker is a self-hosted Commander night operating system centered on
two product pillars:

1. The best Commander life counter on the internet.
2. Group, event, RSVP, deck declaration, pod, and game-night tracking.

The product is not a full deckbuilder, collection manager, paid SaaS
platform, native mobile app, or Moxfield replacement. Decks exist here so
players can declare what they are bringing, hosts can seat fair pods,
games can become history, and the playgroup can understand its meta over
time.

## Product Thesis

Commander groups need one durable place to answer:

- Who is playing this week?
- Where and when are we meeting?
- Who is hosting, and who can see the address?
- What decks and commanders are people bringing?
- Which pods are fair tonight?
- Which players and decks have not seen each other lately?
- What happened during the game?
- What does the group meta look like over time?

Pod Tracker is built around the live game-night loop:

1. Open a local or event-linked life counter.
2. Create or choose a playgroup.
3. Schedule an event.
4. Invite players and collect RSVPs.
5. Collect lightweight deck declarations.
6. Generate and adjust pods.
7. Log games from pods or completed counter sessions.
8. Refresh group history and meta health.

## Current Status

The existing Rust/Axum/Leptos/sqlx application is the production V1 and
remains the reference implementation until the TypeScript replacement
covers the core flows and Stephen approves cutover.

V1 supports:

- Login and sessions.
- Playgroups and memberships.
- Event creation.
- Host locations and address privacy.
- RSVPs and guests.
- Calendar export.
- Reminder jobs.
- Lightweight deck registry and event deck declarations.
- Pod generation, manual edits, locking, and publishing.
- Quick game logging.
- Basic meta dashboard.
- Scryfall import and card search.
- Health and readiness endpoints.
- Backup, restore, Caddy, and systemd deployment documentation.

## Rewrite Direction

The TypeScript rewrite starts side-by-side in `apps/web` so the Rust app
can keep running while the replacement is built and verified.

Target stack:

- Next.js App Router with React Server Components where they fit.
- React with TypeScript strict mode.
- Tailwind CSS with local design tokens.
- shadcn/ui-compatible local components, Radix primitives, and
  `lucide-react`.
- Motion for focused state transitions only.
- Better Auth for self-hosted authentication.
- PostgreSQL as source of truth.
- Drizzle ORM and Drizzle Kit for TypeScript schema history.
- Dexie over IndexedDB for offline life-counter and app state.
- Docker Compose for local and future self-hosted services.
- Caddy behind Cloudflare DNS/proxy or Cloudflare Tunnel.
- Valkey, MinIO, Umami, and GlitchTip/Sentry-compatible reporting when
  the app has real integration points.
- Vitest, Testing Library, and Playwright.

## Development Status

`BUILD.md` is the active phased roadmap for the rewrite. `AGENTS.md`
holds repo-local operating rules. Rust V1 code and SQLx migrations should
not be deleted or destabilized until equivalent TypeScript flows are
implemented, verified, and approved for cutover.

## License

MIT. See [LICENSE](LICENSE).
