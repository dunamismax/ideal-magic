# BUILD.md

Completion roadmap for Pod Tracker. `README.md` describes the product
and `AGENTS.md` is the binding repo policy.

Last reviewed: 2026-06-05.

This file is a forward plan, not a changelog. Keep it short enough that
future agents can scan it, choose the next unfinished box, implement it,
verify it, and update only the relevant checkbox.

---

## Product Direction

Pod Tracker is the self-hosted operating system and live life counter for
Commander night. The TypeScript/Next.js app in `apps/web` is the
replacement path. The Rust/Axum/Leptos/sqlx app remains production V1
until the TypeScript app is verified and Stephen approves cutover.

Primary product pillars:

- Life Counter: fast, beautiful, offline-capable Commander tracking.
- Game Night: playgroups, events, RSVPs, decks, pods, game logging,
  history, and meta health.

Do not expand into full deckbuilding, collections, paid SaaS billing,
native mobile, AI/RAG, pgvector, proxy printing, wishlists, or broad
Scryfall exploration before the two primary pillars are complete.

Production actions still require Stephen's explicit approval:

- Deploys, production migrations, restarts, or cutover.
- Production data access, deletion, or export.
- Caddy, Cloudflare, tunnel, DNS, email, SMS, or Discord writes.

---

## Target Stack

- Next.js App Router in `apps/web`.
- React with strict TypeScript.
- Tailwind CSS, local shadcn/ui-compatible components, Radix primitives,
  and `lucide-react`.
- Motion only for focused interaction clarity.
- Better Auth.
- PostgreSQL as source of truth.
- Drizzle ORM and Drizzle Kit migrations.
- Dexie over IndexedDB for local/offline counter state.
- Docker Compose for local and self-hosted services.
- Caddy behind Cloudflare DNS/proxy or Cloudflare Tunnel.
- Valkey, MinIO, Umami, and GlitchTip/Sentry only where real product
  integration points exist.
- Vitest, Testing Library, and Playwright.

---

## Privacy And Product Boundaries

Sensitive data:

- Host addresses and location notes.
- Event notes, RSVP notes, guest names/details, emails, phone numbers,
  invite tokens, token hashes, and private contact data.
- Local life-counter notes and unsaved sessions.

Rules:

- Public/tokenized routes must use public-safe projections.
- Guests see only what their invite/event scope permits.
- Guest names render as `Guest RSVP` in participant-facing shared views
  unless a scoped private host/admin surface explicitly requires more.
- Local counter state stays local unless a scoped authenticated user
  explicitly saves or links it.
- Never claim security/privacy guarantees not proven by implementation
  and tests.

---

## Completion Definition

The TypeScript app can replace Rust V1 only when all of these are true:

- Core flows work end to end in Next.js: signup, login, group creation,
  event creation, RSVP, guest RSVP, deck declaration, pod generation,
  pod adjustment/publish, standalone life counter, event-linked counter,
  pod-linked counter, game save, history, and meta health.
- Auth, authorization, public-safe views, and sensitive-data redaction
  are covered by tests.
- Drizzle migrations run against real PostgreSQL in Docker Compose.
- The app has production-ready environment examples, Caddy config,
  backup/restore scripts, health/readiness checks, and observability
  basics without committing secrets.
- A migration/export/import plan for Rust production data is verified
  against non-production data.
- Playwright smoke coverage passes for the critical flows.
- Stephen approves the cutover plan.

---

## Completed Foundation

These phases are accepted as complete enough for the rewrite foundation.
Do not reopen them with old deferred wishlist items; move any newly
discovered required work into the remaining completion passes below.

## Phase 0 - Scope And Docs

- [x] Align repo policy around the TypeScript/Next.js replacement path.
- [x] Document the two-pillar product thesis.
- [x] Keep Rust V1 as production reference until cutover approval.
- [x] Establish `apps/web` as the side-by-side rewrite location.
- [x] Defer collection, full deckbuilder, billing, native mobile, AI/RAG,
  and broad card-search work.

## Phase 1 - TypeScript App Scaffold

- [x] Create the Next.js App Router app in `apps/web`.
- [x] Enable strict TypeScript, Tailwind, app shell styling, and local UI
  components.
- [x] Add Drizzle, Better Auth, Dexie, Vitest, Testing Library,
  Playwright, and Docker Compose scaffolding.
- [x] Add health/readiness routes and verification scripts.

## Phase 2 - Design System And App Shell

- [x] Build the primary app shell around Life Counter, Game Night,
  Groups, Decks, and History.
- [x] Provide reusable UI primitives used by the current app surfaces.
- [x] Build responsive layouts for the life counter and planning views.
- [x] Verify text fit and core responsive behavior on implemented
  surfaces.

## Phase 3 - Auth And Authorization

- [x] Integrate Better Auth with Postgres-backed identity tables.
- [x] Implement signup, login, logout, session lookup, and protected
  route redirects.
- [x] Use scoped server-side authorization for logged-in app surfaces.
- [x] Define and enforce playgroup roles in current group, event, deck,
  pod, history, and game-save flows.
- [x] Cover implemented auth behavior with unit, PGlite, and Playwright
  tests.

## Phase 4 - Drizzle Schema And Core Persistence

- [x] Model identity, playgroups, invites, events, RSVPs, locations,
  decks, declarations, pods, games, matchup history, and life-counter
  local/server persistence concepts.
- [x] Generate Drizzle migrations and PGlite-backed migration tests.
- [x] Add scoped database helpers, public-safe query paths, seed data,
  constraints, indexes, and cascade tests.
- [x] Keep sensitive fields out of public-safe and participant-facing
  projections.

## Phase 5 - Life Counter V1: Standalone

- [x] Build `/life` as a primary public route.
- [x] Support 2 to 8 players, names, colors, seats, commanders, life,
  commander damage, poison, commander tax, game counters, timers,
  active player, elimination, winner/draw/no-contest, reset, rematch,
  undo, and redo.
- [x] Store local state and action history in Dexie.
- [x] Verify reload recovery, blocked-network behavior after load,
  accessibility basics, and responsive layouts.

## Phase 6 - Life Counter V2: Event And Pod Integration

- [x] Build event-linked and pod-linked life-counter routes.
- [x] Import scoped event participants, declared decks, and published
  pod seats.
- [x] Attach standalone sessions to scoped events when authenticated.
- [x] Save completed standalone-attached, event-linked, and pod-linked
  counter results into structured game history.
- [x] Redact guest data and keep unsaved local notes/session state local.

## Phase 7 - Groups And Events

- [x] Build authenticated group creation, scoped group list, member
  directory, invite create/list/revoke/join, role management, and member
  removal.
- [x] Build authenticated event creation, edit, cancel, archive, RSVP,
  tokenized guest RSVP, and public-safe event pages.
- [x] Enforce scoped authorization and public-safe projections for the
  implemented group/event workflows.
- [x] Cover implemented group/event behavior with focused tests and
  Playwright smoke flows.

## Phase 8 - Deck Declarations

- [x] Build lightweight deck create/list/update/retire flows.
- [x] Support commander names, color identity, bracket/power, archetype,
  tags, visibility, ownership, playgroup scope, and external URLs.
- [x] Build event declaration and undeclaration flows.
- [x] Snapshot declaration metadata so later deck edits do not rewrite
  event/game history.
- [x] Keep full deckbuilder, collection, and inventory behavior out.

## Phase 9 - Pod Generation And Pod Management

- [x] Build event pod dashboards for hosts/managers.
- [x] Generate pods from RSVPs and declared decks, including odd-size
  attendance.
- [x] Score pods for size, bracket spread, repeat-player pairs,
  repeat-deck pairs, commander/deck variety, availability, and guest
  distribution.
- [x] Support manual seat movement, locked seats, publishing,
  unpublishing, participant visibility, and launch links to linked life
  counters.
- [x] Keep guest data redacted in participant-facing pod projections.

---

## Remaining Completion Passes

Work these in order unless Stephen explicitly reprioritizes. Each pass
should be small enough to implement, verify, commit, and push in one
agent session.

## Pass 1 - Production Auth And Abuse Hardening

- [x] Decide and implement password reset or explicitly document the
  self-hosted account recovery policy.
- [x] Audit Better Auth cookie/session settings for the production
  Docker/Caddy/Cloudflare shape.
- [x] Add SMTP2GO-backed transactional email for Better Auth account
  verification, password reset, signup/login confirmation, and any
  email-change flows, using env-only secrets and tests that never send
  real mail by default.
- [x] Add CSRF coverage where Better Auth does not already cover the
  app's server actions/forms.
- [x] Add Valkey-backed rate limiting for auth, invite, public RSVP, and
  write-heavy routes.
- [x] Add audit event schema, safe write helper, and records for invite
  creation/revocation, member role changes/removal, and event visibility
  changes.
- [x] Verify implemented audit-event coverage with focused
  unit/integration tests plus signup/login/logout Playwright smoke.
- [x] Add production-relevant auth audit events for Better Auth signup,
  session creation/revocation, password reset requested/completed, email
  verification requested/completed, and email change requested without
  storing emails, tokens, passwords, IPs, user agents, or raw payloads.
- [x] Add audit events for event location changes once location edit
  flows exist.

## Pass 2 - Host Locations And Event Operations

- [x] Build host location create/edit/archive flows with address
  visibility controls.
- [x] Wire event host/location selection into event create/edit.
- [x] Prove host-address disclosure rules for owner/admin/host/member,
  RSVP, guest, public-safe, and non-member viewers.
- [x] Add group edit and group archive/delete flows with safe ownership
  and last-owner behavior.
- [x] Add guest RSVP edit/cancel behavior if needed for real event use.
- [x] Add calendar export only after address visibility is tested.
- [ ] Defer reminder jobs unless a TypeScript job-runner path is chosen.

## Pass 3 - Game Logging Completeness

- [x] Add finish order beyond winner marking.
- [x] Add elimination detail, eliminated turn, and loss reason capture.
- [x] Add poison-loss and commander-damage-loss details.
- [ ] Add result editing/correction rules for managers and scoped
  participants, including audit behavior.
- [x] Update quick-log, event-linked save, pod-linked save, standalone
  attach save, history list, and detail projections for the new fields.
- [x] Preserve guest redaction and immutable deck/commander snapshots.
- [ ] Add focused PGlite, component, and Playwright coverage for actual
  game-save submissions.

## Pass 4 - Meta Health And History

- [ ] Expand `/history` into the final scoped history and meta-health
  surface without competitive leaderboards as the default emphasis.
- [ ] Add scoped playgroup and event filters.
- [ ] Add attendance, deck/commander variety, color/archetype spread,
  repeat-pairing freshness, pod-size quality, and event participation
  trends from real tables only.
- [ ] Add charts only where they improve scanning and are tested.
- [ ] Add public history views only if backed by public-safe projections
  and explicit scope decisions.
- [ ] Decide whether materialized views are needed after query shape and
  freshness needs are proven.
- [ ] Verify with PGlite metric tests, component tests, and Playwright
  smoke for history/meta.

## Pass 5 - Offline, Sync, And PWA Polish

- [ ] Persist explicitly linked counter snapshots to Postgres when useful
  for recovery or cross-device continuation.
- [ ] Preserve local Dexie action history after successful game save.
- [ ] Add conflict handling for linked sessions so reconnects never
  silently overwrite newer server state.
- [ ] Add storage cleanup controls that do not surprise-delete active
  games.
- [ ] Decide whether `/life` ships as an installable PWA for cutover; if
  yes, add manifest/service-worker behavior and verify offline launch for
  previously loaded assets.
- [ ] Add a read-only table/spectator view only if it can be scoped and
  kept fast.

## Pass 6 - Commander Lookup And Lightweight Data

- [ ] Decide whether manual commander entry is enough for cutover.
- [ ] If lookup is required, add a narrow commander lookup path without
  importing a full card research product.
- [ ] If Scryfall data is stored locally, normalize only needed fields,
  retain raw payloads in JSONB, and version Commander Brackets/Game
  Changers data.
- [ ] Verify lookup performance, privacy, and failure behavior.

## Pass 7 - Observability And Operations

- [ ] Add structured logging without sensitive payloads.
- [ ] Add GlitchTip/Sentry-compatible error reporting.
- [ ] Add Umami analytics with respectful event names and no private
  payloads.
- [ ] Add database-aware `/healthz` and `/readyz` checks for production
  dependencies actually required at cutover.
- [ ] Add production `.env.example` files with placeholders only.
- [ ] Add Caddy config for the Next.js service.
- [ ] Add Docker Compose production profile or deployment docs for
  Postgres, app, optional Valkey, optional MinIO, analytics, and error
  reporting.
- [ ] Add backup and restore scripts for the TypeScript/Postgres shape.
- [ ] Run and document a local backup/restore drill.

## Pass 8 - Migration From Rust V1

- [ ] Inventory Rust production tables and TypeScript target tables.
- [ ] Decide table-by-table migration versus typed export/import for each
  domain.
- [ ] Build idempotent migration/export/import scripts that avoid
  secrets, production logs, invite tokens, and private dumps in git.
- [ ] Verify against a non-production copy or synthetic Rust-shaped data.
- [ ] Reconcile identity/user mapping and historical game/deck/event
  snapshots.
- [ ] Produce a rollback plan before any production migration.

## Pass 9 - End-To-End Release Candidate

- [ ] Run full TypeScript unit, integration, lint, typecheck, migration,
  and Playwright suites.
- [ ] Run critical browser smoke flows: signup, login, logout, group
  create/edit, invite, event create/edit, RSVP, guest RSVP, deck create,
  deck declaration, pod generation/manual adjustment/lock/publish,
  standalone life counter, event-linked counter, pod-linked counter, game
  save, history, and meta health.
- [ ] Run responsive checks for small phone, tablet, laptop, and wide
  desktop.
- [ ] Run load/interaction checks for repeated live-counter tapping.
- [ ] Run production-like Docker Compose startup, health/readiness,
  backup, restore, and restart checks.
- [ ] Freeze Rust feature work except urgent production fixes.
- [ ] Get Stephen's explicit approval for production migration and
  cutover.

## Pass 10 - Cutover And Rust Retirement

- [ ] Execute approved production migration and deployment only after
  Stephen approval.
- [ ] Validate production signup/login, event planning, public invite,
  life counter, game save, history, and backup immediately after cutover.
- [ ] Keep rollback available until Stephen accepts the new production
  app.
- [ ] Archive or remove Rust deployment files only after the TypeScript
  production app is stable.
- [ ] Remove or archive Rust code only with explicit approval and after
  needed historical export paths are preserved.
- [ ] Update `README.md`, `AGENTS.md`, and operations docs to reflect the
  new production reality.

---

## Verification Gates

Docs-only changes:

```sh
git diff --check
```

Normal TypeScript gate:

```sh
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test
```

Database gate:

```sh
pnpm --dir apps/web db:check
docker compose up -d postgres
pnpm --dir apps/web db:migrate
pnpm --dir apps/web db:test
```

Browser gate:

```sh
pnpm --dir apps/web test:e2e
```

Use focused tests while developing. Run broader gates as blast radius
increases and before release-candidate/cutover work.

---

## Roadmap Maintenance Rules

- Do not add changelog paragraphs.
- Do not add completed-work narratives after each pass.
- Keep checkboxes actionable and verifiable.
- Move deferred work into the correct future pass instead of reopening
  completed foundation phases.
- Mark a box complete only after implementation and verification.
- If a task is intentionally dropped, remove it or replace it with the
  actual decision and where that decision is documented.
