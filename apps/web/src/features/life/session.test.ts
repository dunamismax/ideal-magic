import { describe, expect, test } from "vitest";

import {
  canRedoLifeCounterAction,
  canUndoLifeCounterAction,
  createInitialLifeCounterSession,
  createLifeCounterAction,
  getLifeCounterSnapshot,
  recordLifeCounterAction,
  redoLifeCounterAction,
  resetPlayerCounters,
  undoLifeCounterAction,
} from "./session";

describe("life counter action log", () => {
  test("records explicit typed actions and supports undo, redo, and branching", () => {
    let session = createInitialLifeCounterSession("2026-01-01T00:00:00.000Z");

    session = recordLifeCounterAction(
      session,
      createLifeCounterAction(
        "adjust-life",
        {
          playerId: "player-1",
          amount: -5,
          previousLife: 40,
          nextLife: 35,
        },
        { id: "action-life", createdAt: "2026-01-01T00:00:01.000Z" },
      ),
    );

    expect(session.players[0].life).toBe(35);
    expect(session.history.actions[0].kind).toBe("adjust-life");
    expect(session.history.cursor).toBe(1);
    expect(canUndoLifeCounterAction(session)).toBe(true);
    expect(canRedoLifeCounterAction(session)).toBe(false);

    session = undoLifeCounterAction(session, "2026-01-01T00:00:02.000Z");

    expect(session.players[0].life).toBe(40);
    expect(session.history.cursor).toBe(0);
    expect(canRedoLifeCounterAction(session)).toBe(true);

    session = redoLifeCounterAction(session, "2026-01-01T00:00:03.000Z");

    expect(session.players[0].life).toBe(35);
    expect(session.history.cursor).toBe(1);

    session = undoLifeCounterAction(session, "2026-01-01T00:00:04.000Z");
    session = recordLifeCounterAction(
      session,
      createLifeCounterAction(
        "adjust-poison",
        {
          playerId: "player-1",
          amount: 1,
          previousPoison: 0,
          nextPoison: 1,
        },
        { id: "action-poison", createdAt: "2026-01-01T00:00:05.000Z" },
      ),
    );

    expect(session.players[0].life).toBe(40);
    expect(session.players[0].poison).toBe(1);
    expect(session.history.actions).toHaveLength(1);
    expect(session.history.actions[0].kind).toBe("adjust-poison");
    expect(canRedoLifeCounterAction(session)).toBe(false);
  });

  test("undoes and redoes broad reset actions with before and after snapshots", () => {
    let session = createInitialLifeCounterSession("2026-01-01T00:00:00.000Z");

    session = recordLifeCounterAction(
      session,
      createLifeCounterAction(
        "adjust-life",
        {
          playerId: "player-1",
          amount: -10,
          previousLife: 40,
          nextLife: 30,
        },
        { id: "action-life", createdAt: "2026-01-01T00:00:01.000Z" },
      ),
    );
    session = recordLifeCounterAction(
      session,
      createLifeCounterAction(
        "adjust-poison",
        {
          playerId: "player-1",
          amount: 2,
          previousPoison: 0,
          nextPoison: 2,
        },
        { id: "action-poison", createdAt: "2026-01-01T00:00:02.000Z" },
      ),
    );

    const before = getLifeCounterSnapshot(session);
    const after = {
      ...before,
      players: before.players.map((player) =>
        resetPlayerCounters(player, before.startingLife),
      ),
    };

    session = recordLifeCounterAction(
      session,
      createLifeCounterAction(
        "reset-game",
        { before, after },
        { id: "action-reset", createdAt: "2026-01-01T00:00:03.000Z" },
      ),
    );

    expect(session.players[0].life).toBe(40);
    expect(session.players[0].poison).toBe(0);

    session = undoLifeCounterAction(session, "2026-01-01T00:00:04.000Z");

    expect(session.players[0].life).toBe(30);
    expect(session.players[0].poison).toBe(2);

    session = redoLifeCounterAction(session, "2026-01-01T00:00:05.000Z");

    expect(session.players[0].life).toBe(40);
    expect(session.players[0].poison).toBe(0);
  });

  test("new game is intentional and undoable as a logged session action", () => {
    let session = createInitialLifeCounterSession("2026-01-01T00:00:00.000Z");
    const before = {
      ...getLifeCounterSnapshot(session),
      playerCount: 6,
      players: session.players.map((player, index) =>
        index === 0 ? { ...player, name: "Stephen", life: 12 } : player,
      ),
    };
    session = { ...session, ...before };

    const after = getLifeCounterSnapshot(
      createInitialLifeCounterSession("2026-01-01T00:00:01.000Z"),
    );

    session = recordLifeCounterAction(
      session,
      createLifeCounterAction(
        "new-game",
        { before, after },
        { id: "action-new-game", createdAt: "2026-01-01T00:00:02.000Z" },
      ),
    );

    expect(session.playerCount).toBe(4);
    expect(session.players[0].name).toBe("Player 1");

    session = undoLifeCounterAction(session, "2026-01-01T00:00:03.000Z");

    expect(session.playerCount).toBe(6);
    expect(session.players[0].name).toBe("Stephen");
    expect(session.players[0].life).toBe(12);
  });
});
