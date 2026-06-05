import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import { normalizePageRequest, type PageRequest } from "../pagination";
import {
  eventDeckDeclarations,
  events,
  gamePlayers,
  gameResults,
  games,
  matchupHistory,
  playgroupMemberships,
  playgroups,
  podSeats,
  pods,
  users,
} from "../schema";
import { canManageEvent, canRsvpToEvent, type PlaygroupRole } from "../scopes";

type GameReadDatabase = Pick<AppDatabase, "select">;
type GameWriteDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "update" | "transaction"
>;

export type GameResultType =
  | "normal_win"
  | "combo_win"
  | "combat_win"
  | "concession"
  | "draw"
  | "time_called"
  | "unfinished"
  | "archenemy_win"
  | "team_win";

export type LoggedPodGameSummary = {
  id: string;
  eventId: string;
  podId: string;
  resultType: GameResultType;
  notes: string;
  completedAt: Date;
  players: {
    id: string;
    podSeatId: string;
    participantName: string;
    seatPosition: number;
    isWinner: boolean;
    deck: {
      deckId: string;
      deckNameSnapshot: string;
      commanderSnapshot: string[];
      colorIdentitySnapshot: string;
      bracketSnapshot: "1" | "2" | "3" | "4" | "5" | null;
      powerEstimateSnapshot: number | null;
      archetypeSnapshot: string;
    } | null;
  }[];
};

export type LoggedGameHistorySummary = {
  id: string;
  event: {
    id: string;
    title: string;
    startsAt: Date;
  };
  playgroup: {
    id: string;
    name: string;
    slug: string;
  };
  pod: {
    id: string;
    name: string;
  } | null;
  resultType: GameResultType;
  notes: string;
  completedAt: Date;
  winners: {
    id: string;
    participantName: string;
    deckNameSnapshot: string;
  }[];
  players: {
    id: string;
    participantName: string;
    seatPosition: number;
    finishPosition: number | null;
    isWinner: boolean;
    deck: {
      deckId: string;
      deckNameSnapshot: string;
      commanderSnapshot: string[];
      colorIdentitySnapshot: string;
      bracketSnapshot: "1" | "2" | "3" | "4" | "5" | null;
      powerEstimateSnapshot: number | null;
      archetypeSnapshot: string;
    } | null;
  }[];
};

export class PodGameLoggingAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot log a game from this pod.");
    this.name = "PodGameLoggingAuthorizationError";
  }
}

export class PodGameLoggingBlockedError extends Error {
  constructor(message = "Game cannot be logged from this pod.") {
    super(message);
    this.name = "PodGameLoggingBlockedError";
  }
}

const resultTypes = [
  "normal_win",
  "combo_win",
  "combat_win",
  "concession",
  "draw",
  "time_called",
  "unfinished",
  "archenemy_win",
  "team_win",
] as const;
const singleWinnerResultTypes = [
  "normal_win",
  "combo_win",
  "combat_win",
  "concession",
  "archenemy_win",
] as const satisfies readonly GameResultType[];
const noWinnerResultTypes = [
  "draw",
  "time_called",
  "unfinished",
] as const satisfies readonly GameResultType[];
const playgroupRoles = [
  "owner",
  "admin",
  "member",
  "host",
  "guest",
  "viewer",
] as const;
const brackets = ["1", "2", "3", "4", "5"] as const;
const loggedGameViewerRoles = ["owner", "admin", "host", "member"] as const;

export async function listLoggedGamesForViewer(
  db: GameReadDatabase,
  input: {
    viewerUserId: string;
    page?: PageRequest;
  },
): Promise<LoggedGameHistorySummary[]> {
  return listScopedLoggedGames(db, input);
}

export async function listLoggedGamesForEventViewer(
  db: GameReadDatabase,
  input: {
    eventId: string;
    viewerUserId: string;
    page?: PageRequest;
  },
): Promise<LoggedGameHistorySummary[]> {
  return listScopedLoggedGames(db, input);
}

async function listScopedLoggedGames(
  db: GameReadDatabase,
  input: {
    viewerUserId: string;
    eventId?: string;
    page?: PageRequest;
  },
): Promise<LoggedGameHistorySummary[]> {
  const page = normalizePageRequest(input.page);
  const gameRows = await db
    .select({
      id: games.id,
      eventId: games.eventId,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      playgroupId: playgroups.id,
      playgroupName: playgroups.name,
      playgroupSlug: playgroups.slug,
      podId: games.podId,
      podName: pods.name,
      resultType: games.resultType,
      notes: games.notes,
      completedAt: games.completedAt,
    })
    .from(games)
    .innerJoin(events, eq(events.id, games.eventId))
    .innerJoin(playgroups, eq(playgroups.id, events.playgroupId))
    .innerJoin(
      playgroupMemberships,
      and(
        eq(playgroupMemberships.playgroupId, events.playgroupId),
        eq(playgroupMemberships.userId, input.viewerUserId),
      ),
    )
    .leftJoin(pods, eq(pods.id, games.podId))
    .where(
      and(
        inArray(playgroupMemberships.role, loggedGameViewerRoles),
        input.eventId ? eq(games.eventId, input.eventId) : undefined,
      ),
    )
    .orderBy(desc(games.completedAt), desc(games.id))
    .limit(page.limit)
    .offset(page.offset);

  if (gameRows.length === 0) {
    return [];
  }

  const gameIds = gameRows.map((game) => game.id);
  const playerRows = await db
    .select({
      id: gamePlayers.id,
      gameId: gamePlayers.gameId,
      guestName: gamePlayers.guestName,
      participantNameSnapshot: gamePlayers.participantNameSnapshot,
      deckId: gamePlayers.deckId,
      deckNameSnapshot: gamePlayers.deckNameSnapshot,
      commanderSnapshot: gamePlayers.commanderSnapshot,
      colorIdentitySnapshot: gamePlayers.colorIdentitySnapshot,
      bracketSnapshot: gamePlayers.bracketSnapshot,
      powerEstimateSnapshot: gamePlayers.powerEstimateSnapshot,
      archetypeSnapshot: gamePlayers.archetypeSnapshot,
      seatPosition: gamePlayers.seatPosition,
      finishPosition: gamePlayers.finishPosition,
      isWinner: gamePlayers.isWinner,
    })
    .from(gamePlayers)
    .where(inArray(gamePlayers.gameId, gameIds))
    .orderBy(asc(gamePlayers.seatPosition), asc(gamePlayers.id));

  const playersByGameId = new Map<string, typeof playerRows>();

  for (const player of playerRows) {
    const players = playersByGameId.get(player.gameId) ?? [];
    players.push(player);
    playersByGameId.set(player.gameId, players);
  }

  return gameRows.map((game) => {
    const players = (playersByGameId.get(game.id) ?? []).map((player) => {
      const participantName =
        player.guestName === null
          ? player.participantNameSnapshot || "Player"
          : "Guest RSVP";

      return {
        id: player.id,
        participantName,
        seatPosition: player.seatPosition,
        finishPosition: player.finishPosition,
        isWinner: player.isWinner,
        deck: player.deckId
          ? {
              deckId: player.deckId,
              deckNameSnapshot: player.deckNameSnapshot,
              commanderSnapshot: player.commanderSnapshot,
              colorIdentitySnapshot: player.colorIdentitySnapshot,
              bracketSnapshot: asBracket(player.bracketSnapshot),
              powerEstimateSnapshot: player.powerEstimateSnapshot,
              archetypeSnapshot: player.archetypeSnapshot,
            }
          : null,
      };
    });

    return {
      id: game.id,
      event: {
        id: game.eventId,
        title: game.eventTitle,
        startsAt: game.eventStartsAt,
      },
      playgroup: {
        id: game.playgroupId,
        name: game.playgroupName,
        slug: game.playgroupSlug,
      },
      pod:
        game.podId && game.podName
          ? {
              id: game.podId,
              name: game.podName,
            }
          : null,
      resultType: asGameResultType(game.resultType),
      notes: game.notes,
      completedAt: game.completedAt,
      winners: players
        .filter((player) => player.isWinner)
        .map((player) => ({
          id: player.id,
          participantName: player.participantName,
          deckNameSnapshot: player.deck?.deckNameSnapshot ?? "",
        })),
      players,
    };
  });
}

export async function logGameFromPublishedPod(
  db: GameWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
    podId: string;
    resultType: GameResultType;
    winnerSeatIds?: readonly string[];
    notes?: string;
    completedAt?: Date;
  },
): Promise<LoggedPodGameSummary> {
  return runInTransaction(db, async (tx) => {
    const context = await getPublishedPodLoggingContext(tx, input);

    if (!context) {
      throw new PodGameLoggingAuthorizationError();
    }

    const viewerRole = await getViewerRole(tx, {
      playgroupId: context.playgroupId,
      viewerUserId: input.viewerUserId,
    });
    const viewerSeat = await getViewerSeatForPod(tx, {
      podId: input.podId,
      viewerUserId: input.viewerUserId,
    });
    const canLogAsManager = Boolean(viewerRole && canManageEvent(viewerRole));
    const canLogAsParticipant = Boolean(
      viewerRole && canRsvpToEvent(viewerRole) && viewerSeat,
    );

    if (!canLogAsManager && !canLogAsParticipant) {
      throw new PodGameLoggingAuthorizationError();
    }

    if (context.eventStatus !== "scheduled") {
      throw new PodGameLoggingBlockedError(
        "Only scheduled events can log pod games.",
      );
    }

    if (context.podState !== "locked" || !context.publishedAt) {
      throw new PodGameLoggingBlockedError(
        "Only published locked pods can be logged.",
      );
    }

    const seats = await listGameLogSeatRows(tx, {
      eventId: input.eventId,
      podId: input.podId,
      playgroupId: context.playgroupId,
    });

    if (seats.length < 2) {
      throw new PodGameLoggingBlockedError(
        "A pod needs at least two seats before logging a game.",
      );
    }

    const winnerSeatIds = new Set(input.winnerSeatIds ?? []);
    const winnerValidationError = validateWinnerCountForResult({
      resultType: input.resultType,
      winnerCount: winnerSeatIds.size,
    });

    if (winnerValidationError) {
      throw new PodGameLoggingBlockedError(winnerValidationError);
    }

    for (const winnerSeatId of winnerSeatIds) {
      if (!seats.some((seat) => seat.id === winnerSeatId)) {
        throw new PodGameLoggingBlockedError(
          "Winners must be seated in the logged pod.",
        );
      }
    }

    const notes = normalizeNotes(input.notes);
    const completedAt = input.completedAt ?? new Date();
    const [game] = await tx
      .insert(games)
      .values({
        eventId: input.eventId,
        podId: input.podId,
        loggedByUserId: input.viewerUserId,
        resultType: input.resultType,
        notes,
        completedAt,
      })
      .returning({
        id: games.id,
        eventId: games.eventId,
        podId: games.podId,
        resultType: games.resultType,
        notes: games.notes,
        completedAt: games.completedAt,
      });

    if (!game?.podId) {
      throw new Error("Expected game insert to return a pod-linked row.");
    }

    const insertedPlayers = await tx
      .insert(gamePlayers)
      .values(
        seats.map((seat) => ({
          gameId: game.id,
          podSeatId: seat.id,
          userId: seat.userId,
          guestName: seat.guestName,
          deckId: seat.deckId,
          participantNameSnapshot: getInternalParticipantName(seat),
          deckNameSnapshot: seat.deckNameSnapshot ?? "",
          commanderSnapshot: seat.commanderSnapshot ?? [],
          colorIdentitySnapshot: seat.colorIdentitySnapshot ?? "",
          bracketSnapshot: asBracket(seat.bracketSnapshot),
          powerEstimateSnapshot: seat.powerEstimateSnapshot,
          archetypeSnapshot: seat.archetypeSnapshot ?? "",
          seatPosition: seat.seatPosition,
          finishPosition: winnerSeatIds.has(seat.id) ? 1 : null,
          isWinner: winnerSeatIds.has(seat.id),
          team:
            input.resultType === "team_win" && winnerSeatIds.has(seat.id)
              ? "winning_team"
              : null,
        })),
      )
      .returning({
        id: gamePlayers.id,
        podSeatId: gamePlayers.podSeatId,
        userId: gamePlayers.userId,
        guestName: gamePlayers.guestName,
        deckId: gamePlayers.deckId,
        participantNameSnapshot: gamePlayers.participantNameSnapshot,
        deckNameSnapshot: gamePlayers.deckNameSnapshot,
        commanderSnapshot: gamePlayers.commanderSnapshot,
        colorIdentitySnapshot: gamePlayers.colorIdentitySnapshot,
        bracketSnapshot: gamePlayers.bracketSnapshot,
        powerEstimateSnapshot: gamePlayers.powerEstimateSnapshot,
        archetypeSnapshot: gamePlayers.archetypeSnapshot,
        seatPosition: gamePlayers.seatPosition,
        isWinner: gamePlayers.isWinner,
      });

    const winners = insertedPlayers.filter((player) => player.isWinner);
    const firstWinner = winners[0];

    await tx.insert(gameResults).values({
      gameId: game.id,
      resultType: input.resultType,
      winnerUserId: winners.length === 1 ? (firstWinner?.userId ?? null) : null,
      winningDeckId:
        winners.length === 1 ? (firstWinner?.deckId ?? null) : null,
      winningTeam: input.resultType === "team_win" ? "winning_team" : null,
      notes,
    });

    const matchupRows = createMatchupHistoryRows({
      gameId: game.id,
      eventId: input.eventId,
      playgroupId: context.playgroupId,
      players: insertedPlayers,
    });

    if (matchupRows.length > 0) {
      await tx.insert(matchupHistory).values(matchupRows).onConflictDoNothing();
    }

    await tx
      .update(pods)
      .set({
        state: "completed",
        updatedAt: completedAt,
      })
      .where(eq(pods.id, input.podId));

    return {
      id: game.id,
      eventId: game.eventId,
      podId: game.podId,
      resultType: asGameResultType(game.resultType),
      notes: game.notes,
      completedAt: game.completedAt,
      players: insertedPlayers
        .sort((left, right) => left.seatPosition - right.seatPosition)
        .map((player) => ({
          id: player.id,
          podSeatId: player.podSeatId ?? "",
          participantName:
            player.guestName === null
              ? player.participantNameSnapshot || "Player"
              : "Guest RSVP",
          seatPosition: player.seatPosition,
          isWinner: player.isWinner,
          deck: player.deckId
            ? {
                deckId: player.deckId,
                deckNameSnapshot: player.deckNameSnapshot,
                commanderSnapshot: player.commanderSnapshot,
                colorIdentitySnapshot: player.colorIdentitySnapshot,
                bracketSnapshot: asBracket(player.bracketSnapshot),
                powerEstimateSnapshot: player.powerEstimateSnapshot,
                archetypeSnapshot: player.archetypeSnapshot,
              }
            : null,
        })),
    };
  });
}

async function getPublishedPodLoggingContext(
  db: GameReadDatabase,
  input: {
    eventId: string;
    podId: string;
  },
) {
  const [row] = await db
    .select({
      eventId: events.id,
      eventStatus: events.status,
      playgroupId: events.playgroupId,
      podId: pods.id,
      podState: pods.state,
      publishedAt: pods.publishedAt,
    })
    .from(events)
    .innerJoin(pods, eq(pods.eventId, events.id))
    .where(and(eq(events.id, input.eventId), eq(pods.id, input.podId)))
    .limit(1);

  return row ?? null;
}

async function getViewerSeatForPod(
  db: GameReadDatabase,
  input: {
    podId: string;
    viewerUserId: string;
  },
) {
  const [seat] = await db
    .select({
      id: podSeats.id,
    })
    .from(podSeats)
    .where(
      and(
        eq(podSeats.podId, input.podId),
        eq(podSeats.userId, input.viewerUserId),
      ),
    )
    .limit(1);

  return seat ?? null;
}

async function listGameLogSeatRows(
  db: GameReadDatabase,
  input: {
    eventId: string;
    podId: string;
    playgroupId: string;
  },
) {
  return db
    .select({
      id: podSeats.id,
      userId: podSeats.userId,
      guestName: podSeats.guestName,
      deckId: podSeats.deckId,
      seatPosition: podSeats.seatPosition,
      displayName: playgroupMemberships.displayName,
      userName: users.name,
      deckNameSnapshot: eventDeckDeclarations.deckNameSnapshot,
      commanderSnapshot: eventDeckDeclarations.commanderSnapshot,
      colorIdentitySnapshot: eventDeckDeclarations.colorIdentitySnapshot,
      bracketSnapshot: eventDeckDeclarations.bracketSnapshot,
      powerEstimateSnapshot: eventDeckDeclarations.powerEstimateSnapshot,
      archetypeSnapshot: eventDeckDeclarations.archetypeSnapshot,
    })
    .from(podSeats)
    .leftJoin(users, eq(users.id, podSeats.userId))
    .leftJoin(
      playgroupMemberships,
      and(
        eq(playgroupMemberships.playgroupId, input.playgroupId),
        eq(playgroupMemberships.userId, podSeats.userId),
      ),
    )
    .leftJoin(
      eventDeckDeclarations,
      eq(eventDeckDeclarations.id, podSeats.deckDeclarationId),
    )
    .where(
      and(eq(podSeats.eventId, input.eventId), eq(podSeats.podId, input.podId)),
    )
    .orderBy(asc(podSeats.seatPosition), asc(podSeats.id));
}

function createMatchupHistoryRows(input: {
  gameId: string;
  eventId: string;
  playgroupId: string;
  players: {
    userId: string | null;
    deckId: string | null;
  }[];
}) {
  const rows: (typeof matchupHistory.$inferInsert)[] = [];

  for (let leftIndex = 0; leftIndex < input.players.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < input.players.length;
      rightIndex += 1
    ) {
      const left = input.players[leftIndex];
      const right = input.players[rightIndex];

      if (!left || !right) {
        continue;
      }

      const userPair = makeOrderedPair(left.userId, right.userId);
      const deckPair = makeOrderedPair(left.deckId, right.deckId);

      if (!userPair && !deckPair) {
        continue;
      }

      rows.push({
        gameId: input.gameId,
        eventId: input.eventId,
        playgroupId: input.playgroupId,
        leftUserId: userPair?.[0] ?? null,
        rightUserId: userPair?.[1] ?? null,
        leftDeckId: deckPair?.[0] ?? null,
        rightDeckId: deckPair?.[1] ?? null,
      });
    }
  }

  return rows;
}

function makeOrderedPair(
  left: string | null,
  right: string | null,
): [string, string] | null {
  if (!left || !right) {
    return null;
  }

  return left < right ? [left, right] : [right, left];
}

function getInternalParticipantName(seat: {
  displayName: string | null;
  guestName: string | null;
  userName: string | null;
}) {
  return seat.guestName ?? seat.displayName ?? seat.userName ?? "Player";
}

function normalizeNotes(notes: string | undefined) {
  return notes?.trim() ?? "";
}

function asGameResultType(value: string): GameResultType {
  return resultTypes.includes(value as GameResultType)
    ? (value as GameResultType)
    : "unfinished";
}

function validateWinnerCountForResult(input: {
  resultType: GameResultType;
  winnerCount: number;
}) {
  if (requiresSingleWinner(input.resultType) && input.winnerCount !== 1) {
    return "This result type requires exactly one winner.";
  }

  if (input.resultType === "team_win" && input.winnerCount < 2) {
    return "Team wins require at least two winners.";
  }

  if (isNoWinnerResultType(input.resultType) && input.winnerCount > 0) {
    return "Draw, time called, and unfinished games do not use winners.";
  }

  return null;
}

function requiresSingleWinner(resultType: GameResultType) {
  return singleWinnerResultTypes.includes(
    resultType as (typeof singleWinnerResultTypes)[number],
  );
}

function isNoWinnerResultType(resultType: GameResultType) {
  return noWinnerResultTypes.includes(
    resultType as (typeof noWinnerResultTypes)[number],
  );
}

function asPlaygroupRole(value: string | null): PlaygroupRole | null {
  return playgroupRoles.includes(value as PlaygroupRole)
    ? (value as PlaygroupRole)
    : null;
}

function asBracket(value: string | null): "1" | "2" | "3" | "4" | "5" | null {
  return brackets.includes(value as "1" | "2" | "3" | "4" | "5")
    ? (value as "1" | "2" | "3" | "4" | "5")
    : null;
}

async function getViewerRole(
  db: GameReadDatabase,
  input: {
    playgroupId: string;
    viewerUserId: string;
  },
) {
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
