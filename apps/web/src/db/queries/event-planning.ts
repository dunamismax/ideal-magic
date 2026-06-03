import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";

import {
  eventDeckDeclarations,
  eventGuests,
  eventHosts,
  eventLocations,
  eventRsvps,
  events,
  games,
  playgroupMemberships,
  playgroups,
  pods,
} from "../schema";
import {
  type AddressVisibility,
  canManageEvent,
  canSeeHostAddress,
  type EventVisibility,
  type PlaygroupRole,
} from "../scopes";
import { normalizePageRequest, type PageRequest } from "../pagination";
import type { AppDatabase } from "../client";
import { hashInviteToken, normalizeInviteToken } from "../tokens";

type PlanningDatabase = Pick<AppDatabase, "select">;

type RsvpStatus = "yes" | "maybe" | "no" | "waitlist";

export type EventPlanningSummary = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  visibility: EventVisibility;
  playgroup: {
    id: string;
    name: string;
    slug: string;
  };
  viewer: {
    role: PlaygroupRole | null;
    rsvpStatus: RsvpStatus | null;
    canManageEvent: boolean;
    canSeeHostAddress: boolean;
  };
  location: {
    id: string;
    name: string | null;
    address: {
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      stateProvince: string | null;
      postalCode: string | null;
      country: string | null;
    } | null;
    notes: string | null;
  } | null;
  counts: {
    rsvps: Record<RsvpStatus, number>;
    deckDeclarations: number;
    pods: number;
    loggedGames: number;
  };
};

export type UpcomingEventListItem = {
  id: string;
  title: string;
  startsAt: Date;
  visibility: EventVisibility;
  playgroup: {
    id: string;
    name: string;
    slug: string;
  };
  viewerRole: PlaygroupRole | null;
};

export type PublicSafeEventSummary = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  visibility: EventVisibility;
  playgroup: {
    id: string;
    name: string;
    slug: string;
  };
  location: {
    id: string;
    name: string | null;
  } | null;
  counts: {
    rsvps: Record<RsvpStatus, number>;
    guestRsvps: number;
    namedGuests: number;
    deckDeclarations: number;
    pods: number;
    loggedGames: number;
  };
};

export type PublicSafeGuestRsvpSummary = {
  eventId: string;
  rsvps: Record<RsvpStatus, number>;
  guestRsvps: number;
  namedGuests: number;
};

const rsvpStatuses = ["yes", "maybe", "no", "waitlist"] as const;
const playgroupRoles = [
  "owner",
  "admin",
  "member",
  "host",
  "guest",
  "viewer",
] as const;
const eventVisibilities = ["members", "invite_only", "public_safe"] as const;
const addressVisibilities = ["rsvps", "members", "public", "hidden"] as const;

export async function getScopedEventPlanningSummary(
  db: PlanningDatabase,
  input: {
    eventId: string;
    viewerUserId: string | null;
  },
): Promise<EventPlanningSummary | null> {
  const [eventRow] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      visibility: events.visibility,
      playgroupId: playgroups.id,
      playgroupName: playgroups.name,
      playgroupSlug: playgroups.slug,
      locationId: eventLocations.id,
      locationName: eventLocations.name,
      addressLine1: eventLocations.addressLine1,
      addressLine2: eventLocations.addressLine2,
      city: eventLocations.city,
      stateProvince: eventLocations.stateProvince,
      postalCode: eventLocations.postalCode,
      country: eventLocations.country,
      locationNotes: eventLocations.notes,
    })
    .from(events)
    .innerJoin(playgroups, eq(events.playgroupId, playgroups.id))
    .leftJoin(eventLocations, eq(events.locationId, eventLocations.id))
    .where(eq(events.id, input.eventId))
    .limit(1);

  if (!eventRow) {
    return null;
  }

  const visibility = asEventVisibility(eventRow.visibility);
  const viewerRole = await getViewerRole(db, {
    playgroupId: eventRow.playgroupId,
    viewerUserId: input.viewerUserId,
  });

  if (visibility !== "public_safe" && viewerRole === null) {
    return null;
  }

  const viewerRsvpStatus = await getViewerRsvpStatus(db, {
    eventId: eventRow.id,
    viewerUserId: input.viewerUserId,
  });
  const hostVisibilities = await getHostAddressVisibilities(db, eventRow.id);
  const addressVisible =
    hostVisibilities.length > 0 &&
    hostVisibilities.every((hostVisibility) =>
      canSeeHostAddress(
        viewerRole,
        hostVisibility,
        viewerRsvpStatus ?? undefined,
      ),
    );

  const [rsvpCounts, deckDeclarationCount, podCount, loggedGameCount] =
    await Promise.all([
      countRsvpsByStatus(db, eventRow.id),
      countDeckDeclarationsForEvent(db, eventRow.id),
      countPodsForEvent(db, eventRow.id),
      countLoggedGamesForEvent(db, eventRow.id),
    ]);

  return {
    id: eventRow.id,
    title: eventRow.title,
    description: eventRow.description,
    startsAt: eventRow.startsAt,
    endsAt: eventRow.endsAt,
    visibility,
    playgroup: {
      id: eventRow.playgroupId,
      name: eventRow.playgroupName,
      slug: eventRow.playgroupSlug,
    },
    viewer: {
      role: viewerRole,
      rsvpStatus: viewerRsvpStatus,
      canManageEvent: viewerRole ? canManageEvent(viewerRole) : false,
      canSeeHostAddress: addressVisible,
    },
    location: eventRow.locationId
      ? {
          id: eventRow.locationId,
          name: addressVisible ? eventRow.locationName : null,
          address: addressVisible
            ? {
                addressLine1: eventRow.addressLine1,
                addressLine2: eventRow.addressLine2,
                city: eventRow.city,
                stateProvince: eventRow.stateProvince,
                postalCode: eventRow.postalCode,
                country: eventRow.country,
              }
            : null,
          notes: addressVisible ? eventRow.locationNotes : null,
        }
      : null,
    counts: {
      rsvps: rsvpCounts,
      deckDeclarations: deckDeclarationCount,
      pods: podCount,
      loggedGames: loggedGameCount,
    },
  };
}

export async function listUpcomingEventsForViewer(
  db: PlanningDatabase,
  input: {
    viewerUserId: string | null;
    now?: Date;
    page?: PageRequest;
  },
): Promise<UpcomingEventListItem[]> {
  const page = normalizePageRequest(input.page);
  const membershipPredicate = input.viewerUserId
    ? eq(playgroupMemberships.userId, input.viewerUserId)
    : sql`false`;
  const visibilityPredicate = input.viewerUserId
    ? sql`${playgroupMemberships.id} is not null`
    : eq(events.visibility, "public_safe");

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      visibility: events.visibility,
      playgroupId: playgroups.id,
      playgroupName: playgroups.name,
      playgroupSlug: playgroups.slug,
      viewerRole: playgroupMemberships.role,
    })
    .from(events)
    .innerJoin(playgroups, eq(events.playgroupId, playgroups.id))
    .leftJoin(
      playgroupMemberships,
      and(
        eq(events.playgroupId, playgroupMemberships.playgroupId),
        membershipPredicate,
      ),
    )
    .where(
      and(gt(events.startsAt, input.now ?? new Date()), visibilityPredicate),
    )
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(page.limit)
    .offset(page.offset);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    visibility: asEventVisibility(row.visibility),
    playgroup: {
      id: row.playgroupId,
      name: row.playgroupName,
      slug: row.playgroupSlug,
    },
    viewerRole: asPlaygroupRole(row.viewerRole),
  }));
}

export async function getPublicSafeEventSummaryByInviteToken(
  db: PlanningDatabase,
  input: {
    inviteToken: string;
  },
): Promise<PublicSafeEventSummary | null> {
  const eventRow = await getPublicSafeEventRowByInviteToken(db, input);

  if (!eventRow) {
    return null;
  }

  const [rsvpCounts, guestCounts, deckDeclarationCount, podCount, gameCount] =
    await Promise.all([
      countRsvpsByStatus(db, eventRow.id),
      countGuestRsvpsForEvent(db, eventRow.id),
      countDeckDeclarationsForEvent(db, eventRow.id),
      countPodsForEvent(db, eventRow.id),
      countLoggedGamesForEvent(db, eventRow.id),
    ]);

  return {
    id: eventRow.id,
    title: eventRow.title,
    startsAt: eventRow.startsAt,
    endsAt: eventRow.endsAt,
    visibility: asEventVisibility(eventRow.visibility),
    playgroup: {
      id: eventRow.playgroupId,
      name: eventRow.playgroupName,
      slug: eventRow.playgroupSlug,
    },
    location: eventRow.locationId
      ? {
          id: eventRow.locationId,
          name: eventRow.locationName,
        }
      : null,
    counts: {
      rsvps: rsvpCounts,
      guestRsvps: guestCounts.guestRsvps,
      namedGuests: guestCounts.namedGuests,
      deckDeclarations: deckDeclarationCount,
      pods: podCount,
      loggedGames: gameCount,
    },
  };
}

export async function getPublicSafeGuestRsvpSummaryByInviteToken(
  db: PlanningDatabase,
  input: {
    inviteToken: string;
  },
): Promise<PublicSafeGuestRsvpSummary | null> {
  const eventRow = await getPublicSafeEventRowByInviteToken(db, input);

  if (!eventRow) {
    return null;
  }

  const [rsvps, guestCounts] = await Promise.all([
    countRsvpsByStatus(db, eventRow.id),
    countGuestRsvpsForEvent(db, eventRow.id),
  ]);

  return {
    eventId: eventRow.id,
    rsvps,
    guestRsvps: guestCounts.guestRsvps,
    namedGuests: guestCounts.namedGuests,
  };
}

async function getPublicSafeEventRowByInviteToken(
  db: PlanningDatabase,
  input: {
    inviteToken: string;
  },
) {
  const normalizedToken = normalizeInviteToken(input.inviteToken);

  if (!normalizedToken) {
    return null;
  }

  const [eventRow] = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      visibility: events.visibility,
      playgroupId: playgroups.id,
      playgroupName: playgroups.name,
      playgroupSlug: playgroups.slug,
      locationId: eventLocations.id,
      locationName: eventLocations.name,
    })
    .from(events)
    .innerJoin(playgroups, eq(events.playgroupId, playgroups.id))
    .leftJoin(eventLocations, eq(events.locationId, eventLocations.id))
    .where(eq(events.inviteTokenHash, hashInviteToken(normalizedToken)))
    .limit(1);

  return eventRow ?? null;
}

async function getViewerRole(
  db: PlanningDatabase,
  input: {
    playgroupId: string;
    viewerUserId: string | null;
  },
) {
  if (!input.viewerUserId) {
    return null;
  }

  const [membership] = await db
    .select({
      role: playgroupMemberships.role,
    })
    .from(playgroupMemberships)
    .where(
      and(
        eq(playgroupMemberships.playgroupId, input.playgroupId),
        eq(playgroupMemberships.userId, input.viewerUserId),
      ),
    )
    .limit(1);

  return asPlaygroupRole(membership?.role ?? null);
}

async function getViewerRsvpStatus(
  db: PlanningDatabase,
  input: {
    eventId: string;
    viewerUserId: string | null;
  },
) {
  if (!input.viewerUserId) {
    return null;
  }

  const [rsvp] = await db
    .select({
      status: eventRsvps.status,
    })
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, input.eventId),
        eq(eventRsvps.userId, input.viewerUserId),
      ),
    )
    .limit(1);

  return asRsvpStatus(rsvp?.status ?? null);
}

async function getHostAddressVisibilities(
  db: PlanningDatabase,
  eventId: string,
) {
  const rows = await db
    .select({
      addressVisibility: eventHosts.addressVisibility,
    })
    .from(eventHosts)
    .where(eq(eventHosts.eventId, eventId));

  return rows
    .map((row) => asAddressVisibility(row.addressVisibility))
    .filter((visibility) => visibility !== null);
}

async function countRsvpsByStatus(db: PlanningDatabase, eventId: string) {
  const rows = await db
    .select({
      status: eventRsvps.status,
      total: count(),
    })
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId))
    .groupBy(eventRsvps.status);

  const totals: Record<RsvpStatus, number> = {
    yes: 0,
    maybe: 0,
    no: 0,
    waitlist: 0,
  };

  for (const row of rows) {
    const status = asRsvpStatus(row.status);

    if (status) {
      totals[status] = row.total;
    }
  }

  return totals;
}

async function countGuestRsvpsForEvent(db: PlanningDatabase, eventId: string) {
  const [guestRsvpRow, namedGuestRow] = await Promise.all([
    db
      .select({
        total: count(),
      })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), isNull(eventRsvps.userId))),
    db
      .select({
        total: count(),
      })
      .from(eventGuests)
      .where(eq(eventGuests.eventId, eventId)),
  ]);

  return {
    guestRsvps: guestRsvpRow[0]?.total ?? 0,
    namedGuests: namedGuestRow[0]?.total ?? 0,
  };
}

async function countDeckDeclarationsForEvent(
  db: PlanningDatabase,
  eventId: string,
) {
  const [row] = await db
    .select({ total: count() })
    .from(eventDeckDeclarations)
    .where(eq(eventDeckDeclarations.eventId, eventId));

  return row?.total ?? 0;
}

async function countPodsForEvent(db: PlanningDatabase, eventId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(pods)
    .where(eq(pods.eventId, eventId));

  return row?.total ?? 0;
}

async function countLoggedGamesForEvent(db: PlanningDatabase, eventId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(games)
    .where(eq(games.eventId, eventId));

  return row?.total ?? 0;
}

function asRsvpStatus(value: string | null): RsvpStatus | null {
  return includesString(rsvpStatuses, value) ? value : null;
}

function asPlaygroupRole(value: string | null): PlaygroupRole | null {
  return includesString(playgroupRoles, value) ? value : null;
}

function asEventVisibility(value: string): EventVisibility {
  return includesString(eventVisibilities, value) ? value : "members";
}

function asAddressVisibility(value: string): AddressVisibility | null {
  return includesString(addressVisibilities, value) ? value : null;
}

function includesString<const T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return value !== null && values.includes(value as T);
}
