# Privacy Model

Pod Tracker stores live game-night data for self-hosted playgroups. The
privacy model is scoped around playgroup membership, event participation,
invite tokens, host-controlled address visibility, and explicit user
choice about what local life-counter data becomes a saved group record.

This document describes product expectations and implementation
boundaries; it is not a security guarantee beyond the code and database
checks that exist.

## Sensitive Data

Treat these fields as sensitive:

- Host street addresses, location notes, and schedule details for private
  events.
- Email addresses, phone numbers, guest names, RSVP notes, and travel
  timing details.
- Session cookies, CSRF tokens, invite tokens, calendar feed access, and
  production environment values.
- Life-counter local notes, unsaved local sessions, and pending sync
  actions.
- Production logs, database dumps, backups, and restore artifacts.

Do not commit sensitive data, database dumps, `.env` files, production
logs, private config, real invite tokens, host addresses, or local
life-counter session exports.

## Life Counter Data

Standalone `/life` sessions can run without an account. Local counter
state, player notes, unsaved action history, and offline sessions remain
in the browser unless the user explicitly saves or links the session to
an event, pod, or game record.

Event-linked and pod-linked counters may import event participants,
declared decks, commanders, and pod seats that the current viewer is
authorized to see. They must not expose host addresses, guest details,
private RSVP notes, or invite tokens through counter setup or spectator
views.

Saved game records may include participants, commanders, decks, result
type, winners, finish order, eliminations, commander-damage losses,
poison losses, and explicitly saved notes. Unsaved local notes must not
be copied into group history by default.

Offline sync must distinguish local-only state from saved-to-group state.
Conflict handling must not silently overwrite newer server data.

## Viewer Scopes

Authenticated users may see data for playgroups where they have a
membership role. Playgroup roles determine management permissions and
event access.

Guests are scoped by invite token. A guest RSVP flow may show only the
event fields intentionally exposed by that invite scope. Guest flows must
not become a general playgroup browser.

Public event pages are tokenized and must use public-safe queries or
equivalent authorization. They can show event planning context, but must
not reveal private host details unless the event and address visibility
rules explicitly allow it.

Deck declaration surfaces must preserve the same viewer scopes. Avoid
collection, wishlist, proxy-list, and recommendation behavior in the
rewrite unless Stephen explicitly expands scope.

## Address Visibility

Host address visibility is event-specific. Supported address visibility
states are:

- `hidden`: visible only to hosts and managers.
- `members`: visible to authenticated playgroup members.
- `rsvps`: visible to members with a yes or maybe RSVP.
- `public`: visible anywhere the event itself is visible.

When address visibility is not satisfied, UI may show a location name,
but must not render street address fields.

## Calendar Feeds

Calendar output may include location names, but must not include private
street addresses unless the requesting user is authorized to see the
address.

Future tokenized calendar feeds should use independently revocable tokens
and the same address visibility rules.

## Logging

Application logs should favor request IDs, route names, status codes, and
high-level failure reasons over user-provided content. Logs must not
print session tokens, CSRF tokens, invite tokens, passwords, environment
values, raw production email payloads, host street addresses, database
URLs, local notes, or unsaved life-counter action payloads.

When debugging requires sensitive production context, capture the minimum
necessary data outside the repository and delete it when the incident is
closed.

## Database Boundaries

The app currently relies on scoped query paths and route-level
authorization checks. Use RLS, public-safe views, or equivalent
scoped-query tests before claiming tenant isolation as a
database-enforced guarantee.

Public-safe views remain the preferred shape for tokenized public event
and guest surfaces as the schema matures.

## Backups And Restores

Backups are sensitive production data. Store them outside the repository,
restrict filesystem permissions, and copy them only through the normal
server backup channel.

Restore drills must target non-production databases unless Stephen has
approved a production maintenance window and a specific recovery plan.
