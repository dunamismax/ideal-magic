import { and, asc, eq, sql } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import {
  decks,
  eventDeckDeclarations,
  events,
  playgroupMemberships,
  playgroups,
} from "../schema";
import { canRsvpToEvent, type PlaygroupRole } from "../scopes";

type DeckReadDatabase = Pick<AppDatabase, "select">;
type DeckWriteDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

export type DeckVisibility = "private" | "playgroup" | "public";

export type ViewerDeck = {
  id: string;
  name: string;
  commanders: string[];
  colorIdentity: string;
  bracket: "1" | "2" | "3" | "4" | "5" | null;
  powerEstimate: number | null;
  archetype: string;
  tags: string[];
  visibility: DeckVisibility;
  playgroup: {
    id: string;
    name: string;
    slug: string;
  } | null;
  externalUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventDeckDeclaration = {
  id: string;
  eventId: string;
  userId: string;
  deckId: string;
  preference: number;
  deckNameSnapshot: string;
  commanderSnapshot: string[];
  colorIdentitySnapshot: string;
  bracketSnapshot: "1" | "2" | "3" | "4" | "5" | null;
  powerEstimateSnapshot: number | null;
  archetypeSnapshot: string;
  tagsSnapshot: string[];
  visibilitySnapshot: DeckVisibility;
  externalUrlSnapshot: string | null;
  createdAt: Date;
};

export class DeckPlaygroupAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot scope a deck to that playgroup.");
    this.name = "DeckPlaygroupAuthorizationError";
  }
}

export class DeckOwnershipAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot manage that deck.");
    this.name = "DeckOwnershipAuthorizationError";
  }
}

export class DeckDeclarationAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot declare decks for this event.");
    this.name = "DeckDeclarationAuthorizationError";
  }
}

export class DeckDeclarationDuplicateError extends Error {
  constructor() {
    super("Deck is already declared for this event.");
    this.name = "DeckDeclarationDuplicateError";
  }
}

const deckVisibilities = ["private", "playgroup", "public"] as const;
const brackets = ["1", "2", "3", "4", "5"] as const;
const playgroupRoles = [
  "owner",
  "admin",
  "member",
  "host",
  "guest",
  "viewer",
] as const;

export async function createDeckForUser(
  db: DeckWriteDatabase,
  input: {
    ownerUserId: string;
    name: string;
    commanders: string[];
    colorIdentity: string;
    bracket: "1" | "2" | "3" | "4" | "5" | null;
    powerEstimate: number | null;
    archetype: string;
    tags: string[];
    visibility: DeckVisibility;
    playgroupId: string | null;
    externalUrl: string | null;
  },
): Promise<ViewerDeck> {
  return runInTransaction(db, async (tx) => {
    if (input.visibility === "playgroup") {
      const role = input.playgroupId
        ? await getViewerPlaygroupRole(tx, {
            viewerUserId: input.ownerUserId,
            playgroupId: input.playgroupId,
          })
        : null;

      if (!role || !canRsvpToEvent(role)) {
        throw new DeckPlaygroupAuthorizationError();
      }
    }

    const [deck] = await tx
      .insert(decks)
      .values({
        ownerUserId: input.ownerUserId,
        playgroupId: input.playgroupId,
        name: input.name,
        commanders: input.commanders,
        colorIdentity: input.colorIdentity,
        bracket: input.bracket,
        powerEstimate: input.powerEstimate,
        archetype: input.archetype,
        tags: input.tags,
        visibility: input.visibility,
        externalUrl: input.externalUrl,
      })
      .returning({
        id: decks.id,
      });

    if (!deck) {
      throw new Error("Expected deck insert to return a row.");
    }

    const created = await getDeckForOwner(tx, {
      deckId: deck.id,
      ownerUserId: input.ownerUserId,
    });

    if (!created) {
      throw new Error("Expected created deck to be visible to owner.");
    }

    return created;
  });
}

export async function updateDeckForUser(
  db: DeckWriteDatabase,
  input: {
    ownerUserId: string;
    deckId: string;
    name: string;
    commanders: string[];
    colorIdentity: string;
    bracket: "1" | "2" | "3" | "4" | "5" | null;
    powerEstimate: number | null;
    archetype: string;
    tags: string[];
    visibility: DeckVisibility;
    playgroupId: string | null;
    externalUrl: string | null;
  },
): Promise<ViewerDeck> {
  return runInTransaction(db, async (tx) => {
    if (input.visibility === "playgroup") {
      const role = input.playgroupId
        ? await getViewerPlaygroupRole(tx, {
            viewerUserId: input.ownerUserId,
            playgroupId: input.playgroupId,
          })
        : null;

      if (!role || !canRsvpToEvent(role)) {
        throw new DeckPlaygroupAuthorizationError();
      }
    }

    const [updated] = await tx
      .update(decks)
      .set({
        playgroupId: input.playgroupId,
        name: input.name,
        commanders: input.commanders,
        colorIdentity: input.colorIdentity,
        bracket: input.bracket,
        powerEstimate: input.powerEstimate,
        archetype: input.archetype,
        tags: input.tags,
        visibility: input.visibility,
        externalUrl: input.externalUrl,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(decks.id, input.deckId),
          eq(decks.ownerUserId, input.ownerUserId),
          eq(decks.status, "active"),
        ),
      )
      .returning({
        id: decks.id,
      });

    if (!updated) {
      throw new DeckOwnershipAuthorizationError();
    }

    const deck = await getDeckForOwner(tx, {
      deckId: updated.id,
      ownerUserId: input.ownerUserId,
    });

    if (!deck) {
      throw new Error("Expected updated deck to be visible to owner.");
    }

    return deck;
  });
}

export async function retireDeckForUser(
  db: DeckWriteDatabase,
  input: {
    ownerUserId: string;
    deckId: string;
  },
) {
  const [retired] = await db
    .update(decks)
    .set({
      status: "retired",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(decks.id, input.deckId),
        eq(decks.ownerUserId, input.ownerUserId),
        eq(decks.status, "active"),
      ),
    )
    .returning({
      id: decks.id,
    });

  if (!retired) {
    throw new DeckOwnershipAuthorizationError();
  }

  return retired;
}

export async function listDecksForOwner(
  db: DeckReadDatabase,
  input: {
    ownerUserId: string;
  },
): Promise<ViewerDeck[]> {
  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      commanders: decks.commanders,
      colorIdentity: decks.colorIdentity,
      bracket: decks.bracket,
      powerEstimate: decks.powerEstimate,
      archetype: decks.archetype,
      tags: decks.tags,
      visibility: decks.visibility,
      playgroupId: playgroups.id,
      playgroupName: playgroups.name,
      playgroupSlug: playgroups.slug,
      externalUrl: decks.externalUrl,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
    })
    .from(decks)
    .leftJoin(playgroups, eq(decks.playgroupId, playgroups.id))
    .where(
      and(eq(decks.ownerUserId, input.ownerUserId), eq(decks.status, "active")),
    )
    .orderBy(asc(decks.name), asc(decks.id));

  return rows.map(toViewerDeck);
}

export async function listEventDeckDeclarationsForViewer(
  db: DeckReadDatabase,
  input: {
    eventId: string;
    viewerUserId: string;
  },
): Promise<EventDeckDeclaration[]> {
  const [eventRow] = await db
    .select({
      playgroupId: events.playgroupId,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);

  if (!eventRow || eventRow.status === "archived") {
    return [];
  }

  const role = await getViewerPlaygroupRole(db, {
    viewerUserId: input.viewerUserId,
    playgroupId: eventRow.playgroupId,
  });

  if (!role || !canRsvpToEvent(role)) {
    return [];
  }

  return listDeclarationsForUserAndEvent(db, {
    eventId: input.eventId,
    userId: input.viewerUserId,
  });
}

export async function declareDeckForEvent(
  db: DeckWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
    deckId: string;
    preference: number;
  },
): Promise<EventDeckDeclaration> {
  return runInTransaction(db, async (tx) => {
    const [eventRow] = await tx
      .select({
        playgroupId: events.playgroupId,
        status: events.status,
      })
      .from(events)
      .where(eq(events.id, input.eventId))
      .limit(1);

    if (!eventRow || eventRow.status === "archived") {
      throw new DeckDeclarationAuthorizationError();
    }

    const role = await getViewerPlaygroupRole(tx, {
      viewerUserId: input.viewerUserId,
      playgroupId: eventRow.playgroupId,
    });

    if (!role || !canRsvpToEvent(role)) {
      throw new DeckDeclarationAuthorizationError();
    }

    const deck = await getDeckForOwner(tx, {
      deckId: input.deckId,
      ownerUserId: input.viewerUserId,
    });

    if (!deck) {
      throw new DeckDeclarationAuthorizationError();
    }

    const [existing] = await tx
      .select({
        id: eventDeckDeclarations.id,
      })
      .from(eventDeckDeclarations)
      .where(
        and(
          eq(eventDeckDeclarations.eventId, input.eventId),
          eq(eventDeckDeclarations.userId, input.viewerUserId),
          eq(eventDeckDeclarations.deckId, input.deckId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new DeckDeclarationDuplicateError();
    }

    const [declaration] = await tx
      .insert(eventDeckDeclarations)
      .values({
        eventId: input.eventId,
        userId: input.viewerUserId,
        deckId: input.deckId,
        preference: input.preference,
        commanderSnapshot: deck.commanders,
        deckNameSnapshot: deck.name,
        colorIdentitySnapshot: deck.colorIdentity,
        bracketSnapshot: deck.bracket,
        powerEstimateSnapshot: deck.powerEstimate,
        archetypeSnapshot: deck.archetype,
        tagsSnapshot: deck.tags,
        visibilitySnapshot: deck.visibility,
        externalUrlSnapshot: deck.externalUrl,
      })
      .returning({
        id: eventDeckDeclarations.id,
      });

    if (!declaration) {
      throw new Error("Expected deck declaration insert to return a row.");
    }

    const [created] = await listDeclarationsForUserAndEvent(tx, {
      eventId: input.eventId,
      userId: input.viewerUserId,
      declarationId: declaration.id,
    });

    if (!created) {
      throw new Error("Expected created deck declaration to be visible.");
    }

    return created;
  });
}

export async function undeclareDeckForEvent(
  db: DeckWriteDatabase,
  input: {
    viewerUserId: string;
    declarationId: string;
  },
) {
  return runInTransaction(db, async (tx) => {
    const [declaration] = await tx
      .select({
        id: eventDeckDeclarations.id,
        eventId: eventDeckDeclarations.eventId,
        userId: eventDeckDeclarations.userId,
        playgroupId: events.playgroupId,
        eventStatus: events.status,
      })
      .from(eventDeckDeclarations)
      .innerJoin(events, eq(eventDeckDeclarations.eventId, events.id))
      .where(eq(eventDeckDeclarations.id, input.declarationId))
      .limit(1);

    if (
      !declaration ||
      declaration.userId !== input.viewerUserId ||
      declaration.eventStatus === "archived"
    ) {
      throw new DeckDeclarationAuthorizationError();
    }

    const role = await getViewerPlaygroupRole(tx, {
      viewerUserId: input.viewerUserId,
      playgroupId: declaration.playgroupId,
    });

    if (!role || !canRsvpToEvent(role)) {
      throw new DeckDeclarationAuthorizationError();
    }

    await tx
      .delete(eventDeckDeclarations)
      .where(eq(eventDeckDeclarations.id, input.declarationId));

    return {
      id: declaration.id,
      eventId: declaration.eventId,
    };
  });
}

async function getDeckForOwner(
  db: DeckReadDatabase,
  input: {
    deckId: string;
    ownerUserId: string;
  },
): Promise<ViewerDeck | null> {
  const [row] = await db
    .select({
      id: decks.id,
      name: decks.name,
      commanders: decks.commanders,
      colorIdentity: decks.colorIdentity,
      bracket: decks.bracket,
      powerEstimate: decks.powerEstimate,
      archetype: decks.archetype,
      tags: decks.tags,
      visibility: decks.visibility,
      playgroupId: playgroups.id,
      playgroupName: playgroups.name,
      playgroupSlug: playgroups.slug,
      externalUrl: decks.externalUrl,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
    })
    .from(decks)
    .leftJoin(playgroups, eq(decks.playgroupId, playgroups.id))
    .where(
      and(
        eq(decks.id, input.deckId),
        eq(decks.ownerUserId, input.ownerUserId),
        eq(decks.status, "active"),
      ),
    )
    .limit(1);

  return row ? toViewerDeck(row) : null;
}

async function listDeclarationsForUserAndEvent(
  db: DeckReadDatabase,
  input: {
    eventId: string;
    userId: string;
    declarationId?: string;
  },
): Promise<EventDeckDeclaration[]> {
  const rows = await db
    .select({
      id: eventDeckDeclarations.id,
      eventId: eventDeckDeclarations.eventId,
      userId: eventDeckDeclarations.userId,
      deckId: eventDeckDeclarations.deckId,
      preference: eventDeckDeclarations.preference,
      deckNameSnapshot: eventDeckDeclarations.deckNameSnapshot,
      commanderSnapshot: eventDeckDeclarations.commanderSnapshot,
      colorIdentitySnapshot: eventDeckDeclarations.colorIdentitySnapshot,
      bracketSnapshot: eventDeckDeclarations.bracketSnapshot,
      powerEstimateSnapshot: eventDeckDeclarations.powerEstimateSnapshot,
      archetypeSnapshot: eventDeckDeclarations.archetypeSnapshot,
      tagsSnapshot: eventDeckDeclarations.tagsSnapshot,
      visibilitySnapshot: eventDeckDeclarations.visibilitySnapshot,
      externalUrlSnapshot: eventDeckDeclarations.externalUrlSnapshot,
      createdAt: eventDeckDeclarations.createdAt,
    })
    .from(eventDeckDeclarations)
    .where(
      and(
        eq(eventDeckDeclarations.eventId, input.eventId),
        eq(eventDeckDeclarations.userId, input.userId),
        input.declarationId
          ? eq(eventDeckDeclarations.id, input.declarationId)
          : sql`true`,
      ),
    )
    .orderBy(
      asc(eventDeckDeclarations.preference),
      asc(eventDeckDeclarations.id),
    );

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    deckId: row.deckId,
    preference: row.preference,
    deckNameSnapshot: row.deckNameSnapshot,
    commanderSnapshot: row.commanderSnapshot,
    colorIdentitySnapshot: row.colorIdentitySnapshot,
    bracketSnapshot: asBracket(row.bracketSnapshot),
    powerEstimateSnapshot: row.powerEstimateSnapshot,
    archetypeSnapshot: row.archetypeSnapshot,
    tagsSnapshot: row.tagsSnapshot,
    visibilitySnapshot: asDeckVisibility(row.visibilitySnapshot),
    externalUrlSnapshot: row.externalUrlSnapshot,
    createdAt: row.createdAt,
  }));
}

async function getViewerPlaygroupRole(
  db: DeckReadDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
  },
) {
  const [membership] = await db
    .select({
      role: playgroupMemberships.role,
    })
    .from(playgroupMemberships)
    .where(
      and(
        eq(playgroupMemberships.userId, input.viewerUserId),
        eq(playgroupMemberships.playgroupId, input.playgroupId),
      ),
    )
    .limit(1);

  return asPlaygroupRole(membership?.role ?? null);
}

function toViewerDeck(row: {
  id: string;
  name: string;
  commanders: string[];
  colorIdentity: string;
  bracket: string | null;
  powerEstimate: number | null;
  archetype: string;
  tags: string[];
  visibility: string;
  playgroupId: string | null;
  playgroupName: string | null;
  playgroupSlug: string | null;
  externalUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ViewerDeck {
  return {
    id: row.id,
    name: row.name,
    commanders: row.commanders,
    colorIdentity: row.colorIdentity,
    bracket: asBracket(row.bracket),
    powerEstimate: row.powerEstimate,
    archetype: row.archetype,
    tags: row.tags,
    visibility: asDeckVisibility(row.visibility),
    playgroup:
      row.playgroupId && row.playgroupName && row.playgroupSlug
        ? {
            id: row.playgroupId,
            name: row.playgroupName,
            slug: row.playgroupSlug,
          }
        : null,
    externalUrl: row.externalUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asPlaygroupRole(value: string | null): PlaygroupRole | null {
  return includesString(playgroupRoles, value) ? value : null;
}

function asDeckVisibility(value: string): DeckVisibility {
  return includesString(deckVisibilities, value) ? value : "private";
}

function asBracket(value: string | null) {
  return includesString(brackets, value) ? value : null;
}

function includesString<const T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return value !== null && values.includes(value as T);
}
