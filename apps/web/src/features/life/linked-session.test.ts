import { describe, expect, test } from "vitest";

import {
  createPodLifeCounterContextFromPublishedPod,
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

  test("imports real published pod summaries without leaking private guest names", () => {
    const context = createPodLifeCounterContextFromPublishedPod({
      event: {
        id: "50000000-0000-4000-8000-000000000001",
        title: "Friday Commander",
        startsAt: new Date("2030-06-14T23:00:00.000Z"),
      },
      pod: {
        id: "50000000-0000-4000-8000-000000000002",
        name: "Pod 1",
        seats: [
          {
            id: "50000000-0000-4000-8000-000000000003",
            seatPosition: 1,
            participantName: "Riley Chen",
            rsvpStatus: "yes",
            locked: false,
            deck: {
              declarationId: "50000000-0000-4000-8000-000000000004",
              deckId: "50000000-0000-4000-8000-000000000005",
              deckNameSnapshot: "Atraxa Counters",
              commanderSnapshot: ["Atraxa, Grand Unifier"],
              colorIdentitySnapshot: "WUBG",
              bracketSnapshot: "3",
              powerEstimateSnapshot: 7,
              archetypeSnapshot: "Counters",
            },
          },
          {
            id: "50000000-0000-4000-8000-000000000006",
            seatPosition: 2,
            participantName: "Guest RSVP",
            rsvpStatus: "yes",
            locked: false,
            deck: null,
          },
        ],
      },
      now: "2030-06-14T23:30:00.000Z",
    });

    expect(context.session.id).toBe(
      "linked-life:pod:50000000-0000-4000-8000-000000000001:50000000-0000-4000-8000-000000000002",
    );
    expect(context.session.playerCount).toBe(2);
    expect(context.session.players[0]).toMatchObject({
      name: "Riley Chen",
      seat: "North",
      deck: "Atraxa Counters",
    });
    expect(context.session.players[0].commanders[0]?.name).toBe(
      "Atraxa, Grand Unifier",
    );
    expect(context.session.players[1]).toMatchObject({
      name: "Guest RSVP",
      seat: "East",
      deck: "",
    });
    expect(JSON.stringify(context)).not.toContain("Private Guest");
  });
});
