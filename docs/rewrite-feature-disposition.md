# Rust-Era Feature Disposition

This document records how Rust V1 product surfaces map into the
TypeScript rewrite. It does not delete Rust code.

## Preserved

- Authentication, sessions, and account ownership.
- Playgroups, memberships, roles, and invites.
- Events, hosts, locations, address visibility, RSVPs, guests, reminders,
  and calendar output.
- Lightweight deck registry and event deck declarations.
- Pod generation, manual pod editing, locking, and publishing.
- Quick game logging and basic meta health summaries.
- Health and readiness probes.
- Backup and restore discipline.

## Simplified

- Decks become lightweight game-night declarations: name, commander or
  commanders, color identity, bracket or power estimate, archetype/tags,
  visibility, owner, and optional external URL.
- Scryfall data narrows to commander/card lookup needed for declarations
  and game records.
- Meta analytics focus on attendance, variety, matchup freshness,
  commander/deck spread, color/archetype distribution, and repeat-pairing
  avoidance.
- Reminder jobs wait until the TypeScript job-runner shape is chosen.

## Removed From The Rewrite Roadmap

- Collection manager.
- Wishlists.
- Proxy print lists.
- Collection-aware deck recommendations.
- Full deckbuilder behavior.
- Paid SaaS billing.
- Native mobile app.
- Push notifications.
- Moxfield replacement features.

## Deferred

- Optional pgvector and semantic search.
- Natural-language meta query research.
- Full Scryfall/card catalog exploration.
- Full decklist import/export beyond lightweight external deck URLs and
  commander metadata.
- Rust worker/systemd deployment removal until TypeScript production
  deployment is verified.
