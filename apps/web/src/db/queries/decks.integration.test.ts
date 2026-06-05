import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import {
  eventDeckDeclarations,
  playgroupMemberships,
  users,
} from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import { createEventForPlaygroup } from "./event-planning";
import { createPlaygroupForUser } from "./playgroups";
import {
  createDeckForUser,
  DeckDeclarationAuthorizationError,
  DeckDeclarationDuplicateError,
  DeckOwnershipAuthorizationError,
  DeckPlaygroupAuthorizationError,
  declareDeckForEvent,
  listDecksForOwner,
  listEventDeckDeclarationsForViewer,
  retireDeckForUser,
  undeclareDeckForEvent,
  updateDeckForUser,
} from "./decks";

describe("deck data access", () => {
  test("creates and lists lightweight planning decks for the owner", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000001",
      email: "owner@example.test",
      name: "Deck Owner",
    });

    const deck = await createDeckForUser(db, {
      ownerUserId: "30000000-0000-4000-8000-000000000001",
      name: "Atraxa Counters",
      commanders: ["Atraxa, Grand Unifier"],
      colorIdentity: "WUBG",
      bracket: "3",
      powerEstimate: 7,
      archetype: "Counters",
      tags: ["midrange", "proliferate"],
      visibility: "private",
      playgroupId: null,
      externalUrl: "https://example.test/decks/atraxa",
    });

    expect(deck).toMatchObject({
      name: "Atraxa Counters",
      commanders: ["Atraxa, Grand Unifier"],
      colorIdentity: "WUBG",
      bracket: "3",
      powerEstimate: 7,
      archetype: "Counters",
      tags: ["midrange", "proliferate"],
      visibility: "private",
      externalUrl: "https://example.test/decks/atraxa",
    });
    await expect(
      listDecksForOwner(db, {
        ownerUserId: "30000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toMatchObject([
      {
        id: deck.id,
        name: "Atraxa Counters",
      },
    ]);
    await expect(
      listDecksForOwner(db, {
        ownerUserId: "30000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual([]);
  });

  test("requires membership before scoping a deck to a playgroup", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000003",
      email: "group-owner@example.test",
      name: "Group Owner",
    });
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000004",
      email: "outsider@example.test",
      name: "Outsider",
    });
    const group = await createPlaygroupForUser(db, {
      userId: "30000000-0000-4000-8000-000000000003",
      ownerDisplayName: "Group Owner",
      name: "Deck Scope Pods",
      slugBase: "deck-scope-pods",
      description: "",
    });

    await expect(
      createDeckForUser(db, {
        ownerUserId: "30000000-0000-4000-8000-000000000004",
        name: "Outsider Deck",
        commanders: ["Krenko, Mob Boss"],
        colorIdentity: "R",
        bracket: "2",
        powerEstimate: 5,
        archetype: "Tokens",
        tags: [],
        visibility: "playgroup",
        playgroupId: group.id,
        externalUrl: null,
      }),
    ).rejects.toBeInstanceOf(DeckPlaygroupAuthorizationError);
  });

  test("updates and retires only active decks owned by the viewer", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000008",
      email: "deck-manager@example.test",
      name: "Deck Manager",
    });
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000009",
      email: "other-manager@example.test",
      name: "Other Manager",
    });
    const group = await createPlaygroupForUser(db, {
      userId: "30000000-0000-4000-8000-000000000008",
      ownerDisplayName: "Deck Manager",
      name: "Managed Deck Pods",
      slugBase: "managed-deck-pods",
      description: "",
    });
    const deck = await createDeckForUser(db, {
      ownerUserId: "30000000-0000-4000-8000-000000000008",
      name: "Krenko Tokens",
      commanders: ["Krenko, Mob Boss"],
      colorIdentity: "R",
      bracket: "2",
      powerEstimate: 5,
      archetype: "Tokens",
      tags: ["aggro"],
      visibility: "private",
      playgroupId: null,
      externalUrl: null,
    });

    await expect(
      updateDeckForUser(db, {
        ownerUserId: "30000000-0000-4000-8000-000000000009",
        deckId: deck.id,
        name: "Stolen Deck",
        commanders: ["Slicer, Hired Muscle"],
        colorIdentity: "R",
        bracket: "4",
        powerEstimate: 8,
        archetype: "Voltron",
        tags: [],
        visibility: "private",
        playgroupId: null,
        externalUrl: null,
      }),
    ).rejects.toBeInstanceOf(DeckOwnershipAuthorizationError);

    const updated = await updateDeckForUser(db, {
      ownerUserId: "30000000-0000-4000-8000-000000000008",
      deckId: deck.id,
      name: "Krenko Mob Night",
      commanders: ["Krenko, Mob Boss"],
      colorIdentity: "R",
      bracket: "3",
      powerEstimate: 6,
      archetype: "Token pressure",
      tags: ["tokens", "combat"],
      visibility: "playgroup",
      playgroupId: group.id,
      externalUrl: "https://example.test/decks/krenko",
    });

    expect(updated).toMatchObject({
      id: deck.id,
      name: "Krenko Mob Night",
      bracket: "3",
      powerEstimate: 6,
      archetype: "Token pressure",
      tags: ["tokens", "combat"],
      visibility: "playgroup",
      playgroup: {
        id: group.id,
        name: "Managed Deck Pods",
      },
      externalUrl: "https://example.test/decks/krenko",
    });

    await retireDeckForUser(db, {
      ownerUserId: "30000000-0000-4000-8000-000000000008",
      deckId: deck.id,
    });

    await expect(
      listDecksForOwner(db, {
        ownerUserId: "30000000-0000-4000-8000-000000000008",
      }),
    ).resolves.toEqual([]);
    await expect(
      updateDeckForUser(db, {
        ownerUserId: "30000000-0000-4000-8000-000000000008",
        deckId: deck.id,
        name: "Retired Edit",
        commanders: ["Krenko, Mob Boss"],
        colorIdentity: "R",
        bracket: "2",
        powerEstimate: 5,
        archetype: "Tokens",
        tags: [],
        visibility: "private",
        playgroupId: null,
        externalUrl: null,
      }),
    ).rejects.toBeInstanceOf(DeckOwnershipAuthorizationError);
  });

  test("declares and undeclares own decks for scoped events with immutable snapshots", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000005",
      email: "event-owner@example.test",
      name: "Event Owner",
    });
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000006",
      email: "event-member@example.test",
      name: "Event Member",
    });
    await insertUser(db, {
      id: "30000000-0000-4000-8000-000000000007",
      email: "event-outsider@example.test",
      name: "Event Outsider",
    });
    const group = await createPlaygroupForUser(db, {
      userId: "30000000-0000-4000-8000-000000000005",
      ownerDisplayName: "Event Owner",
      name: "Declaration Pods",
      slugBase: "declaration-pods",
      description: "",
    });
    await db.insert(playgroupMemberships).values({
      playgroupId: group.id,
      userId: "30000000-0000-4000-8000-000000000006",
      role: "member",
      displayName: "Event Member",
    });
    const event = await createEventForPlaygroup(db, {
      viewerUserId: "30000000-0000-4000-8000-000000000005",
      playgroupId: group.id,
      title: "Declaration Night",
      description: "",
      startsAt: new Date("2030-08-01T23:00:00.000Z"),
      visibility: "members",
    });
    const deck = await createDeckForUser(db, {
      ownerUserId: "30000000-0000-4000-8000-000000000006",
      name: "Muldrotha Value",
      commanders: ["Muldrotha, the Gravetide"],
      colorIdentity: "UBG",
      bracket: "3",
      powerEstimate: 6,
      archetype: "Graveyard value",
      tags: ["graveyard", "midrange"],
      visibility: "playgroup",
      playgroupId: group.id,
      externalUrl: "https://example.test/decks/muldrotha",
    });

    const declaration = await declareDeckForEvent(db, {
      viewerUserId: "30000000-0000-4000-8000-000000000006",
      eventId: event.id,
      deckId: deck.id,
      preference: 2,
    });

    expect(declaration).toMatchObject({
      eventId: event.id,
      userId: "30000000-0000-4000-8000-000000000006",
      deckId: deck.id,
      preference: 2,
      deckNameSnapshot: "Muldrotha Value",
      commanderSnapshot: ["Muldrotha, the Gravetide"],
      colorIdentitySnapshot: "UBG",
      bracketSnapshot: "3",
      powerEstimateSnapshot: 6,
      archetypeSnapshot: "Graveyard value",
      tagsSnapshot: ["graveyard", "midrange"],
      visibilitySnapshot: "playgroup",
      externalUrlSnapshot: "https://example.test/decks/muldrotha",
    });

    await updateDeckForUser(db, {
      ownerUserId: "30000000-0000-4000-8000-000000000006",
      deckId: deck.id,
      name: "Edited Muldrotha",
      commanders: ["Muldrotha, the Gravetide", "Kodama of the East Tree"],
      colorIdentity: "G",
      bracket: "4",
      powerEstimate: 8,
      archetype: "Combo",
      tags: ["combo"],
      visibility: "playgroup",
      playgroupId: group.id,
      externalUrl: "https://example.test/decks/edited",
    });

    await expect(
      listEventDeckDeclarationsForViewer(db, {
        eventId: event.id,
        viewerUserId: "30000000-0000-4000-8000-000000000006",
      }),
    ).resolves.toMatchObject([
      {
        id: declaration.id,
        deckNameSnapshot: "Muldrotha Value",
        commanderSnapshot: ["Muldrotha, the Gravetide"],
        colorIdentitySnapshot: "UBG",
        bracketSnapshot: "3",
        powerEstimateSnapshot: 6,
        archetypeSnapshot: "Graveyard value",
        tagsSnapshot: ["graveyard", "midrange"],
        externalUrlSnapshot: "https://example.test/decks/muldrotha",
      },
    ]);

    await expect(
      declareDeckForEvent(db, {
        viewerUserId: "30000000-0000-4000-8000-000000000006",
        eventId: event.id,
        deckId: deck.id,
        preference: 3,
      }),
    ).rejects.toBeInstanceOf(DeckDeclarationDuplicateError);
    await expect(
      declareDeckForEvent(db, {
        viewerUserId: "30000000-0000-4000-8000-000000000007",
        eventId: event.id,
        deckId: deck.id,
        preference: 1,
      }),
    ).rejects.toBeInstanceOf(DeckDeclarationAuthorizationError);

    await expect(
      undeclareDeckForEvent(db, {
        viewerUserId: "30000000-0000-4000-8000-000000000007",
        declarationId: declaration.id,
      }),
    ).rejects.toBeInstanceOf(DeckDeclarationAuthorizationError);

    await undeclareDeckForEvent(db, {
      viewerUserId: "30000000-0000-4000-8000-000000000006",
      declarationId: declaration.id,
    });

    await expect(
      db
        .select({
          id: eventDeckDeclarations.id,
        })
        .from(eventDeckDeclarations)
        .where(eq(eventDeckDeclarations.id, declaration.id)),
    ).resolves.toEqual([]);
  });
});

async function insertUser(
  db: Pick<AppDatabase, "insert">,
  input: {
    id: string;
    email: string;
    name: string;
  },
) {
  await db.insert(users).values(input);
}
