# BUILD.md

Future build plan for Pod Tracker. `README.md` describes the current
product and `AGENTS.md` holds durable repo operating rules.

Last reviewed: 2026-06-05.

---

## Product Pivot

Stephen's current direction is to simplify Pod Tracker around two primary
Commander game-night jobs:

1. The best life counter on the internet.
2. Group, event, RSVP, deck declaration, pod, and game-night tracking.

Everything else is supporting material. Decks exist so players can say
what they are bringing, hosts can form fair pods, games can be logged,
and the group can understand its meta over time. Pod Tracker should not
become a full deckbuilder, collection manager, paid SaaS platform, native
mobile app, or AI/card-search research project before these two primary
jobs are excellent.

The future application target is a TypeScript/Next.js rewrite. The
current Rust application remains useful as a working V1 reference until
the replacement covers the core flows and has a verified production
cutover plan.

Do not deploy, run production migrations, restart production services,
change Caddy/Cloudflare, delete production data, or access production
data without Stephen's explicit approval.

---

## North Star

Pod Tracker should feel like the command center for Commander night:

- A group can plan who is hosting, who is coming, what decks are being
  played, and how pods should be seated.
- A pod can open a beautiful, fast, reliable life counter before or
  during a game with player names, commanders, life totals, commander
  damage, poison, and the other counters Commander players actually use.
- A completed game can become structured history for the group without
  forcing a player through a heavyweight form.
- Hosts keep control over private addresses, invite tokens, event notes,
  guest details, and group-only information.

Primary navigation in the rewritten app should make the priorities
obvious:

- Life Counter
- Game Night
- Groups
- Decks
- History

Avoid marketing-style pages as the main experience. Build the actual app
surface first.

---

## Target Stack

Use this stack for new rewrite work unless Stephen explicitly changes it:

- Next.js App Router for the public site and logged-in app.
- React with TypeScript strict mode.
- Tailwind CSS for styling.
- shadcn/ui-compatible local components, Radix primitives, and
  `lucide-react` for accessible components and icons.
- Motion for focused transitions and microinteractions where useful.
- Better Auth for self-hosted authentication.
- PostgreSQL as source of truth.
- Drizzle ORM and Drizzle Kit for schema and migrations.
- Dexie over IndexedDB for offline app state.
- MinIO for S3-compatible object storage when static assets are no
  longer enough.
- Valkey for cache, rate limiting, and later queues when needed.
- Umami for respectful analytics.
- GlitchTip or Sentry-compatible error reporting.
- Docker Compose for local and self-hosted production services.
- Caddy reverse proxy behind Cloudflare DNS/proxy or Cloudflare Tunnel.
- Vitest, Testing Library, and Playwright for quality.

Prefer a single Next.js application with clear module boundaries before
splitting services. Keep Postgres as the product engine. Add MinIO,
Valkey, analytics, and error reporting when the app has real integration
points for them, not as empty infrastructure.

---

## Current Repo Inventory

The current repo is a Rust workspace:

- `crates/pod-web`: Axum/Leptos server-rendered web application.
- `crates/pod-db`: SQLx repositories and canonical Rust-era migrations.
- `crates/pod-core`: domain types and validation helpers.
- `crates/pod-worker`: Scryfall import, email/reminder, and meta refresh
  worker.
- `deploy/`: Caddy, systemd, backup, restore, and deploy assets for the
  current production shape.
- `docs/`: Rust-era development, privacy, operations, localization, and
  advanced-intelligence notes.

Current V1 surfaces to preserve conceptually:

- Authentication and sessions.
- Playgroups, memberships, roles, and invites.
- Events, host locations, address visibility, RSVPs, guests, reminders,
  and calendar output.
- Lightweight deck registry and event deck declarations.
- Pod generation, manual pod editing, locking, and publishing.
- Game logging and basic meta summaries.
- Health/readiness endpoints.
- Backup and restore discipline.

Current surfaces to simplify, remove, or defer during the rewrite:

- Collections, wishlists, proxy print lists, and collection-aware deck
  suggestions.
- Optional pgvector and semantic search.
- Natural-language meta query research.
- Full decklist import/export and full deckbuilder behavior.
- Broad Scryfall/card catalog exploration beyond commander/card lookup
  needed for deck declarations and game records.
- Rust worker/systemd deployment once the TypeScript app and Docker
  Compose deployment are ready.

---

## Life Counter Product Requirements

The life counter is a primary page, not a side widget.

Core modes:

- Standalone local counter at `/life` with no account required.
- Event-linked counter at `/events/[eventId]/life`.
- Pod-linked counter at `/events/[eventId]/pods/[podId]/life`.
- Post-game save flow that converts a counter session into a group game
  record when the user is authenticated and authorized.

Core setup:

- Support 2 to 8 players, with 4-player Commander optimized by default.
- Player name, preferred short name, color, seat, and optional avatar.
- One or more commanders per player for partners, backgrounds, friends
  forever, doctor companions, or similar commander-pair cases.
- Optional deck selection from the player's declared decks.
- Starting life presets, with 40 as the Commander default.
- Randomize first player and seating order.
- Clone a recent pod or import players/decks from an event pod.

Core live tracking:

- Large life total controls that work on phone, tablet, and desktop.
- Fast add/subtract by 1, 5, and 10 with accessible keyboard and pointer
  behavior.
- Commander damage tracked per defending player and per commander source,
  not only per opposing player.
- Poison counters.
- Commander tax or cast count per commander.
- Elimination state, winner selection, draw/no-contest support, and
  reversible mistakes.
- Undo/redo backed by an action log, not only mutable totals.
- Game timer, turn timer, active player, turn order, and optional turn
  count.
- Monarch, initiative, city's blessing, day/night, experience, energy,
  rad, storm, treasure, floating mana, and custom counters.
- Per-player notes kept local unless explicitly saved with the game.
- Reset, rematch, and new game flows that do not lose useful player/deck
  setup.

Core quality:

- Offline-first behavior with Dexie and IndexedDB.
- No network required for a local life counter session after the page is
  loaded.
- Stable layout with no accidental shifts while tapping life controls.
- Full-screen and table-display friendly views.
- Responsive checks for small phones, tablets, laptops, and wide
  desktop screens.
- Accessible contrast, focus states, labels, and hit targets.
- Motion used only to clarify state changes, not to slow down repeated
  play.
- Browser tests for setup, life changes, commander damage, poison,
  undo/redo, reload persistence, and game save.

---

## Game Night Product Requirements

Planning and pod tracking are the other primary product pillar.

Core group planning:

- Create and manage playgroups.
- Manage members, roles, guests, and invite links.
- Create events with date, time, host, location, and address visibility.
- Collect RSVPs with yes, maybe, no, guest, and late-arrival notes.
- Show host address only to viewers allowed by event visibility rules.
- Let guests use tokenized scoped pages without seeing the whole group.

Core deck declaration:

- Keep decks lightweight: name, commander or commanders, color identity,
  bracket/power estimate, archetype/tags, visibility, owner, and optional
  external deck URL.
- Let players declare which deck or decks they may bring to an event.
- Snapshot commander/deck metadata at declaration and game time so later
  deck edits do not rewrite history.
- Support manual commander entry first; add Scryfall lookup only where it
  improves accuracy and speed.

Core pods:

- Generate pods from RSVPs and declared decks.
- Prefer four-player pods while handling odd attendance cleanly.
- Account for host overrides, locked seats, guests, late arrivals,
  previous pairings, deck bracket spread, commander/deck variety, and
  player preferences.
- Let hosts manually move seats before publishing.
- Publish pod assignments to event participants and guests within their
  allowed scope.

Core game logging:

- Log a game from a pod or from a life counter session.
- Store players, commanders, decks, winner or winners, result type,
  finish order when known, eliminations, poison losses, commander-damage
  losses, and notes.
- Make quick logging possible in under a minute.
- Keep meta insight focused on group health: attendance, variety,
  matchup freshness, commander/deck spread, color/archetype distribution,
  and repeat-pairing avoidance.

---

## Data Model Direction

Rebuild the schema with Drizzle migrations. Use the Rust SQL migrations
as reference material, not as the long-term migration system.

Core tables to design:

- Better Auth tables for users, accounts, sessions, verification, and
  any provider state.
- `playgroups`, `playgroup_memberships`, `playgroup_invites`, and
  `house_rules`.
- `event_locations`, `events`, `event_hosts`, `event_rsvps`,
  `event_guests`, and `event_reminders`.
- `decks` and `event_deck_declarations`.
- `pods` and `pod_seats`.
- `games`, `game_players`, `game_results`, `game_notes`, and
  `matchup_history`.
- `life_counter_sessions`, `life_counter_players`,
  `life_counter_commanders`, `life_counter_actions`, and
  `life_counter_snapshots`.
- Minimal `card_catalog` or `commander_catalog` tables only if needed
  for fast commander lookup.
- `audit_events` for sensitive or host-controlled changes.

Schema rules:

- Keep address, invite token, guest, RSVP note, email, and private event
  details scoped by authorization.
- Prefer explicit constraints for status values, visibility values, seat
  uniqueness, positive counters, nonblank names, and valid commander
  damage relationships.
- Use public-safe views or equivalent scoped query functions for public
  event and guest pages.
- Use indexes for event lists, upcoming RSVPs, pod seats, game history,
  commander lookup, and matchup summaries.
- Do not claim database-enforced tenant isolation until RLS or equivalent
  scoped-query tests prove it.

---

## Working Rules For Future Agents

- Read `AGENTS.md`, `README.md`, and this file before starting.
- Run `git pull --ff-only origin main` or the current branch before code
  changes.
- Treat this file as the active build plan for future work.
- Keep changes small enough to verify in one pass.
- Update checkboxes only when the work is implemented and verified.
- Do not delete the Rust app until the TypeScript replacement has passed
  core flow tests and Stephen has approved the cutover.
- Do not loosen privacy rules to make UI work easier.
- Do not add full deckbuilder, collection, AI, billing, native mobile, or
  SaaS features unless Stephen explicitly expands scope.
- If a future pass discovers an undocumented gotcha, update `AGENTS.md`
  or durable docs in the same session.

---

## Phase 0 - Align Docs And Scope

- [x] Update `AGENTS.md` so the durable repo stack rules match the
  TypeScript/Next.js rewrite direction.
- [x] Update `README.md` to describe the new product thesis: life counter
  plus Commander game-night coordination.
- [x] Update `docs/development.md` for the TypeScript, Docker Compose,
  Drizzle, and Next.js workflow.
- [x] Update `docs/operations.md` for the future Docker Compose, Caddy,
  Cloudflare, Postgres, Valkey, MinIO, analytics, and error reporting
  deployment shape.
- [x] Update `docs/privacy.md` with life counter session data, offline
  state, saved game records, and event-linked counter scopes.
- [x] Mark `docs/advanced-intelligence.md` as deferred or archive its
  contents into a clearly non-roadmap reference.
- [x] Document which current Rust-era features are preserved,
  simplified, removed, or deferred.
- [x] Decide whether the first Next.js app lives at the repo root or in
  `apps/web` during side-by-side migration.
- [x] Define the minimum data migration strategy for existing production
  data before any production cutover work begins.

## Phase 1 - Scaffold The TypeScript App

- [x] Create the Next.js App Router application in the agreed location.
- [x] Enable TypeScript strict mode and fail builds on type errors.
- [x] Add Tailwind CSS with a small token set for color, spacing,
  radius, typography, and focus states.
- [x] Add shadcn/ui-compatible local component structure.
- [x] Add Radix primitives where accessibility needs them.
- [x] Add `lucide-react` and use icons for primary actions.
- [x] Add Motion and document when motion is allowed.
- [x] Add Vitest, Testing Library, and Playwright.
- [x] Add lint, format, typecheck, unit test, integration test, and
  Playwright scripts.
- [x] Add Docker Compose for local Postgres, Valkey, MinIO, Umami, and
  GlitchTip or a Sentry-compatible endpoint.
- [x] Keep optional services optional until they have working product
  integrations.
- [x] Add health and readiness routes for the Next.js app.
- [x] Verify the scaffold with local tests and a browser smoke test.

## Phase 2 - Design System And App Shell

- [x] Build the primary app shell with Life Counter and Game Night as the
  first navigation items.
- [x] Build responsive layouts for phone, tablet, laptop, and wide
  desktop.
- [x] Create reusable button, icon button, dialog, drawer, menu, tabs,
  segmented control, toast, form field, and empty-state components.
- [x] Create player color tokens that work for Commander seating without
  becoming a one-note palette.
- [x] Create dense planning views for hosts without marketing-page
  styling.
- [x] Create full-screen table-display styles for the life counter.
- [ ] Add dark and light themes only if both are complete and verified.
- [x] Verify text does not overflow controls on mobile or desktop.
- [x] Add visual regression or screenshot checks for the app shell and
  life counter layout.

## Phase 3 - Auth And Authorization

- [x] Integrate Better Auth with Postgres.
- [ ] Implement signup, login, logout, password reset or equivalent
  account recovery, and session refresh.
- [ ] Define playgroup roles and permissions in TypeScript.
- [x] Protect logged-in routes through server-side authorization.
- [ ] Add CSRF, secure cookie, and rate-limit behavior appropriate for
  the target deployment.
- [ ] Add Valkey-backed rate limiting once Valkey is part of the running
  app.
- [ ] Add audit events for sensitive changes.
- [ ] Verify auth with unit tests, integration tests, and Playwright
  signup/login/logout smoke tests.

Current Phase 3 foundation adds Better Auth dependencies, aligns the
Drizzle identity tables with Better Auth's core user, account, session,
and verification fields, mounts `/api/auth/*`, adds signup and login
pages, and adds a protected `/account` route with logout. The current
logged-in planning surfaces (`/game-night`, `/groups`, `/decks`, and
`/history`) now use the same server-side session guard and redirect
anonymous viewers to login with a scoped return path. PGlite integration
tests exercise real Better Auth signup, cookie-backed session lookup,
logout, login, and password hash persistence against migrated schema
history. Playwright covers the signup and login form payloads with
mocked auth endpoints plus anonymous redirect smoke tests for the
protected planning routes. This does not yet complete account recovery,
CSRF/rate-limit hardening, Valkey-backed limits, audit events,
playgroup-role authorization, or authenticated group/event CRUD
workflows.

## Phase 4 - Drizzle Schema And Core Persistence

- [x] Translate the preserved Rust-era schema concepts into Drizzle
  schema files.
- [x] Generate Drizzle migrations for the new TypeScript schema.
- [x] Add seed data with fake non-sensitive playgroups, events, decks,
  pods, and games.
- [x] Add database helpers for transactions, pagination, and scoped
  queries.
- [x] Add public-safe query paths for tokenized event and guest pages.
- [x] Add schema tests for constraints, indexes, and cascade behavior.
- [ ] Add migration smoke tests against real Postgres in Docker Compose.
- [ ] Document how old SQLx migrations map to the new Drizzle schema.
- [ ] Keep app runtime credentials separate from migration credentials.

Current Phase 4 groundwork defines the TypeScript rewrite schema in
Drizzle and generates the first migration under `apps/web/src/db`. It
covers Better Auth-shaped identity tables, groups, invites, events,
RSVPs, locations, lightweight decks, deck declarations, pods, games,
matchup history, and action-log-based life-counter persistence. It adds
fake non-sensitive development seed data plus transaction, pagination,
scoped event-planning query helpers, hashed fake event-token seed values,
and token-scoped public-safe event and guest RSVP aggregate query paths.
PGlite-backed integration tests cover migration application,
representative constraints, indexes, cascade behavior, seed idempotency,
scoped event counts, upcoming-event pagination, host-address redaction,
token denial, and public-safe projections that omit host addresses,
location notes, RSVP notes, user emails, invite tokens, and guest names.
It does not yet wire runtime routes to Postgres, prove Docker/PostgreSQL
migrations in this environment, implement public event or guest RSVP UI,
or complete auth/server save behavior.

## Phase 5 - Life Counter V1: Offline Standalone

- [x] Build `/life` as a primary public route.
- [x] Build player setup for 2 to 8 players.
- [x] Add player names, colors, seats, commanders, starting life, and
  optional deck labels.
- [x] Support multiple commanders per player.
- [x] Build the main counter board with large stable hit targets.
- [x] Add life adjustments by 1, 5, and 10.
- [x] Add commander damage by defending player and commander source.
- [x] Add poison counters.
- [x] Add commander tax or cast count per commander.
- [x] Add monarch, initiative, city's blessing, day/night, experience,
  energy, rad, storm, treasure, floating mana, and custom counters.
- [x] Add elimination, winner, draw, and no-contest states.
- [x] Add game timer, turn timer, active player, turn order, and turn
  count.
- [x] Store counter state and action history in Dexie.
- [x] Add undo and redo from the action log.
- [x] Add reset, rematch, and new game flows.
- [x] Add keyboard behavior for desktop play.
- [x] Add accessible labels, focus management, and screen-reader
  friendly state changes.
- [x] Verify refresh recovery and post-load local counter behavior with
  network requests blocked. Full offline launch remains Phase 12.
- [x] Verify mobile, tablet, desktop, and wide desktop layouts with
  Playwright screenshots.

## Phase 6 - Life Counter V2: Event And Pod Integration

- [x] Build `/events/[eventId]/life`.
- [x] Build `/events/[eventId]/pods/[podId]/life`.
- [x] Import event participants and declared decks into a counter setup.
- [x] Import published pod seats into a counter setup.
- [ ] Allow a standalone local session to be attached to an event when
  the user logs in and has permission.
- [ ] Save counter snapshots to Postgres when explicitly linked to an
  event or pod.
- [ ] Convert a completed counter session into a structured game log.
- [ ] Preserve local Dexie history after server save.
- [ ] Handle offline edits and later sync without overwriting newer
  server state silently.
- [ ] Add a read-only table display or spectator view if it can be
  scoped safely.
- [x] Verify linked counter setup, reload, and post-load local behavior
  with network requests blocked using Playwright.
- [ ] Verify linked game save with Playwright once Postgres save and
  game-log conversion exist.

Current Phase 6 foundation uses deterministic local fixture data in the
TypeScript app to prove linked route shape, setup import, and local Dexie
session separation. It does not implement authenticated event access,
Postgres snapshot save, server sync, conflict handling, or game-log
conversion. Linked counters now show explicit local save state and
local-only scope indicators so players can see that the session has not
been saved to the group.

## Phase 7 - Groups And Events

- [x] Build authenticated group creation and scoped group list.
- [x] Build member list with scoped membership visibility.
- [x] Build scoped group invite creation, listing, revocation, and
  authenticated token join.
- [x] Build scoped group role management and member removal.
- [ ] Build group edit and group archive/delete flows.
- [x] Build authenticated event creation for hostable groups.
- [x] Build event edit, cancel, and archive flows.
- [ ] Build host location management with address visibility controls.
- [x] Build RSVP flows for authenticated members.
- [x] Build tokenized guest RSVP pages.
- [x] Build public-safe event pages for tokenized links.
- [ ] Add calendar export only after address visibility rules are
  verified.
- [ ] Add reminder jobs only after the job runner shape is chosen for the
  TypeScript app.
- [ ] Verify signup, group creation, event creation, RSVP, guest RSVP,
  and address visibility with Playwright.

Current Phase 7 public invite work adds a
`/invites/events/[inviteToken]` route backed by
`/api/public-events/[inviteToken]`, which uses the token-scoped
public-safe Drizzle query paths. The page shows event title, playgroup
name, date/time, public location name, aggregate RSVP counts, guest
counts, deck declaration counts, pod counts, and logged-game counts.
Tokenized guests can now submit a name and RSVP status through a
public-safe form that writes a guest RSVP row and refreshes only aggregate
public counts. Unit, PGlite integration, and Playwright tests verify that
the rendered view, service payload, and post-submit refreshed page omit
host addresses, location notes, RSVP notes, emails, raw invite tokens,
token hashes, existing guest names, and newly submitted guest names.
Authenticated users can now create a playgroup from `/groups` and see a
Postgres-backed list scoped by their membership, with owner membership
creation, unique slug generation, validation, PGlite integration tests,
and a Playwright signup-to-group-create smoke test. Group cards now show
a safe member directory for owner, admin, host, and member roles only,
backed by role-aware helpers and PGlite tests proving non-members,
guests, and viewers cannot read member-directory details; the projection
omits emails, invite data, host addresses, notes, and guest details.
Owners and admins can now create group invite links from `/groups`, see
only invite metadata in normal list views, revoke invites, and let an
authenticated user join through a tokenized group invite page. Invite
tokens are generated with Node crypto, stored only as SHA-256 hashes,
returned raw only in the create action's transient client state, and
omitted from normal invite metadata projections. PGlite tests prove
hosts, members, guests, viewers, and non-members cannot create, list, or
revoke group invites, and Playwright covers signup to group invite
create, list, and revoke. Owners can now change owner/admin/host/member
roles and remove memberships from `/groups`; admins can manage only
host/member roles. Member removal deletes only the membership, never the
user account, and last-owner protection blocks demoting or removing the
final owner. PGlite tests cover authorized changes, admin limits,
host/member/non-member denial, last-owner protection, and membership-only
removal. Playwright covers signup, group creation, invite join, role
change, and member removal through the UI.
Logged-in owners, admins, and hosts can now create events for their
hostable groups from `/game-night`, with server-action validation,
scoped Postgres writes, hidden-address host rows, member-scoped upcoming
event lists, PGlite authorization coverage, and a Playwright
signup-to-group-to-event smoke test. Authenticated playgroup owners,
admins, hosts, and members can now RSVP yes, maybe, no, or waitlist to
scoped upcoming events from `/game-night`, with optional arrival/leaving
times, server-action validation, PGlite tests for member upsert and
non-member denial, and a Playwright signup-to-group-to-event-to-RSVP
smoke test. Owners, admins, and hosts can now edit event title, start,
visibility, and description, cancel events with a visible cancelled
status, and archive events out of upcoming lists; PGlite tests prove
plain members and non-members cannot edit, cancel, or archive, while
Playwright covers signup, group creation, event creation, RSVP, edit,
cancel, and archive. This does not yet implement group editing, group
archive/delete flows, guest RSVP editing/deletion, RSVP notes, host
address disclosure, or public calendar export.

## Phase 8 - Deck Declarations

- [x] Build lightweight deck create/list/update and non-destructive retire
  flows for commander-night planning.
- [x] Support name, commander or commanders, colors, bracket/power,
  archetype/tags, visibility, owner, and optional external URL.
- [x] Build event deck declaration and undeclaration flows.
- [x] Preserve event deck declaration snapshots when later deck edits occur.
- [ ] Snapshot declaration metadata for events and game records.
- [ ] Add commander lookup where it makes entry faster and more accurate.
- [x] Avoid full deckbuilder, collection tracking, and card inventory
  behavior.
- [x] Verify deck creation, deck update/retire, event deck declaration, and
  event snapshot preservation with tests and Playwright.

Current Phase 8 adds authenticated lightweight deck management in
`/decks` for planning metadata only: deck name, one or more manually
entered commanders, color identity, bracket, power estimate, archetype,
tags, visibility, owner, optional playgroup scope, and optional external
URL. Owners can create, list, update, and non-destructively retire active
decks; retired decks leave existing declaration history intact and are
hidden from active owner/declaration selection lists. `/game-night`
supports scoped event deck declaration and undeclaration for authenticated
event participants, with owner-only deck selection and declaration-time
snapshots for deck name, commanders, colors, bracket, power estimate,
archetype, tags, visibility, and external URL. PGlite integration tests
cover owner-scoped deck lists, owner-only updates, playgroup visibility
authorization, retirement, declaration authorization, duplicate
protection, undeclaration, and immutable event snapshots after later deck
edits. Unit/component tests cover validation, update/retire controls, and
public-safe rendering, and Playwright covers signup -> group -> deck
create -> deck edit -> event create -> deck declaration -> later deck edit
snapshot preservation -> undeclaration -> RSVP. Destructive deck delete,
commander lookup, game-record snapshot integration, full deckbuilder,
collection tracking, and card inventory remain unimplemented.

## Phase 9 - Pod Generation And Pod Management

- [x] Build event pod dashboard for hosts.
- [x] Generate pods from yes/maybe RSVPs and declared decks.
- [x] Prefer four-player pods while handling 3-player and 5-player edge
  cases clearly.
- [ ] Score pods for repeat-pairing avoidance, deck variety, bracket
  spread, guest placement, late arrivals, and host overrides.
- [x] Support locked seats and manual seat movement.
- [x] Publish and unpublish pod assignments.
- [x] Show participants only the pod data they are allowed to see.
- [x] Let a published pod launch a linked life counter session.
- [x] Verify generation, manual edits, locking, publishing, and launch to
  life counter with tests and Playwright.

Current Phase 9 start adds a draft pod panel to `/game-night` for event
owners, admins, and hosts. Managers can generate proposed pods from
authenticated yes/maybe RSVPs, using the RSVP member display name and the
player's preferred event deck declaration snapshot for seating display.
Generation is deterministic, prefers four-player pods, handles 3-player,
5-player, 6-player, 7-player, and larger odd attendance without isolated
single-player leftovers, and persists `pods` plus `pod_seats` rows with
size, bracket, and availability scores. Regeneration replaces only
unlocked proposed draft pods and refuses to overwrite locked draft seats,
locked published pods, active pods, completed pods, or cancelled pods.
Managers can manually move unlocked seats between proposed pods and seat
positions from `/game-night`; movement is transactional, compacts source
and target seat order, preserves deck declaration snapshot references,
refuses non-manager access, and refuses locked seats or non-proposed pods.
Managers can now lock and unlock individual proposed seats from
`/game-night`; locked seats persist, display a locked-seat badge, hide
manual movement controls until unlocked, block movement, and block
regeneration until explicitly unlocked. Managers can publish proposed pod
assignments to event participants, which transitions the event pods to
locked published assignments with `published_at`; managers can unpublish
back to proposed only before any active/completed pod state, game record,
or saved pod-linked counter exists. Authenticated event participants can
see generated and published pod seats through the scoped Game Night
surface, while non-members cannot. Published pod cards now expose
participant-scoped launch links to `/events/[eventId]/pods/[podId]/life`;
draft/proposed pods do not show launch controls. This is only a launch
affordance into the existing linked local counter route and does not
claim Postgres counter save, server sync, game-log conversion, or
offline/PWA launch. Draft generation now uses a deterministic optimizer
that scores candidate assignments by pod size, bracket spread,
repeat-player pair history, repeat-deck matchup history, deck variety
through color identity/archetype/commander repetition, RSVP maybe status,
late arrivals, early leaving times, and shared availability windows.
Generation reads scoped `matchup_history` rows for the event playgroup
and persists the resulting size, bracket, repeat-pair, repeat-deck,
availability, total-score, and scoring-detail values on `pods`; the
score now affects assignments instead of only describing them.
Generation now also seats event-scoped guest RSVP rows as guest-backed
participants, persists `pod_seats.guest_name` only for those guest seats,
and scores guest placement by preferring to distribute guest RSVPs across
pods with authenticated players instead of clumping or isolating guests.
Participant-facing pod summaries continue to redact guest names/details
as `Guest RSVP`. This guest support seats one guest RSVP per RSVP row;
named plus-ones in `event_guests` and member RSVP `guest_count` values
are not yet modeled as separate pod-seat identities. Host overrides also
remain unimplemented because there is no override model yet. The
projection omits emails, invite tokens, token hashes, host addresses,
private notes, guest names/details, and private contact fields. Unit,
PGlite integration, component rendering, Playwright, and database gates
cover draft generation, scoring-driven repeat-pair avoidance, guest RSVP
distribution and redaction, display, manual movement, locking,
unlocking, publishing, unpublishing, scoped participant visibility,
launch-link visibility, and non-member denial. Host overrides, plus-one
guest seating, and life-counter-to-game logging remain unimplemented.

## Phase 10 - Game Logging And Meta Health

- [x] Build quick game logging from an event pod.
- [ ] Build game logging from a completed life counter session.
- [ ] Store result type, winner or winners, participants, commanders,
  decks, finish order, eliminations, commander-damage losses, poison
  losses, and notes.
- [ ] Build event history and group history views.
- [ ] Build meta health summaries for attendance, variety, matchup
  freshness, commander/deck spread, color/archetype distribution, and
  repeat pairings.
- [ ] Keep competitive leaderboards optional and secondary.
- [ ] Add materialized views or cached summaries only after query shape
  and freshness needs are clear.
- [ ] Verify game logging and meta summaries with database tests and
  Playwright.

Current Phase 10 start adds schema-backed quick logging from a published
locked pod in the TypeScript rewrite. Event managers and authenticated
user-backed seats in the scoped pod can log a published pod game;
non-members are denied. Logging creates `games`, `game_players`, and
`game_results` rows, snapshots participant names, guest names internally,
deck names, commanders, color identity, bracket, power estimate, and
archetype from the published pod seats and declaration snapshots, trims
safe notes into the game/result rows, marks selected winner seats in
`game_players`, stores the single user-backed winner in `game_results`
when exactly one is known, writes `matchup_history` rows for logged
user/deck pairs, and transitions the pod to `completed` so it cannot be
quick-logged again or unpublished as a live assignment. The `/game-night`
published pod card now has a manager-facing quick-log form for result
type, optional winner seat, and optional notes. Guest names remain
internal; the quick-log response, participant pod summaries, and logged
history projections redact guest seats as `Guest RSVP`.

The TypeScript rewrite now also has a scoped logged-game history
data-access surface plus a protected `/history` page. Owners, admins,
hosts, and members can list recent logged games across playgroups where
they hold one of those roles; non-members and outsider users receive no
rows. History summaries include event title/start time, playgroup name,
completed time, result type, linked pod name when present, safe winner
display, participant-safe names, deck/commander/color/bracket/power/
archetype snapshots, and game notes for authenticated scoped members.
The projection omits emails, invite tokens, token hashes, host
addresses, RSVP notes, private guest names/details, and private contact
data. Focused PGlite tests cover published-pod logging, participant
authorization, non-member denial, logged history listing for scoped
members and managers, immutable history snapshots after later deck
edits, guest redaction in history projections, pod context for completed
pod games, and matchup-history writes. Focused component tests cover the
`/history` game list and empty state. Life-counter-session game saves,
finish order beyond winner marking, elimination detail,
poison/commander-damage loss detail, event-specific history pages, public
history views, meta health summaries, materialized summary views, and
Playwright coverage for the quick-log/history UI remain unimplemented.

## Phase 11 - Simplification And Removal

- [ ] Remove or archive collection, wishlist, proxy-list, and
  collection-aware recommendation UI from the future app.
- [ ] Remove or archive optional pgvector and semantic-search paths from
  the active roadmap.
- [ ] Remove or archive natural-language meta query research from the
  active roadmap.
- [ ] Remove or archive full decklist import/export unless Stephen
  explicitly keeps it as lightweight metadata support.
- [ ] Remove old Rust routes only after equivalent core TypeScript flows
  are working or deliberately dropped.
- [ ] Keep any historical data export needed before deleting old tables
  or code.
- [ ] Document each removed feature and why it is outside the two primary
  product pillars.

## Phase 12 - Offline, Sync, And PWA Polish

- [ ] Define the Dexie schema for local counter sessions and pending
  sync actions.
- [x] Add clear local-only versus saved-to-group state indicators.
- [ ] Add conflict handling for event-linked counter sessions.
- [ ] Add PWA manifest and install behavior if it improves live play.
- [ ] Verify offline launch for previously loaded life counter assets.
- [ ] Verify recovery after browser refresh, tab close, and reconnect.
- [ ] Add storage cleanup controls that do not surprise-delete active
  games.

## Phase 13 - Observability And Operations

- [ ] Add structured application logging without sensitive values.
- [ ] Add GlitchTip or Sentry-compatible error reporting.
- [ ] Add Umami analytics with respectful event names and no private
  payloads.
- [ ] Add health and readiness checks for database, Valkey, and object
  storage when those services are required.
- [ ] Add backup and restore scripts for the Docker Compose/Postgres
  production shape.
- [ ] Add Caddy config for the Next.js service.
- [ ] Add Cloudflare DNS/proxy or Tunnel notes without committing
  secrets.
- [ ] Add production environment examples with placeholders only.
- [ ] Validate compose, Caddy, backup, restore, health, and readiness
  flows locally before any production plan.

## Phase 14 - Cutover From Rust To TypeScript

- [ ] Freeze Rust feature development except for urgent production fixes.
- [ ] Build a data migration or export/import plan for current production
  data.
- [ ] Run the TypeScript app against a migrated non-production database.
- [ ] Verify signup, login, group creation, event creation, RSVP, deck
  declaration, pod generation, linked life counter, game logging, and
  meta history end to end.
- [ ] Run load and interaction checks for live life-counter tapping.
- [ ] Run backup and restore drill on the TypeScript deployment shape.
- [ ] Prepare rollback steps before production cutover.
- [ ] Get Stephen's explicit approval for production migration and
  deployment.
- [ ] Cut over production only after approval.
- [ ] Archive or remove Rust deployment files only after the TypeScript
  production app is stable.

---

## Verification Gates

Docs-only work:

```sh
git diff --check
```

Future TypeScript normal gate once scripts exist:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Future database gate once Drizzle exists:

```sh
pnpm db:check
docker compose up -d postgres
pnpm db:migrate
pnpm db:test
```

The Docker Compose PostgreSQL service publishes to `localhost:55432` so
local host databases or SSH tunnels on `5432` do not intercept migration
commands.

Future browser smoke coverage:

- Signup, login, logout.
- Group creation and member invite.
- Event creation and RSVP.
- Guest RSVP through tokenized link.
- Deck creation and event declaration.
- Pod generation, manual adjustment, lock, and publish.
- Standalone life counter setup.
- Life, commander damage, poison, custom counters, undo, redo, reload,
  and rematch.
- Launch life counter from a published pod.
- Save completed counter session as a game.
- View game history and meta health.

---

## Open Decisions

- [x] Whether the TypeScript app starts in `apps/web` for side-by-side
  migration or replaces the repo root immediately.
- [ ] Whether standalone `/life` should be installable as a PWA in the
  first life-counter release.
- [ ] Whether event-linked life counter sessions should support real-time
  multi-device sync in the first release or only save on completion.
- [ ] Whether Scryfall data should be imported locally in the TypeScript
  app or replaced initially with lightweight commander lookup.
- [x] Whether existing production data should be migrated table-by-table
  or exported/imported through typed application-level scripts.
