# Minimum Production Data Migration Strategy

No production migration or cutover work may start without Stephen's
explicit approval.

The minimum viable strategy before TypeScript cutover is:

1. Freeze Rust feature development except for urgent production fixes.
2. Inventory Rust SQLx tables, extensions, views, background jobs, and
   sensitive columns.
3. Map preserved V1 concepts into Drizzle schema tables and document
   every simplified, removed, and deferred field.
4. Export production data from a fresh backup into a non-production
   environment only.
5. Run typed import scripts into a migrated TypeScript database.
6. Reconcile counts and invariants for users, playgroups, memberships,
   invites, events, locations, RSVPs, guests, decks, declarations, pods,
   games, and meta summaries.
7. Verify public-safe event pages, guest scopes, and address visibility
   against non-production data.
8. Run end-to-end smoke coverage for signup/login, group creation, event
   creation, RSVP, deck declaration, pod generation, linked life counter,
   game logging, and history.
9. Run a backup and restore drill on the TypeScript deployment shape.
10. Prepare rollback steps and get Stephen's explicit production
    migration and deployment approval.

Prefer typed application-level export/import scripts for the first
cutover unless table-by-table SQL migration proves simpler after the
Drizzle schema exists. Keep production backups, dumps, invite tokens,
host addresses, emails, and private notes out of the repository.
