import { and, asc, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
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
  users,
} from "../schema";
import {
  type AddressVisibility,
  canManageEvent,
  canRsvpToEvent,
  canSeeHostAddress,
  type EventStatus,
  type EventVisibility,
  type PlaygroupRole,
} from "../scopes";
import { normalizePageRequest, type PageRequest } from "../pagination";
import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import { hashInviteToken, normalizeInviteToken } from "../tokens";

type PlanningDatabase = Pick<AppDatabase, "select">;
type PlanningWriteDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "update" | "transaction"
>;

export type RsvpStatus = "yes" | "maybe" | "no" | "waitlist";
export type ManageableEventStatus = Extract<
  EventStatus,
  "cancelled" | "archived"
>;

export type EventPlanningSummary = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  status: EventStatus;
  cancelledAt: Date | null;
  archivedAt: Date | null;
  visibility: EventVisibility;
  addressVisibility: AddressVisibility;
  playgroup: {
    id: string;
    name: string;
    slug: string;
  };
  viewer: {
    role: PlaygroupRole | null;
    rsvpStatus: RsvpStatus | null;
    rsvpArrivalTime: Date | null;
    rsvpLeavingTime: Date | null;
    canRsvp: boolean;
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
  status: EventStatus;
  visibility: EventVisibility;
  playgroup: {
    id: string;
    name: string;
    slug: string;
  };
  viewerRole: PlaygroupRole | null;
};

export type CalendarEventListItem = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  status: Extract<EventStatus, "scheduled" | "cancelled">;
  location: {
    name: string;
    address: {
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      stateProvince: string | null;
      postalCode: string | null;
      country: string | null;
    };
  } | null;
};

export type PublicSafeEventSummary = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  status: EventStatus;
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

export type EventLifeCounterParticipantSummary = {
  id: string;
  participantName: string;
  rsvpStatus: Extract<RsvpStatus, "yes" | "maybe">;
  deck: {
    declarationId: string;
    deckId: string;
    deckNameSnapshot: string;
    commanderSnapshot: string[];
    colorIdentitySnapshot: string;
    bracketSnapshot: "1" | "2" | "3" | "4" | "5" | null;
    powerEstimateSnapshot: number | null;
    archetypeSnapshot: string;
  } | null;
};

export type CreatedEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  status: EventStatus;
  visibility: EventVisibility;
  playgroupId: string;
  createdByUserId: string | null;
};

export type HostLocationSummary = {
  id: string;
  playgroupId: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  notes: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class EventCreationAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot create events for this playgroup.");
    this.name = "EventCreationAuthorizationError";
  }
}

export class EventRsvpAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot RSVP to this event.");
    this.name = "EventRsvpAuthorizationError";
  }
}

export class EventManagementAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot manage this event.");
    this.name = "EventManagementAuthorizationError";
  }
}

export class HostLocationManagementAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot manage host locations for this playgroup.");
    this.name = "HostLocationManagementAuthorizationError";
  }
}

export class HostLocationSelectionError extends Error {
  constructor() {
    super("Location cannot be used for this event.");
    this.name = "HostLocationSelectionError";
  }
}

const rsvpStatuses = ["yes", "maybe", "no", "waitlist"] as const;
const eventStatuses = ["scheduled", "cancelled", "archived"] as const;
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
const brackets = ["1", "2", "3", "4", "5"] as const;

export async function createEventForPlaygroup(
  db: PlanningWriteDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
    title: string;
    description: string;
    startsAt: Date;
    visibility: EventVisibility;
    locationId?: string | null;
    addressVisibility?: AddressVisibility;
  },
): Promise<CreatedEvent> {
  return runInTransaction(db, async (tx) => {
    const role = await getViewerRole(tx, {
      playgroupId: input.playgroupId,
      viewerUserId: input.viewerUserId,
    });

    if (!role || !canManageEvent(role)) {
      throw new EventCreationAuthorizationError();
    }

    if (input.locationId) {
      await assertSelectableHostLocation(tx, {
        locationId: input.locationId,
        playgroupId: input.playgroupId,
      });
    }

    const [event] = await tx
      .insert(events)
      .values({
        playgroupId: input.playgroupId,
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        visibility: input.visibility,
        locationId: input.locationId ?? null,
        createdByUserId: input.viewerUserId,
      })
      .returning({
        id: events.id,
        title: events.title,
        description: events.description,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        status: events.status,
        visibility: events.visibility,
        playgroupId: events.playgroupId,
        createdByUserId: events.createdByUserId,
      });

    if (!event) {
      throw new Error("Expected event insert to return a row.");
    }

    await tx.insert(eventHosts).values({
      eventId: event.id,
      userId: input.viewerUserId,
      addressVisibility: input.addressVisibility ?? "hidden",
    });

    return {
      ...event,
      status: asEventStatus(event.status),
      visibility: asEventVisibility(event.visibility),
    };
  });
}

export async function updateEventForViewer(
  db: PlanningWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
    title: string;
    description: string;
    startsAt: Date;
    visibility: EventVisibility;
    locationId?: string | null;
    addressVisibility?: AddressVisibility;
  },
) {
  return runInTransaction(db, async (tx) => {
    const currentEvent = await assertCanManageEvent(tx, {
      eventId: input.eventId,
      viewerUserId: input.viewerUserId,
    });
    const previousAddressVisibility = await getEventAddressVisibility(
      tx,
      input.eventId,
    );
    const nextLocationId =
      "locationId" in input
        ? (input.locationId ?? null)
        : currentEvent.locationId;
    const nextAddressVisibility =
      "addressVisibility" in input
        ? (input.addressVisibility ?? "hidden")
        : (previousAddressVisibility ?? "hidden");

    if (nextLocationId) {
      await assertSelectableHostLocation(tx, {
        locationId: nextLocationId,
        playgroupId: currentEvent.playgroupId,
      });
    }

    const [updated] = await tx
      .update(events)
      .set({
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        visibility: input.visibility,
        locationId: nextLocationId,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.eventId))
      .returning({
        id: events.id,
        title: events.title,
        description: events.description,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        status: events.status,
        visibility: events.visibility,
        locationId: events.locationId,
        playgroupId: events.playgroupId,
        createdByUserId: events.createdByUserId,
      });

    if (!updated) {
      throw new Error("Expected event update to return a row.");
    }

    const updatedHostRows = await tx
      .update(eventHosts)
      .set({
        addressVisibility: nextAddressVisibility,
      })
      .where(eq(eventHosts.eventId, input.eventId))
      .returning({
        id: eventHosts.id,
      });

    if (updatedHostRows.length === 0) {
      await tx.insert(eventHosts).values({
        eventId: input.eventId,
        userId: input.viewerUserId,
        addressVisibility: nextAddressVisibility,
      });
    }

    if (currentEvent.visibility !== updated.visibility) {
      await recordAuditEvent(tx, {
        action: "event.visibility.changed",
        actorUserId: input.viewerUserId,
        playgroupId: updated.playgroupId,
        eventId: updated.id,
        targetType: "event",
        targetId: updated.id,
        metadata: {
          previousVisibility: currentEvent.visibility,
          newVisibility: updated.visibility,
        },
      });
    }

    if (
      currentEvent.locationId !== updated.locationId ||
      previousAddressVisibility !== nextAddressVisibility
    ) {
      await recordAuditEvent(tx, {
        action: "event.location.changed",
        actorUserId: input.viewerUserId,
        playgroupId: updated.playgroupId,
        eventId: updated.id,
        targetType: "event",
        targetId: updated.id,
        metadata: {
          previousLocationId: currentEvent.locationId,
          newLocationId: updated.locationId,
          previousLocationAccess: previousAddressVisibility,
          newLocationAccess: nextAddressVisibility,
        },
      });
    }

    return {
      ...updated,
      status: asEventStatus(updated.status),
      visibility: asEventVisibility(updated.visibility),
    };
  });
}

export async function listHostLocationsForViewer(
  db: PlanningDatabase,
  input: {
    viewerUserId: string;
    playgroupIds: string[];
    includeArchived?: boolean;
  },
): Promise<HostLocationSummary[]> {
  if (input.playgroupIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: eventLocations.id,
      playgroupId: eventLocations.playgroupId,
      name: eventLocations.name,
      addressLine1: eventLocations.addressLine1,
      addressLine2: eventLocations.addressLine2,
      city: eventLocations.city,
      stateProvince: eventLocations.stateProvince,
      postalCode: eventLocations.postalCode,
      country: eventLocations.country,
      notes: eventLocations.notes,
      archivedAt: eventLocations.archivedAt,
      createdAt: eventLocations.createdAt,
      updatedAt: eventLocations.updatedAt,
    })
    .from(eventLocations)
    .innerJoin(
      playgroupMemberships,
      and(
        eq(playgroupMemberships.playgroupId, eventLocations.playgroupId),
        eq(playgroupMemberships.userId, input.viewerUserId),
      ),
    )
    .where(
      and(
        inArray(eventLocations.playgroupId, input.playgroupIds),
        sql`${playgroupMemberships.role} in ('owner', 'admin', 'host')`,
        input.includeArchived
          ? sql`true`
          : sql`${eventLocations.archivedAt} is null`,
      ),
    )
    .orderBy(
      asc(eventLocations.playgroupId),
      asc(eventLocations.name),
      asc(eventLocations.id),
    );

  return rows.map(toHostLocationSummary);
}

export async function createHostLocationForViewer(
  db: PlanningWriteDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
    name: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    notes: string;
  },
): Promise<HostLocationSummary> {
  return runInTransaction(db, async (tx) => {
    await assertCanManageHostLocations(tx, {
      playgroupId: input.playgroupId,
      viewerUserId: input.viewerUserId,
    });

    const [location] = await tx
      .insert(eventLocations)
      .values({
        playgroupId: input.playgroupId,
        name: input.name,
        addressLine1: input.addressLine1 || null,
        addressLine2: input.addressLine2 || null,
        city: input.city || null,
        stateProvince: input.stateProvince || null,
        postalCode: input.postalCode || null,
        country: input.country || null,
        notes: input.notes,
        createdByUserId: input.viewerUserId,
      })
      .returning({
        id: eventLocations.id,
        playgroupId: eventLocations.playgroupId,
        name: eventLocations.name,
        addressLine1: eventLocations.addressLine1,
        addressLine2: eventLocations.addressLine2,
        city: eventLocations.city,
        stateProvince: eventLocations.stateProvince,
        postalCode: eventLocations.postalCode,
        country: eventLocations.country,
        notes: eventLocations.notes,
        archivedAt: eventLocations.archivedAt,
        createdAt: eventLocations.createdAt,
        updatedAt: eventLocations.updatedAt,
      });

    if (!location) {
      throw new Error("Expected host location insert to return a row.");
    }

    return toHostLocationSummary(location);
  });
}

export async function updateHostLocationForViewer(
  db: PlanningWriteDatabase,
  input: {
    viewerUserId: string;
    locationId: string;
    name: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    notes: string;
  },
): Promise<HostLocationSummary> {
  return runInTransaction(db, async (tx) => {
    await assertCanManageExistingHostLocation(tx, {
      locationId: input.locationId,
      viewerUserId: input.viewerUserId,
    });

    const [location] = await tx
      .update(eventLocations)
      .set({
        name: input.name,
        addressLine1: input.addressLine1 || null,
        addressLine2: input.addressLine2 || null,
        city: input.city || null,
        stateProvince: input.stateProvince || null,
        postalCode: input.postalCode || null,
        country: input.country || null,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(eventLocations.id, input.locationId))
      .returning({
        id: eventLocations.id,
        playgroupId: eventLocations.playgroupId,
        name: eventLocations.name,
        addressLine1: eventLocations.addressLine1,
        addressLine2: eventLocations.addressLine2,
        city: eventLocations.city,
        stateProvince: eventLocations.stateProvince,
        postalCode: eventLocations.postalCode,
        country: eventLocations.country,
        notes: eventLocations.notes,
        archivedAt: eventLocations.archivedAt,
        createdAt: eventLocations.createdAt,
        updatedAt: eventLocations.updatedAt,
      });

    if (!location) {
      throw new Error("Expected host location update to return a row.");
    }

    return toHostLocationSummary(location);
  });
}

export async function archiveHostLocationForViewer(
  db: PlanningWriteDatabase,
  input: {
    viewerUserId: string;
    locationId: string;
    archivedAt?: Date;
  },
) {
  return runInTransaction(db, async (tx) => {
    await assertCanManageExistingHostLocation(tx, {
      locationId: input.locationId,
      viewerUserId: input.viewerUserId,
    });

    const changedAt = input.archivedAt ?? new Date();
    const [location] = await tx
      .update(eventLocations)
      .set({
        archivedAt: changedAt,
        updatedAt: changedAt,
      })
      .where(eq(eventLocations.id, input.locationId))
      .returning({
        id: eventLocations.id,
        archivedAt: eventLocations.archivedAt,
      });

    if (!location) {
      throw new Error("Expected host location archive to return a row.");
    }

    return location;
  });
}

export async function setEventStatusForViewer(
  db: PlanningWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
    status: ManageableEventStatus;
    changedAt?: Date;
  },
) {
  return runInTransaction(db, async (tx) => {
    await assertCanManageEvent(tx, {
      eventId: input.eventId,
      viewerUserId: input.viewerUserId,
    });

    const changedAt = input.changedAt ?? new Date();
    const [updated] = await tx
      .update(events)
      .set({
        status: input.status,
        cancelledAt: input.status === "cancelled" ? changedAt : null,
        archivedAt: input.status === "archived" ? changedAt : null,
        updatedAt: changedAt,
      })
      .where(eq(events.id, input.eventId))
      .returning({
        id: events.id,
        status: events.status,
        cancelledAt: events.cancelledAt,
        archivedAt: events.archivedAt,
      });

    if (!updated) {
      throw new Error("Expected event status update to return a row.");
    }

    return {
      id: updated.id,
      status: asEventStatus(updated.status),
      cancelledAt: updated.cancelledAt,
      archivedAt: updated.archivedAt,
    };
  });
}

export async function upsertMemberRsvpForEvent(
  db: PlanningWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
    status: RsvpStatus;
    arrivalTime: Date | null;
    leavingTime: Date | null;
  },
) {
  return runInTransaction(db, async (tx) => {
    const [eventRow] = await tx
      .select({
        id: events.id,
        playgroupId: events.playgroupId,
      })
      .from(events)
      .where(eq(events.id, input.eventId))
      .limit(1);

    if (!eventRow) {
      throw new EventRsvpAuthorizationError();
    }

    const role = await getViewerRole(tx, {
      playgroupId: eventRow.playgroupId,
      viewerUserId: input.viewerUserId,
    });

    if (!role || !canRsvpToEvent(role)) {
      throw new EventRsvpAuthorizationError();
    }

    const [existingRsvp] = await tx
      .select({
        id: eventRsvps.id,
      })
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, input.eventId),
          eq(eventRsvps.userId, input.viewerUserId),
        ),
      )
      .limit(1);

    if (existingRsvp) {
      const [updated] = await tx
        .update(eventRsvps)
        .set({
          status: input.status,
          arrivalTime: input.arrivalTime,
          leavingTime: input.leavingTime,
          updatedAt: new Date(),
        })
        .where(eq(eventRsvps.id, existingRsvp.id))
        .returning({
          id: eventRsvps.id,
          eventId: eventRsvps.eventId,
          userId: eventRsvps.userId,
          status: eventRsvps.status,
          arrivalTime: eventRsvps.arrivalTime,
          leavingTime: eventRsvps.leavingTime,
        });

      if (!updated) {
        throw new Error("Expected member RSVP update to return a row.");
      }

      return {
        ...updated,
        status: asRsvpStatus(updated.status) ?? input.status,
      };
    }

    const [created] = await tx
      .insert(eventRsvps)
      .values({
        eventId: input.eventId,
        userId: input.viewerUserId,
        status: input.status,
        arrivalTime: input.arrivalTime,
        leavingTime: input.leavingTime,
        guestCount: 0,
        notes: "",
      })
      .returning({
        id: eventRsvps.id,
        eventId: eventRsvps.eventId,
        userId: eventRsvps.userId,
        status: eventRsvps.status,
        arrivalTime: eventRsvps.arrivalTime,
        leavingTime: eventRsvps.leavingTime,
      });

    if (!created) {
      throw new Error("Expected member RSVP insert to return a row.");
    }

    return {
      ...created,
      status: asRsvpStatus(created.status) ?? input.status,
    };
  });
}

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
      status: events.status,
      cancelledAt: events.cancelledAt,
      archivedAt: events.archivedAt,
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

  const viewerRsvp = await getViewerRsvp(db, {
    eventId: eventRow.id,
    viewerUserId: input.viewerUserId,
  });
  const hostVisibilities = await getHostAddressVisibilities(db, eventRow.id);
  const addressVisibility = hostVisibilities[0] ?? "hidden";
  const addressVisible =
    hostVisibilities.length > 0 &&
    hostVisibilities.every((hostVisibility) =>
      canSeeHostAddress(
        viewerRole,
        hostVisibility,
        viewerRsvp?.status ?? undefined,
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
    status: asEventStatus(eventRow.status),
    cancelledAt: eventRow.cancelledAt,
    archivedAt: eventRow.archivedAt,
    visibility,
    addressVisibility,
    playgroup: {
      id: eventRow.playgroupId,
      name: eventRow.playgroupName,
      slug: eventRow.playgroupSlug,
    },
    viewer: {
      role: viewerRole,
      rsvpStatus: viewerRsvp?.status ?? null,
      rsvpArrivalTime: viewerRsvp?.arrivalTime ?? null,
      rsvpLeavingTime: viewerRsvp?.leavingTime ?? null,
      canRsvp: viewerRole ? canRsvpToEvent(viewerRole) : false,
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

export async function listEventLifeCounterParticipantsForViewer(
  db: PlanningDatabase,
  input: {
    eventId: string;
    viewerUserId: string;
  },
): Promise<EventLifeCounterParticipantSummary[]> {
  const [eventRow] = await db
    .select({
      id: events.id,
      playgroupId: events.playgroupId,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);

  if (!eventRow || asEventStatus(eventRow.status) === "archived") {
    return [];
  }

  const viewerRole = await getViewerRole(db, {
    playgroupId: eventRow.playgroupId,
    viewerUserId: input.viewerUserId,
  });

  if (!viewerRole || !canRsvpToEvent(viewerRole)) {
    return [];
  }

  const [memberRows, guestRows, declarationRows] = await Promise.all([
    db
      .select({
        rsvpId: eventRsvps.id,
        userId: eventRsvps.userId,
        status: eventRsvps.status,
        displayName: playgroupMemberships.displayName,
        userName: users.name,
      })
      .from(eventRsvps)
      .innerJoin(users, eq(users.id, eventRsvps.userId))
      .innerJoin(
        playgroupMemberships,
        and(
          eq(playgroupMemberships.playgroupId, eventRow.playgroupId),
          eq(playgroupMemberships.userId, eventRsvps.userId),
        ),
      )
      .where(
        and(
          eq(eventRsvps.eventId, input.eventId),
          sql`${eventRsvps.userId} is not null`,
          sql`${eventRsvps.status} in ('yes', 'maybe')`,
        ),
      )
      .orderBy(asc(playgroupMemberships.displayName), asc(eventRsvps.id)),
    db
      .select({
        rsvpId: eventRsvps.id,
        status: eventRsvps.status,
        guestName: eventRsvps.guestName,
      })
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, input.eventId),
          sql`${eventRsvps.userId} is null`,
          sql`${eventRsvps.status} in ('yes', 'maybe')`,
          sql`${eventRsvps.guestName} is not null`,
        ),
      )
      .orderBy(asc(eventRsvps.guestName), asc(eventRsvps.id)),
    db
      .select({
        id: eventDeckDeclarations.id,
        userId: eventDeckDeclarations.userId,
        deckId: eventDeckDeclarations.deckId,
        deckNameSnapshot: eventDeckDeclarations.deckNameSnapshot,
        commanderSnapshot: eventDeckDeclarations.commanderSnapshot,
        colorIdentitySnapshot: eventDeckDeclarations.colorIdentitySnapshot,
        bracketSnapshot: eventDeckDeclarations.bracketSnapshot,
        powerEstimateSnapshot: eventDeckDeclarations.powerEstimateSnapshot,
        archetypeSnapshot: eventDeckDeclarations.archetypeSnapshot,
      })
      .from(eventDeckDeclarations)
      .where(eq(eventDeckDeclarations.eventId, input.eventId))
      .orderBy(
        asc(eventDeckDeclarations.userId),
        asc(eventDeckDeclarations.preference),
        asc(eventDeckDeclarations.id),
      ),
  ]);
  const declarationsByUserId = new Map<
    string,
    NonNullable<EventLifeCounterParticipantSummary["deck"]>
  >();

  for (const declaration of declarationRows) {
    if (!declarationsByUserId.has(declaration.userId)) {
      declarationsByUserId.set(declaration.userId, {
        declarationId: declaration.id,
        deckId: declaration.deckId,
        deckNameSnapshot: declaration.deckNameSnapshot,
        commanderSnapshot: declaration.commanderSnapshot,
        colorIdentitySnapshot: declaration.colorIdentitySnapshot,
        bracketSnapshot: asBracket(declaration.bracketSnapshot),
        powerEstimateSnapshot: declaration.powerEstimateSnapshot,
        archetypeSnapshot: declaration.archetypeSnapshot,
      });
    }
  }

  const members = memberRows
    .map((row): EventLifeCounterParticipantSummary | null => {
      const status = asEligibleRsvpStatus(row.status);

      if (!row.userId || !status) {
        return null;
      }

      return {
        id: row.rsvpId,
        participantName: row.displayName || row.userName || "Player",
        rsvpStatus: status,
        deck: declarationsByUserId.get(row.userId) ?? null,
      };
    })
    .filter((participant) => participant !== null);
  const guests = guestRows
    .map((row): EventLifeCounterParticipantSummary | null => {
      const status = asEligibleRsvpStatus(row.status);
      const guestName = row.guestName?.trim();

      if (!status || !guestName) {
        return null;
      }

      return {
        id: row.rsvpId,
        participantName: "Guest RSVP",
        rsvpStatus: status,
        deck: null,
      };
    })
    .filter((participant) => participant !== null);

  return [...members, ...guests];
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
      status: events.status,
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
      and(
        gt(events.startsAt, input.now ?? new Date()),
        visibilityPredicate,
        sql`${events.status} <> 'archived'`,
      ),
    )
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(page.limit)
    .offset(page.offset);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    status: asEventStatus(row.status),
    visibility: asEventVisibility(row.visibility),
    playgroup: {
      id: row.playgroupId,
      name: row.playgroupName,
      slug: row.playgroupSlug,
    },
    viewerRole: asPlaygroupRole(row.viewerRole),
  }));
}

export async function listCalendarEventsForViewer(
  db: PlanningDatabase,
  input: {
    viewerUserId: string;
  },
): Promise<CalendarEventListItem[]> {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: events.status,
      playgroupId: events.playgroupId,
      locationId: eventLocations.id,
      locationName: eventLocations.name,
      addressLine1: eventLocations.addressLine1,
      addressLine2: eventLocations.addressLine2,
      city: eventLocations.city,
      stateProvince: eventLocations.stateProvince,
      postalCode: eventLocations.postalCode,
      country: eventLocations.country,
      viewerRole: playgroupMemberships.role,
      viewerRsvpStatus: eventRsvps.status,
    })
    .from(events)
    .innerJoin(
      playgroupMemberships,
      and(
        eq(playgroupMemberships.playgroupId, events.playgroupId),
        eq(playgroupMemberships.userId, input.viewerUserId),
      ),
    )
    .leftJoin(eventLocations, eq(events.locationId, eventLocations.id))
    .leftJoin(
      eventRsvps,
      and(
        eq(eventRsvps.eventId, events.id),
        eq(eventRsvps.userId, input.viewerUserId),
      ),
    )
    .where(sql`${events.status} <> 'archived'`)
    .orderBy(asc(events.startsAt), asc(events.id));

  const hostVisibilitiesByEventId = await getHostAddressVisibilitiesByEventId(
    db,
    rows.map((row) => row.id),
  );

  return rows.map((row) => {
    const role = asPlaygroupRole(row.viewerRole);
    const rsvpStatus = asRsvpStatus(row.viewerRsvpStatus);
    const hostVisibilities = hostVisibilitiesByEventId.get(row.id) ?? [];
    const canSeeAddress =
      row.locationId !== null &&
      hostVisibilities.length > 0 &&
      hostVisibilities.every((visibility) =>
        canSeeHostAddress(role, visibility, rsvpStatus ?? undefined),
      );

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status:
        asEventStatus(row.status) === "cancelled" ? "cancelled" : "scheduled",
      location:
        canSeeAddress && row.locationName
          ? {
              name: row.locationName,
              address: {
                addressLine1: row.addressLine1,
                addressLine2: row.addressLine2,
                city: row.city,
                stateProvince: row.stateProvince,
                postalCode: row.postalCode,
                country: row.country,
              },
            }
          : null,
    };
  });
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
    status: asEventStatus(eventRow.status),
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
      status: events.status,
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
    .where(
      and(
        eq(events.inviteTokenHash, hashInviteToken(normalizedToken)),
        sql`${events.status} <> 'archived'`,
      ),
    )
    .limit(1);

  return eventRow ?? null;
}

async function assertCanManageEvent(
  db: PlanningDatabase,
  input: {
    eventId: string;
    viewerUserId: string;
  },
) {
  const [eventRow] = await db
    .select({
      playgroupId: events.playgroupId,
      status: events.status,
      visibility: events.visibility,
      locationId: events.locationId,
    })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);

  if (!eventRow || asEventStatus(eventRow.status) === "archived") {
    throw new EventManagementAuthorizationError();
  }

  const role = await getViewerRole(db, {
    playgroupId: eventRow.playgroupId,
    viewerUserId: input.viewerUserId,
  });

  if (!role || !canManageEvent(role)) {
    throw new EventManagementAuthorizationError();
  }

  return {
    playgroupId: eventRow.playgroupId,
    status: asEventStatus(eventRow.status),
    visibility: asEventVisibility(eventRow.visibility),
    locationId: eventRow.locationId,
  };
}

async function assertCanManageHostLocations(
  db: PlanningDatabase,
  input: {
    playgroupId: string;
    viewerUserId: string;
  },
) {
  const role = await getViewerRole(db, input);

  if (!role || !canManageEvent(role)) {
    throw new HostLocationManagementAuthorizationError();
  }

  return role;
}

async function assertCanManageExistingHostLocation(
  db: PlanningDatabase,
  input: {
    locationId: string;
    viewerUserId: string;
  },
) {
  const [location] = await db
    .select({
      playgroupId: eventLocations.playgroupId,
      archivedAt: eventLocations.archivedAt,
    })
    .from(eventLocations)
    .where(eq(eventLocations.id, input.locationId))
    .limit(1);

  if (!location || location.archivedAt) {
    throw new HostLocationManagementAuthorizationError();
  }

  await assertCanManageHostLocations(db, {
    playgroupId: location.playgroupId,
    viewerUserId: input.viewerUserId,
  });

  return location;
}

async function assertSelectableHostLocation(
  db: PlanningDatabase,
  input: {
    locationId: string;
    playgroupId: string;
  },
) {
  const [location] = await db
    .select({
      id: eventLocations.id,
    })
    .from(eventLocations)
    .where(
      and(
        eq(eventLocations.id, input.locationId),
        eq(eventLocations.playgroupId, input.playgroupId),
        sql`${eventLocations.archivedAt} is null`,
      ),
    )
    .limit(1);

  if (!location) {
    throw new HostLocationSelectionError();
  }
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

async function getViewerRsvp(
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
      arrivalTime: eventRsvps.arrivalTime,
      leavingTime: eventRsvps.leavingTime,
    })
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, input.eventId),
        eq(eventRsvps.userId, input.viewerUserId),
      ),
    )
    .limit(1);

  const status = asRsvpStatus(rsvp?.status ?? null);

  return status
    ? {
        status,
        arrivalTime: rsvp?.arrivalTime ?? null,
        leavingTime: rsvp?.leavingTime ?? null,
      }
    : null;
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

async function getHostAddressVisibilitiesByEventId(
  db: PlanningDatabase,
  eventIds: string[],
) {
  const visibilitiesByEventId = new Map<string, AddressVisibility[]>();

  if (eventIds.length === 0) {
    return visibilitiesByEventId;
  }

  const rows = await db
    .select({
      eventId: eventHosts.eventId,
      addressVisibility: eventHosts.addressVisibility,
    })
    .from(eventHosts)
    .where(inArray(eventHosts.eventId, eventIds))
    .orderBy(
      asc(eventHosts.eventId),
      asc(eventHosts.createdAt),
      asc(eventHosts.id),
    );

  for (const row of rows) {
    const visibility = asAddressVisibility(row.addressVisibility);

    if (!visibility) {
      continue;
    }

    const visibilities = visibilitiesByEventId.get(row.eventId) ?? [];
    visibilities.push(visibility);
    visibilitiesByEventId.set(row.eventId, visibilities);
  }

  return visibilitiesByEventId;
}

async function getEventAddressVisibility(
  db: PlanningDatabase,
  eventId: string,
) {
  const [row] = await db
    .select({
      addressVisibility: eventHosts.addressVisibility,
    })
    .from(eventHosts)
    .where(eq(eventHosts.eventId, eventId))
    .orderBy(asc(eventHosts.createdAt), asc(eventHosts.id))
    .limit(1);

  return asAddressVisibility(row?.addressVisibility ?? null);
}

function toHostLocationSummary(row: {
  id: string;
  playgroupId: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): HostLocationSummary {
  return {
    id: row.id,
    playgroupId: row.playgroupId,
    name: row.name,
    addressLine1: row.addressLine1 ?? "",
    addressLine2: row.addressLine2 ?? "",
    city: row.city ?? "",
    stateProvince: row.stateProvince ?? "",
    postalCode: row.postalCode ?? "",
    country: row.country ?? "",
    notes: row.notes,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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

function asEventStatus(value: string): EventStatus {
  return includesString(eventStatuses, value) ? value : "scheduled";
}

function asEventVisibility(value: string): EventVisibility {
  return includesString(eventVisibilities, value) ? value : "members";
}

function asAddressVisibility(value: string): AddressVisibility | null {
  return includesString(addressVisibilities, value) ? value : null;
}

function asEligibleRsvpStatus(
  value: string,
): Extract<RsvpStatus, "yes" | "maybe"> | null {
  return value === "yes" || value === "maybe" ? value : null;
}

function asBracket(value: string | null): "1" | "2" | "3" | "4" | "5" | null {
  return includesString(brackets, value) ? value : null;
}

function includesString<const T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return value !== null && values.includes(value as T);
}
