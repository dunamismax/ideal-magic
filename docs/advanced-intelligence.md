# Advanced Intelligence Reference

Status: deferred and outside the active TypeScript rewrite roadmap.

Pod Tracker is being simplified around the life counter and Commander
game-night coordination. AI, natural-language SQL, semantic search,
collection-aware recommendations, and full card research features are not
part of the active roadmap unless Stephen explicitly expands scope.

## Deferred Pgvector Notes

The Rust-era pgvector work was optional and local. The default SQLx
migrations do not create the extension or vector tables, and the
application can use SQL/full-text/trigram and heuristic behavior without
pgvector.

If this work is ever revived:

- Do not add `create extension vector` to default migrations.
- Gate vector schema, indexes, jobs, and queries behind an explicit local
  setup path or separate optional migration.
- Preserve non-vector behavior as the default and test the app without
  pgvector.
- Keep embeddings local or document every external provider boundary
  before any network-backed embedding job exists.
- Never embed private notes, invite tokens, host addresses, emails, phone
  numbers, production logs, backups, or database dumps.

## Deferred Natural-Language Query Notes

Unrestricted natural-language-to-SQL is risky for this product because
the database contains host addresses, RSVP details, notes, invite tokens,
calendar scope, and other sensitive playgroup data.

The only acceptable future direction is a constrained catalog of approved
meta queries:

- Map plain-language prompts to fixed query shapes.
- Require each query to declare viewer scope, inputs, safe output
  columns, redacted sample data, and expected indexes.
- Execute through repository/service methods or security-barrier views,
  not arbitrary generated SQL.
- Refuse prompts that request private addresses, contact details, invite
  tokens, raw notes, logs, backups, or cross-playgroup data.
- Log only query ids, route family, request id, and high-level refusal
  reasons.
