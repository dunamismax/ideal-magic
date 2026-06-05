import { asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import {
  eventRsvps,
  gamePlayers,
  gameResults,
  games,
  matchupHistory,
  playgroupMemberships,
  podSeats,
  pods,
  users,
} from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import {
  createDeckForUser,
  declareDeckForEvent,
  updateDeckForUser,
} from "./decks";
import {
  createEventForPlaygroup,
  upsertMemberRsvpForEvent,
} from "./event-planning";
import {
  listLoggedGamesForViewer,
  logGameFromPublishedPod,
  PodGameLoggingAuthorizationError,
} from "./games";
import { createPlaygroupForUser } from "./playgroups";
import {
  generateDraftPodsForEvent,
  listPodsForEventViewer,
  publishPodsForEventManager,
} from "./pods";

describe("game logging data access", () => {
  test("logs a published pod and writes game, result, players, and matchup history", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const ownerSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Owner Player",
    );

    if (!ownerSeat) {
      throw new Error("Expected owner seat in published pod.");
    }

    await updateDeckForUser(db, {
      ownerUserId: fixture.ownerId,
      deckId: fixture.ownerDeckId,
      name: "Edited After Pod",
      commanders: ["Edited Commander"],
      colorIdentity: "WUBRG",
      bracket: "5",
      powerEstimate: 10,
      archetype: "Edited",
      tags: ["edited"],
      visibility: "playgroup",
      playgroupId: fixture.playgroupId,
      externalUrl: null,
    });

    const beforeHistory = await db
      .select({ id: matchupHistory.id })
      .from(matchupHistory)
      .where(eq(matchupHistory.eventId, fixture.eventId));
    const logged = await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "combat_win",
      winnerSeatIds: [ownerSeat.id],
      notes: "  Quick combat finish.  ",
      completedAt: new Date("2030-06-15T02:30:00.000Z"),
    });

    expect(logged).toMatchObject({
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "combat_win",
      notes: "Quick combat finish.",
    });
    expect(logged.players).toHaveLength(4);
    expect(logged.players.find((player) => player.isWinner)).toMatchObject({
      podSeatId: ownerSeat.id,
      participantName: "Owner Player",
      deck: {
        deckNameSnapshot: "Owner Deck",
        commanderSnapshot: ["Owner Commander"],
        bracketSnapshot: "2",
      },
    });
    expect(JSON.stringify(logged)).toContain("Guest RSVP");
    expect(JSON.stringify(logged)).not.toContain("Private Guest");

    const [gameRow] = await db
      .select({
        id: games.id,
        podId: games.podId,
        resultType: games.resultType,
        notes: games.notes,
      })
      .from(games)
      .where(eq(games.id, logged.id));

    expect(gameRow).toEqual({
      id: logged.id,
      podId: fixture.publishedPod.id,
      resultType: "combat_win",
      notes: "Quick combat finish.",
    });

    const persistedPlayers = await db
      .select({
        podSeatId: gamePlayers.podSeatId,
        userId: gamePlayers.userId,
        guestName: gamePlayers.guestName,
        participantNameSnapshot: gamePlayers.participantNameSnapshot,
        deckNameSnapshot: gamePlayers.deckNameSnapshot,
        commanderSnapshot: gamePlayers.commanderSnapshot,
        colorIdentitySnapshot: gamePlayers.colorIdentitySnapshot,
        bracketSnapshot: gamePlayers.bracketSnapshot,
        powerEstimateSnapshot: gamePlayers.powerEstimateSnapshot,
        archetypeSnapshot: gamePlayers.archetypeSnapshot,
        isWinner: gamePlayers.isWinner,
      })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, logged.id))
      .orderBy(asc(gamePlayers.seatPosition));
    const ownerPlayer = persistedPlayers.find(
      (player) => player.userId === fixture.ownerId,
    );
    const guestPlayer = persistedPlayers.find(
      (player) => player.guestName !== null,
    );

    expect(ownerPlayer).toMatchObject({
      participantNameSnapshot: "Owner Player",
      deckNameSnapshot: "Owner Deck",
      commanderSnapshot: ["Owner Commander"],
      colorIdentitySnapshot: "WUB",
      bracketSnapshot: "2",
      powerEstimateSnapshot: 7,
      archetypeSnapshot: "Control",
      isWinner: true,
    });
    expect(ownerPlayer?.deckNameSnapshot).not.toBe("Edited After Pod");
    expect(guestPlayer).toMatchObject({
      userId: null,
      guestName: "Private Guest",
      participantNameSnapshot: "Private Guest",
      deckNameSnapshot: "",
      commanderSnapshot: [],
    });

    const [resultRow] = await db
      .select({
        resultType: gameResults.resultType,
        winnerUserId: gameResults.winnerUserId,
        winningDeckId: gameResults.winningDeckId,
        notes: gameResults.notes,
      })
      .from(gameResults)
      .where(eq(gameResults.gameId, logged.id));

    expect(resultRow).toMatchObject({
      resultType: "combat_win",
      winnerUserId: fixture.ownerId,
      winningDeckId: fixture.ownerDeckId,
      notes: "Quick combat finish.",
    });

    const afterHistory = await db
      .select({
        leftUserId: matchupHistory.leftUserId,
        rightUserId: matchupHistory.rightUserId,
        leftDeckId: matchupHistory.leftDeckId,
        rightDeckId: matchupHistory.rightDeckId,
      })
      .from(matchupHistory)
      .where(eq(matchupHistory.eventId, fixture.eventId));

    expect(beforeHistory).toHaveLength(0);
    expect(afterHistory).toHaveLength(3);
    expect(
      afterHistory.every(
        (row) => row.leftUserId && row.rightUserId && row.leftDeckId && row.rightDeckId,
      ),
    ).toBe(true);

    const [completedPod] = await db
      .select({
        state: pods.state,
      })
      .from(pods)
      .where(eq(pods.id, fixture.publishedPod.id));

    expect(completedPod?.state).toBe("completed");
  });

  test("allows scoped pod participants but rejects non-members", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const winnerSeat = fixture.publishedPod.seats[0];

    if (!winnerSeat) {
      throw new Error("Expected winner seat in published pod.");
    }

    await expect(
      logGameFromPublishedPod(db, {
        viewerUserId: fixture.outsiderId,
        eventId: fixture.eventId,
        podId: fixture.publishedPod.id,
        resultType: "normal_win",
        winnerSeatIds: [winnerSeat.id],
      }),
    ).rejects.toBeInstanceOf(PodGameLoggingAuthorizationError);

    const loggedByParticipant = await logGameFromPublishedPod(db, {
      viewerUserId: fixture.memberIds[0] ?? fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "normal_win",
      winnerSeatIds: [winnerSeat.id],
    });

    expect(loggedByParticipant.players).toHaveLength(4);
  });

  test("keeps guest details out of participant pod summaries after logging", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);

    await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "draw",
      notes: "Shared table note",
    });

    const memberPods = await listPodsForEventViewer(db, {
      viewerUserId: fixture.memberIds[1] ?? fixture.ownerId,
      eventId: fixture.eventId,
    });
    const payload = JSON.stringify(memberPods);

    expect(payload).toContain("Guest RSVP");
    expect(payload).not.toContain("Private Guest");
    expect(payload).not.toContain("Private guest RSVP note");
    expect(payload).not.toContain("@example.test");
  });

  test("lists logged game history for scoped members and managers with safe pod context", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const ownerSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Owner Player",
    );

    if (!ownerSeat) {
      throw new Error("Expected owner seat in published pod.");
    }

    await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "normal_win",
      winnerSeatIds: [ownerSeat.id],
      notes: "Scoped game note",
      completedAt: new Date("2030-06-15T03:30:00.000Z"),
    });

    const managerHistory = await listLoggedGamesForViewer(db, {
      viewerUserId: fixture.ownerId,
    });
    const memberHistory = await listLoggedGamesForViewer(db, {
      viewerUserId: fixture.memberIds[0] ?? fixture.ownerId,
    });

    expect(managerHistory).toHaveLength(1);
    expect(memberHistory).toHaveLength(1);
    expect(memberHistory[0]).toMatchObject({
      event: {
        id: fixture.eventId,
        title: "Published Pod Game Night",
      },
      playgroup: {
        id: fixture.playgroupId,
        name: "Game Log Group",
      },
      pod: {
        id: fixture.publishedPod.id,
        name: fixture.publishedPod.name,
      },
      resultType: "normal_win",
      notes: "Scoped game note",
    });
    expect(memberHistory[0]?.players).toHaveLength(4);
    expect(memberHistory[0]?.winners).toEqual([
      {
        id: expect.any(String),
        participantName: "Owner Player",
        deckNameSnapshot: "Owner Deck",
      },
    ]);
  });

  test("rejects logged game history for non-members", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const winnerSeat = fixture.publishedPod.seats[0];

    if (!winnerSeat) {
      throw new Error("Expected winner seat in published pod.");
    }

    await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "normal_win",
      winnerSeatIds: [winnerSeat.id],
    });

    await expect(
      listLoggedGamesForViewer(db, {
        viewerUserId: fixture.outsiderId,
      }),
    ).resolves.toEqual([]);
  });

  test("redacts guest details in logged game history projections", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);

    await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "draw",
      notes: "Shared table note",
    });

    const history = await listLoggedGamesForViewer(db, {
      viewerUserId: fixture.ownerId,
    });
    const payload = JSON.stringify(history);

    expect(payload).toContain("Guest RSVP");
    expect(payload).toContain("Shared table note");
    expect(payload).not.toContain("Private Guest");
    expect(payload).not.toContain("Private guest RSVP note");
    expect(payload).not.toContain("@example.test");
  });

  test("keeps history deck snapshots immutable after later deck edits", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const ownerSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Owner Player",
    );

    if (!ownerSeat) {
      throw new Error("Expected owner seat in published pod.");
    }

    await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "combat_win",
      winnerSeatIds: [ownerSeat.id],
    });

    await updateDeckForUser(db, {
      ownerUserId: fixture.ownerId,
      deckId: fixture.ownerDeckId,
      name: "Edited After History",
      commanders: ["Edited History Commander"],
      colorIdentity: "WUBRG",
      bracket: "5",
      powerEstimate: 10,
      archetype: "Edited",
      tags: ["edited"],
      visibility: "playgroup",
      playgroupId: fixture.playgroupId,
      externalUrl: null,
    });

    const [logged] = await listLoggedGamesForViewer(db, {
      viewerUserId: fixture.ownerId,
    });
    const ownerPlayer = logged?.players.find(
      (player) => player.participantName === "Owner Player",
    );

    expect(ownerPlayer?.deck).toMatchObject({
      deckNameSnapshot: "Owner Deck",
      commanderSnapshot: ["Owner Commander"],
      colorIdentitySnapshot: "WUB",
      bracketSnapshot: "2",
      powerEstimateSnapshot: 7,
      archetypeSnapshot: "Control",
    });
    expect(JSON.stringify(logged)).not.toContain("Edited After History");
    expect(JSON.stringify(logged)).not.toContain("Edited History Commander");
  });
});

async function createPublishedPodGameFixture(db: AppDatabase) {
  const ownerId = "40000000-0000-4000-8000-000000000001";
  const memberIds = [
    "40000000-0000-4000-8000-000000000002",
    "40000000-0000-4000-8000-000000000003",
  ];
  const outsiderId = "40000000-0000-4000-8000-000000000004";
  const allUserIds = [ownerId, ...memberIds, outsiderId];

  await db.insert(users).values(
    allUserIds.map((id, index) => ({
      id,
      email: `game-log-fixture-${index + 1}@example.test`,
      name: index === 0 ? "Owner Player" : `Member ${index}`,
    })),
  );

  const group = await createPlaygroupForUser(db, {
    userId: ownerId,
    ownerDisplayName: "Owner Player",
    name: "Game Log Group",
    slugBase: "game-log-group",
    description: "",
  });

  await db.insert(playgroupMemberships).values(
    memberIds.map((userId, index) => ({
      playgroupId: group.id,
      userId,
      role: "member",
      displayName: `Member ${index + 1}`,
    })),
  );

  const event = await createEventForPlaygroup(db, {
    viewerUserId: ownerId,
    playgroupId: group.id,
    title: "Published Pod Game Night",
    description: "",
    startsAt: new Date("2030-06-15T00:00:00.000Z"),
    visibility: "members",
  });
  const ownerDeck = await createDeckForUser(db, {
    ownerUserId: ownerId,
    name: "Owner Deck",
    commanders: ["Owner Commander"],
    colorIdentity: "WUB",
    bracket: "2",
    powerEstimate: 7,
    archetype: "Control",
    tags: ["fixture"],
    visibility: "playgroup",
    playgroupId: group.id,
    externalUrl: null,
  });

  await declareDeckForEvent(db, {
    viewerUserId: ownerId,
    eventId: event.id,
    deckId: ownerDeck.id,
    preference: 1,
  });
  await upsertMemberRsvpForEvent(db, {
    viewerUserId: ownerId,
    eventId: event.id,
    status: "yes",
    arrivalTime: null,
    leavingTime: null,
  });

  for (const [index, userId] of memberIds.entries()) {
    const deck = await createDeckForUser(db, {
      ownerUserId: userId,
      name: `Member ${index + 1} Deck`,
      commanders: [`Member ${index + 1} Commander`],
      colorIdentity: "RG",
      bracket: "3",
      powerEstimate: 6,
      archetype: "Midrange",
      tags: ["fixture"],
      visibility: "playgroup",
      playgroupId: group.id,
      externalUrl: null,
    });

    await declareDeckForEvent(db, {
      viewerUserId: userId,
      eventId: event.id,
      deckId: deck.id,
      preference: 1,
    });
    await upsertMemberRsvpForEvent(db, {
      viewerUserId: userId,
      eventId: event.id,
      status: "yes",
      arrivalTime: null,
      leavingTime: null,
    });
  }

  await db.insert(eventRsvps).values({
    id: "40000000-0000-4000-8000-000000000101",
    eventId: event.id,
    userId: null,
    guestName: "Private Guest",
    status: "yes",
    notes: "Private guest RSVP note",
  });

  const generated = await generateDraftPodsForEvent(db, {
    viewerUserId: ownerId,
    eventId: event.id,
  });
  const published = await publishPodsForEventManager(db, {
    viewerUserId: ownerId,
    eventId: event.id,
  });
  const publishedPod = published[0];

  if (!generated[0] || !publishedPod) {
    throw new Error("Expected a published pod fixture.");
  }

  const persistedSeats = await db
    .select({
      id: podSeats.id,
    })
    .from(podSeats)
    .where(eq(podSeats.podId, publishedPod.id));

  expect(persistedSeats).toHaveLength(4);

  return {
    eventId: event.id,
    ownerDeckId: ownerDeck.id,
    ownerId,
    memberIds,
    outsiderId,
    playgroupId: group.id,
    publishedPod,
  };
}
