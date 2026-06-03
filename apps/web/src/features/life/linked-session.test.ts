import { describe, expect, test } from "vitest";

import {
  getEventLifeCounterContext,
  getPodLifeCounterContext,
} from "./linked-session";

describe("linked life counter setup", () => {
  test("imports event participants and declared decks into a local session", () => {
    const context = getEventLifeCounterContext(
      "commander-night-demo",
      "2026-06-03T19:00:00.000Z",
    );

    if (!context) {
      throw new Error("Expected event context");
    }

    expect(context.session.id).toBe("linked-life:event:commander-night-demo");
    expect(context.session.playerCount).toBe(6);
    expect(context.session.players[0]).toMatchObject({
      id: "player-1",
      name: "Nora",
      deck: "Graveyard Value",
      seat: "North",
    });
    expect(context.session.players[0].commanders[0]).toMatchObject({
      id: "player-1-commander-1",
      name: "Muldrotha, the Gravetide",
      damageByDefender: {},
    });
    expect(context.session.players[4].commanders).toHaveLength(2);
  });

  test("imports published pod seats in table order", () => {
    const context = getPodLifeCounterContext(
      "commander-night-demo",
      "pod-alpha",
      "2026-06-03T19:30:00.000Z",
    );

    if (!context) {
      throw new Error("Expected pod context");
    }

    expect(context.session.id).toBe(
      "linked-life:pod:commander-night-demo:pod-alpha",
    );
    expect(context.session.playerCount).toBe(4);
    expect(
      context.session.players
        .slice(0, context.session.playerCount)
        .map((player) => `${player.seat}:${player.name}`),
    ).toEqual(["North:Nora", "East:Theo", "South:Mara", "West:Sol"]);
  });

  test("returns null for unknown events and pods", () => {
    expect(getEventLifeCounterContext("missing-event")).toBeNull();
    expect(
      getPodLifeCounterContext("commander-night-demo", "missing-pod"),
    ).toBeNull();
  });
});
