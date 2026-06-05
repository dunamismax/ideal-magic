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
  listEventLifeCounterParticipantsForViewer,
  upsertMemberRsvpForEvent,
} from "./event-planning";
import {
  listLoggedGamesForEventViewer,
  listLoggedGamesForViewer,
  EventGameLoggingAuthorizationError,
  EventGameLoggingBlockedError,
  logGameFromPublishedPod,
  PodGameLoggingAuthorizationError,
  PodGameLoggingBlockedError,
  saveCompletedEventLifeCounterGame,
  saveCompletedPodLifeCounterGame,
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
        (row) =>
          row.leftUserId &&
          row.rightUserId &&
          row.leftDeckId &&
          row.rightDeckId,
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

  test("logs team wins with multiple safe winners and team result fields", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const ownerSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Owner Player",
    );
    const guestSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Guest RSVP",
    );

    if (!ownerSeat || !guestSeat) {
      throw new Error("Expected owner and guest seats in published pod.");
    }

    const logged = await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "team_win",
      winnerSeatIds: [ownerSeat.id, guestSeat.id],
      notes: "Team finish.",
      completedAt: new Date("2030-06-15T04:30:00.000Z"),
    });

    expect(
      logged.players
        .filter((player) => player.isWinner)
        .map((player) => player.participantName),
    ).toEqual(["Owner Player", "Guest RSVP"]);
    expect(JSON.stringify(logged)).not.toContain("Private Guest");

    const persistedPlayers = await db
      .select({
        podSeatId: gamePlayers.podSeatId,
        guestName: gamePlayers.guestName,
        finishPosition: gamePlayers.finishPosition,
        isWinner: gamePlayers.isWinner,
        team: gamePlayers.team,
      })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, logged.id))
      .orderBy(asc(gamePlayers.seatPosition));
    const persistedWinners = persistedPlayers.filter(
      (player) => player.isWinner,
    );

    expect(persistedWinners).toHaveLength(2);
    expect(
      persistedWinners.every((player) => player.finishPosition === 1),
    ).toBe(true);
    expect(
      persistedWinners.every((player) => player.team === "winning_team"),
    ).toBe(true);
    expect(
      persistedWinners.some((player) => player.guestName === "Private Guest"),
    ).toBe(true);

    const [resultRow] = await db
      .select({
        resultType: gameResults.resultType,
        winnerUserId: gameResults.winnerUserId,
        winningDeckId: gameResults.winningDeckId,
        winningTeam: gameResults.winningTeam,
        notes: gameResults.notes,
      })
      .from(gameResults)
      .where(eq(gameResults.gameId, logged.id));

    expect(resultRow).toEqual({
      resultType: "team_win",
      winnerUserId: null,
      winningDeckId: null,
      winningTeam: "winning_team",
      notes: "Team finish.",
    });

    const [history] = await listLoggedGamesForViewer(db, {
      viewerUserId: fixture.ownerId,
    });

    expect(history?.winners.map((winner) => winner.participantName)).toEqual([
      "Owner Player",
      "Guest RSVP",
    ]);
    expect(JSON.stringify(history)).not.toContain("Private Guest");
  });

  test("logs draw results without forcing winner fields", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);

    const logged = await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "draw",
      winnerSeatIds: [],
      notes: "Table agreed to draw.",
    });

    expect(logged.resultType).toBe("draw");
    expect(logged.players.every((player) => !player.isWinner)).toBe(true);

    const persistedPlayers = await db
      .select({
        finishPosition: gamePlayers.finishPosition,
        isWinner: gamePlayers.isWinner,
        team: gamePlayers.team,
      })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, logged.id));

    expect(
      persistedPlayers.every(
        (player) =>
          !player.isWinner &&
          player.finishPosition === null &&
          player.team === null,
      ),
    ).toBe(true);

    const [resultRow] = await db
      .select({
        winnerUserId: gameResults.winnerUserId,
        winningDeckId: gameResults.winningDeckId,
        winningTeam: gameResults.winningTeam,
      })
      .from(gameResults)
      .where(eq(gameResults.gameId, logged.id));

    expect(resultRow).toEqual({
      winnerUserId: null,
      winningDeckId: null,
      winningTeam: null,
    });

    const [history] = await listLoggedGamesForViewer(db, {
      viewerUserId: fixture.ownerId,
    });

    expect(history?.winners).toEqual([]);
  });

  test("rejects invalid winner semantics and foreign winner seats", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const winnerSeat = fixture.publishedPod.seats[0];
    const secondWinnerSeat = fixture.publishedPod.seats[1];

    if (!winnerSeat || !secondWinnerSeat) {
      throw new Error("Expected published pod seats.");
    }

    await expect(
      logGameFromPublishedPod(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        podId: fixture.publishedPod.id,
        resultType: "normal_win",
        winnerSeatIds: [],
      }),
    ).rejects.toThrow(PodGameLoggingBlockedError);

    await expect(
      logGameFromPublishedPod(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        podId: fixture.publishedPod.id,
        resultType: "team_win",
        winnerSeatIds: [winnerSeat.id],
      }),
    ).rejects.toThrow(PodGameLoggingBlockedError);

    await expect(
      logGameFromPublishedPod(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        podId: fixture.publishedPod.id,
        resultType: "draw",
        winnerSeatIds: [winnerSeat.id],
      }),
    ).rejects.toThrow(PodGameLoggingBlockedError);

    await expect(
      logGameFromPublishedPod(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        podId: fixture.publishedPod.id,
        resultType: "team_win",
        winnerSeatIds: [winnerSeat.id, "40000000-0000-4000-8000-000000000999"],
      }),
    ).rejects.toThrow("Winners must be seated in the logged pod.");

    const persistedGames = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.eventId, fixture.eventId));

    expect(persistedGames).toHaveLength(0);
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

  test("lists event-scoped history only for scoped members with safe team winner data", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const ownerSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Owner Player",
    );
    const guestSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Guest RSVP",
    );

    if (!ownerSeat || !guestSeat) {
      throw new Error("Expected owner and guest seats in published pod.");
    }

    const otherEvent = await createEventForPlaygroup(db, {
      viewerUserId: fixture.ownerId,
      playgroupId: fixture.playgroupId,
      title: "Other Event",
      description: "",
      startsAt: new Date("2030-06-22T00:00:00.000Z"),
      visibility: "members",
    });

    await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "team_win",
      winnerSeatIds: [ownerSeat.id, guestSeat.id],
      notes: "Scoped team note",
      completedAt: new Date("2030-06-15T03:45:00.000Z"),
    });

    const eventHistory = await listLoggedGamesForEventViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.memberIds[0] ?? fixture.ownerId,
    });
    const otherEventHistory = await listLoggedGamesForEventViewer(db, {
      eventId: otherEvent.id,
      viewerUserId: fixture.ownerId,
    });
    const outsiderHistory = await listLoggedGamesForEventViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.outsiderId,
    });
    const payload = JSON.stringify(eventHistory);

    expect(eventHistory).toHaveLength(1);
    expect(otherEventHistory).toEqual([]);
    expect(outsiderHistory).toEqual([]);
    expect(eventHistory[0]).toMatchObject({
      event: {
        id: fixture.eventId,
        title: "Published Pod Game Night",
      },
      pod: {
        id: fixture.publishedPod.id,
        name: fixture.publishedPod.name,
      },
      resultType: "team_win",
      notes: "Scoped team note",
    });
    expect(
      eventHistory[0]?.winners.map((winner) => winner.participantName),
    ).toEqual(["Owner Player", "Guest RSVP"]);
    expect(eventHistory[0]?.players).toHaveLength(4);
    expect(payload).toContain("Guest RSVP");
    expect(payload).not.toContain("Private Guest");
    expect(payload).not.toContain("Private guest RSVP note");
    expect(payload).not.toContain("@example.test");
    expect(payload).not.toContain("invite");
    expect(payload).not.toContain("token");
  });

  test("returns event-scoped draw history without winners", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);

    await logGameFromPublishedPod(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "draw",
      winnerSeatIds: [],
      notes: "Table draw.",
      completedAt: new Date("2030-06-15T04:15:00.000Z"),
    });

    const [history] = await listLoggedGamesForEventViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.ownerId,
    });

    expect(history).toMatchObject({
      resultType: "draw",
      notes: "Table draw.",
      winners: [],
    });
    expect(history?.players.every((player) => !player.isWinner)).toBe(true);
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

  test("saves a completed pod life counter result into scoped game history", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const memberSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Member 1",
    );
    const guestSeat = fixture.publishedPod.seats.find(
      (seat) => seat.participantName === "Guest RSVP",
    );

    if (!memberSeat || !guestSeat) {
      throw new Error("Expected member and guest seats in published pod.");
    }

    const logged = await saveCompletedPodLifeCounterGame(db, {
      viewerUserId: fixture.memberIds[0] ?? fixture.ownerId,
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "team_win",
      winnerSeatIds: [memberSeat.id, guestSeat.id],
      notes: "  Saved from pod counter.  ",
      completedAt: new Date("2030-06-15T05:00:00.000Z"),
    });

    expect(logged).toMatchObject({
      eventId: fixture.eventId,
      podId: fixture.publishedPod.id,
      resultType: "team_win",
      notes: "Saved from pod counter.",
    });
    expect(
      logged.players
        .filter((player) => player.isWinner)
        .map((player) => player.participantName),
    ).toEqual(["Member 1", "Guest RSVP"]);
    expect(JSON.stringify(logged)).not.toContain("Private Guest");
    expect(JSON.stringify(logged)).not.toContain("@example.test");

    const [resultRow] = await db
      .select({
        resultType: gameResults.resultType,
        winnerUserId: gameResults.winnerUserId,
        winningDeckId: gameResults.winningDeckId,
        winningTeam: gameResults.winningTeam,
        notes: gameResults.notes,
      })
      .from(gameResults)
      .where(eq(gameResults.gameId, logged.id));

    expect(resultRow).toEqual({
      resultType: "team_win",
      winnerUserId: null,
      winningDeckId: null,
      winningTeam: "winning_team",
      notes: "Saved from pod counter.",
    });

    const historyRows = await db
      .select({
        leftUserId: matchupHistory.leftUserId,
        rightUserId: matchupHistory.rightUserId,
        leftDeckId: matchupHistory.leftDeckId,
        rightDeckId: matchupHistory.rightDeckId,
      })
      .from(matchupHistory)
      .where(eq(matchupHistory.gameId, logged.id));

    expect(historyRows).toHaveLength(3);
    expect(
      historyRows.every(
        (row) =>
          row.leftUserId &&
          row.rightUserId &&
          row.leftDeckId &&
          row.rightDeckId,
      ),
    ).toBe(true);

    const [eventHistory] = await listLoggedGamesForEventViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.ownerId,
    });
    const payload = JSON.stringify(eventHistory);

    expect(eventHistory).toMatchObject({
      id: logged.id,
      resultType: "team_win",
      notes: "Saved from pod counter.",
    });
    expect(
      eventHistory?.winners.map((winner) => winner.participantName),
    ).toEqual(["Member 1", "Guest RSVP"]);
    expect(payload).toContain("Guest RSVP");
    expect(payload).not.toContain("Private Guest");
    expect(payload).not.toContain("Private guest RSVP note");
    expect(payload).not.toContain("@example.test");
    expect(payload).not.toContain("token");
  });

  test("imports safe event life counter participants from RSVPs and deck declarations", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);

    const participants = await listEventLifeCounterParticipantsForViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.ownerId,
    });
    const outsiderParticipants = await listEventLifeCounterParticipantsForViewer(
      db,
      {
        eventId: fixture.eventId,
        viewerUserId: fixture.outsiderId,
      },
    );
    const payload = JSON.stringify(participants);

    expect(participants).toHaveLength(4);
    expect(participants[0]).toMatchObject({
      participantName: "Member 1",
      rsvpStatus: "yes",
      deck: {
        deckNameSnapshot: "Member 1 Deck",
        commanderSnapshot: ["Member 1 Commander"],
      },
    });
    expect(
      participants.map((participant) => participant.participantName),
    ).toContain("Guest RSVP");
    expect(outsiderParticipants).toEqual([]);
    expect(payload).toContain("Guest RSVP");
    expect(payload).not.toContain("Private Guest");
    expect(payload).not.toContain("Private guest RSVP note");
    expect(payload).not.toContain("@example.test");
    expect(payload).not.toContain("token");
  });

  test("saves a completed event life counter result into event-only game history", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const participants = await listEventLifeCounterParticipantsForViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.ownerId,
    });
    const memberParticipant = participants.find(
      (participant) => participant.participantName === "Member 1",
    );
    const guestParticipant = participants.find(
      (participant) => participant.participantName === "Guest RSVP",
    );

    if (!memberParticipant || !guestParticipant) {
      throw new Error("Expected member and guest event participants.");
    }

    const logged = await saveCompletedEventLifeCounterGame(db, {
      viewerUserId: fixture.memberIds[0] ?? fixture.ownerId,
      eventId: fixture.eventId,
      resultType: "team_win",
      winnerParticipantIds: [memberParticipant.id, guestParticipant.id],
      notes: "  Saved from event counter.  ",
      completedAt: new Date("2030-06-15T06:00:00.000Z"),
    });

    expect(logged).toMatchObject({
      eventId: fixture.eventId,
      resultType: "team_win",
      notes: "Saved from event counter.",
    });
    expect(
      logged.players
        .filter((player) => player.isWinner)
        .map((player) => player.participantName),
    ).toEqual(["Member 1", "Guest RSVP"]);
    expect(JSON.stringify(logged)).not.toContain("Private Guest");
    expect(JSON.stringify(logged)).not.toContain("@example.test");

    const [gameRow] = await db
      .select({
        podId: games.podId,
        resultType: games.resultType,
        notes: games.notes,
      })
      .from(games)
      .where(eq(games.id, logged.id));

    expect(gameRow).toEqual({
      podId: null,
      resultType: "team_win",
      notes: "Saved from event counter.",
    });

    const persistedPlayers = await db
      .select({
        podSeatId: gamePlayers.podSeatId,
        userId: gamePlayers.userId,
        guestName: gamePlayers.guestName,
        participantNameSnapshot: gamePlayers.participantNameSnapshot,
        deckNameSnapshot: gamePlayers.deckNameSnapshot,
        isWinner: gamePlayers.isWinner,
        team: gamePlayers.team,
      })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, logged.id))
      .orderBy(asc(gamePlayers.seatPosition));
    const persistedGuest = persistedPlayers.find(
      (player) => player.guestName !== null,
    );

    expect(persistedPlayers.every((player) => player.podSeatId === null)).toBe(
      true,
    );
    expect(persistedPlayers.find((player) => player.isWinner)).toMatchObject({
      participantNameSnapshot: "Member 1",
      deckNameSnapshot: "Member 1 Deck",
      team: "winning_team",
    });
    expect(persistedGuest).toMatchObject({
      userId: null,
      guestName: "Private Guest",
      participantNameSnapshot: "Private Guest",
      isWinner: true,
      team: "winning_team",
    });

    const [resultRow] = await db
      .select({
        resultType: gameResults.resultType,
        winnerUserId: gameResults.winnerUserId,
        winningDeckId: gameResults.winningDeckId,
        winningTeam: gameResults.winningTeam,
        notes: gameResults.notes,
      })
      .from(gameResults)
      .where(eq(gameResults.gameId, logged.id));

    expect(resultRow).toEqual({
      resultType: "team_win",
      winnerUserId: null,
      winningDeckId: null,
      winningTeam: "winning_team",
      notes: "Saved from event counter.",
    });

    const historyRows = await db
      .select({
        leftUserId: matchupHistory.leftUserId,
        rightUserId: matchupHistory.rightUserId,
        leftDeckId: matchupHistory.leftDeckId,
        rightDeckId: matchupHistory.rightDeckId,
      })
      .from(matchupHistory)
      .where(eq(matchupHistory.gameId, logged.id));

    expect(historyRows).toHaveLength(3);
    expect(
      historyRows.every(
        (row) =>
          row.leftUserId &&
          row.rightUserId &&
          row.leftDeckId &&
          row.rightDeckId,
      ),
    ).toBe(true);

    const [eventHistory] = await listLoggedGamesForEventViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.ownerId,
    });
    const payload = JSON.stringify(eventHistory);

    expect(eventHistory).toMatchObject({
      id: logged.id,
      pod: null,
      resultType: "team_win",
      notes: "Saved from event counter.",
    });
    expect(
      eventHistory?.winners.map((winner) => winner.participantName),
    ).toEqual(["Member 1", "Guest RSVP"]);
    expect(payload).toContain("Guest RSVP");
    expect(payload).not.toContain("Private Guest");
    expect(payload).not.toContain("Private guest RSVP note");
    expect(payload).not.toContain("@example.test");
    expect(payload).not.toContain("token");
  });

  test("saves event life counter draw results without winners", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);

    const logged = await saveCompletedEventLifeCounterGame(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      resultType: "draw",
      winnerParticipantIds: [],
      notes: "Event table draw.",
    });

    expect(logged.resultType).toBe("draw");
    expect(logged.players.every((player) => !player.isWinner)).toBe(true);

    const [resultRow] = await db
      .select({
        winnerUserId: gameResults.winnerUserId,
        winningDeckId: gameResults.winningDeckId,
        winningTeam: gameResults.winningTeam,
      })
      .from(gameResults)
      .where(eq(gameResults.gameId, logged.id));

    expect(resultRow).toEqual({
      winnerUserId: null,
      winningDeckId: null,
      winningTeam: null,
    });
  });

  test("denies event life counter saves from non-members and invalid winners", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const participants = await listEventLifeCounterParticipantsForViewer(db, {
      eventId: fixture.eventId,
      viewerUserId: fixture.ownerId,
    });
    const winner = participants[0];

    if (!winner) {
      throw new Error("Expected event participant.");
    }

    await expect(
      saveCompletedEventLifeCounterGame(db, {
        viewerUserId: fixture.outsiderId,
        eventId: fixture.eventId,
        resultType: "normal_win",
        winnerParticipantIds: [winner.id],
      }),
    ).rejects.toBeInstanceOf(EventGameLoggingAuthorizationError);

    await expect(
      saveCompletedEventLifeCounterGame(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        resultType: "normal_win",
        winnerParticipantIds: [],
      }),
    ).rejects.toThrow(EventGameLoggingBlockedError);

    await expect(
      saveCompletedEventLifeCounterGame(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        resultType: "team_win",
        winnerParticipantIds: [
          winner.id,
          "40000000-0000-4000-8000-000000000999",
        ],
      }),
    ).rejects.toThrow("Winners must be eligible event participants.");
  });

  test("denies completed pod life counter saves from non-members", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPublishedPodGameFixture(db);
    const winnerSeat = fixture.publishedPod.seats[0];

    if (!winnerSeat) {
      throw new Error("Expected winner seat.");
    }

    await expect(
      saveCompletedPodLifeCounterGame(db, {
        viewerUserId: fixture.outsiderId,
        eventId: fixture.eventId,
        podId: fixture.publishedPod.id,
        resultType: "normal_win",
        winnerSeatIds: [winnerSeat.id],
      }),
    ).rejects.toBeInstanceOf(PodGameLoggingAuthorizationError);

    await expect(
      listLoggedGamesForEventViewer(db, {
        eventId: fixture.eventId,
        viewerUserId: fixture.ownerId,
      }),
    ).resolves.toEqual([]);
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
