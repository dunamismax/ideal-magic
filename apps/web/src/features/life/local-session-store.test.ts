import { describe, expect, test } from "vitest";

import {
  createInitialLifeCounterSession,
  createLifeCounterAction,
  recordLifeCounterAction,
} from "./session";
import {
  isCleanupEligibleLifeCounterSession,
  markPersistedLifeCounterSessionGameSaved,
  mergePersistedLifeCounterSession,
  type PersistedLifeCounterSession,
} from "./local-session-store";

describe("local life counter session persistence metadata", () => {
  test("preserves saved-game metadata when the active session autosaves again", () => {
    const session = createSessionWithAction("linked-life:event:event-1");
    const existingSession: PersistedLifeCounterSession = {
      ...session,
      persistedAt: "2026-06-06T00:00:00.000Z",
      savedGames: [
        {
          gameId: "game-1",
          eventId: "event-1",
          savedAt: "2026-06-06T00:01:00.000Z",
          actionCount: 1,
          actionCursor: 1,
        },
      ],
    };
    const nextSession = recordLifeCounterAction(
      session,
      createLifeCounterAction(
        "adjust-poison",
        {
          playerId: "player-2",
          amount: 1,
          previousPoison: 0,
          nextPoison: 1,
        },
        { id: "action-poison", createdAt: "2026-06-06T00:02:00.000Z" },
      ),
    );

    const persisted = mergePersistedLifeCounterSession(
      nextSession,
      existingSession,
    );

    expect(persisted.history.actions).toHaveLength(2);
    expect(persisted.savedGames).toEqual(existingSession.savedGames);
  });

  test("marks a saved game without trimming the local action history", () => {
    const session: PersistedLifeCounterSession = {
      ...createSessionWithAction("linked-life:pod:event-1:pod-1"),
      persistedAt: "2026-06-06T00:00:00.000Z",
    };

    const persisted = markPersistedLifeCounterSessionGameSaved(session, {
      gameId: "game-1",
      eventId: "event-1",
      podId: "pod-1",
      savedAt: "2026-06-06T00:05:00.000Z",
    });

    expect(persisted.history.actions).toHaveLength(1);
    expect(persisted.history.cursor).toBe(1);
    expect(persisted.savedGames).toEqual([
      {
        gameId: "game-1",
        eventId: "event-1",
        podId: "pod-1",
        savedAt: "2026-06-06T00:05:00.000Z",
        actionCount: 1,
        actionCursor: 1,
      },
    ]);
  });

  test("cleanup eligibility excludes the active table even after it is saved", () => {
    const activeSession: PersistedLifeCounterSession = {
      ...createSessionWithAction("linked-life:event:event-1"),
      persistedAt: "2026-06-06T00:00:00.000Z",
      savedGames: [
        {
          gameId: "game-1",
          eventId: "event-1",
          savedAt: "2026-06-06T00:05:00.000Z",
          actionCount: 1,
          actionCursor: 1,
        },
      ],
    };
    const inactiveSession: PersistedLifeCounterSession = {
      ...activeSession,
      id: "linked-life:event:event-2",
    };

    expect(
      isCleanupEligibleLifeCounterSession(
        activeSession,
        "linked-life:event:event-1",
      ),
    ).toBe(false);
    expect(
      isCleanupEligibleLifeCounterSession(
        inactiveSession,
        "linked-life:event:event-1",
      ),
    ).toBe(true);
  });
});

function createSessionWithAction(sessionId: string) {
  const session = createInitialLifeCounterSession("2026-06-06T00:00:00.000Z", {
    id: sessionId,
  });

  return recordLifeCounterAction(
    session,
    createLifeCounterAction(
      "adjust-life",
      {
        playerId: "player-1",
        amount: -5,
        previousLife: 40,
        nextLife: 35,
      },
      { id: "action-life", createdAt: "2026-06-06T00:01:00.000Z" },
    ),
  );
}
