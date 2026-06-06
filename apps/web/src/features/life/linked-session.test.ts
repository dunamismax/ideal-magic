import { describe, expect, test } from "vitest";

import {
  createEventLifeCounterContextFromParticipants,
  createPodLifeCounterContextFromPublishedPod,
  createScopedLinkedLifeTableSession,
} from "./linked-session";

describe("linked life counter setup", () => {
  test("imports real event participants and declared decks into a local session", () => {
    const context = createEventLifeCounterContextFromParticipants({
      event: {
        id: "50000000-0000-4000-8000-000000000001",
        title: "Friday Commander",
        startsAt: new Date("2030-06-14T23:00:00.000Z"),
      },
      participants: [
        {
          id: "50000000-0000-4000-8000-000000000002",
          participantName: "Riley Chen",
          rsvpStatus: "yes",
          deck: {
            declarationId: "50000000-0000-4000-8000-000000000003",
            deckId: "50000000-0000-4000-8000-000000000004",
            deckNameSnapshot: "Atraxa Counters",
            commanderSnapshot: ["Atraxa, Grand Unifier"],
            colorIdentitySnapshot: "WUBG",
            bracketSnapshot: "3",
            powerEstimateSnapshot: 7,
            archetypeSnapshot: "Counters",
          },
        },
        {
          id: "50000000-0000-4000-8000-000000000005",
          participantName: "Guest RSVP",
          rsvpStatus: "maybe",
          deck: null,
        },
      ],
      now: "2030-06-14T23:30:00.000Z",
    });

    expect(context.session.id).toBe(
      "linked-life:event:50000000-0000-4000-8000-000000000001",
    );
    expect(context.session.playerCount).toBe(2);
    expect(context.session.players[0]).toMatchObject({
      name: "Riley Chen",
      deck: "Atraxa Counters",
      seat: "North",
    });
    expect(context.session.players[0].commanders[0]).toMatchObject({
      id: "player-1-commander-1",
      name: "Atraxa, Grand Unifier",
      damageByDefender: {},
    });
    expect(context.session.players[1]).toMatchObject({
      name: "Guest RSVP",
      deck: "",
      seat: "East",
    });
    expect(JSON.stringify(context)).not.toContain("Private Guest");
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

  test("overlays scoped labels on raw synced table sessions", () => {
    const context = createEventLifeCounterContextFromParticipants({
      event: {
        id: "50000000-0000-4000-8000-000000000001",
        title: "Friday Commander",
        startsAt: new Date("2030-06-14T23:00:00.000Z"),
      },
      participants: [
        {
          id: "50000000-0000-4000-8000-000000000002",
          participantName: "Riley Chen",
          rsvpStatus: "yes",
          deck: {
            declarationId: "50000000-0000-4000-8000-000000000003",
            deckId: "50000000-0000-4000-8000-000000000004",
            deckNameSnapshot: "Atraxa Counters",
            commanderSnapshot: ["Atraxa, Grand Unifier"],
            colorIdentitySnapshot: "WUBG",
            bracketSnapshot: "3",
            powerEstimateSnapshot: 7,
            archetypeSnapshot: "Counters",
          },
        },
        {
          id: "50000000-0000-4000-8000-000000000005",
          participantName: "Guest RSVP",
          rsvpStatus: "maybe",
          deck: null,
        },
      ],
      now: "2030-06-14T23:30:00.000Z",
    });
    const rawSyncedSession = {
      ...context.session,
      players: context.session.players.map((player, index) =>
        index === 1
          ? {
              ...player,
              name: "Private Guest",
              deck: "Private deck",
              commanders: [
                {
                  ...player.commanders[0]!,
                  name: "Private commander",
                  castCount: 2,
                },
              ],
              life: 31,
            }
          : player,
      ),
    };

    const tableSession = createScopedLinkedLifeTableSession(
      rawSyncedSession,
      context.session,
    );

    expect(tableSession.players[1]).toMatchObject({
      name: "Guest RSVP",
      deck: "",
      life: 31,
    });
    expect(tableSession.players[1]?.commanders[0]).toMatchObject({
      name: "Guest RSVP's Commander",
      castCount: 2,
    });
    expect(JSON.stringify(tableSession)).not.toContain("Private Guest");
    expect(JSON.stringify(tableSession)).not.toContain("Private deck");
    expect(JSON.stringify(tableSession)).not.toContain("Private commander");
  });
});
