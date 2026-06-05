import { describe, expect, test } from "vitest";

import {
  choosePodSizes,
  generateDraftPodAssignments,
  type PodGenerationParticipant,
} from "./pod-generation";

describe("pod generation", () => {
  test("prefers four-player pods while handling odd attendance", () => {
    expect(choosePodSizes(0)).toEqual([]);
    expect(choosePodSizes(3)).toEqual([3]);
    expect(choosePodSizes(4)).toEqual([4]);
    expect(choosePodSizes(5)).toEqual([5]);
    expect(choosePodSizes(6)).toEqual([3, 3]);
    expect(choosePodSizes(7)).toEqual([4, 3]);
    expect(choosePodSizes(8)).toEqual([4, 4]);
    expect(choosePodSizes(11)).toEqual([4, 4, 3]);
  });

  test("creates deterministic draft pods from RSVP and deck snapshots", () => {
    const pods = generateDraftPodAssignments([
      participant("Mina", "maybe", "2", 5),
      participant("Riley", "yes", "4", 8),
      participant("Theo", "yes", "3", 7),
      participant("Nora", "yes", "2", 6),
      participant("Jules", "yes", "5", 9),
      participant("Sam", "yes", "1", 4),
      participant("Ari", "yes", "3", 6),
    ]);

    expect(pods).toHaveLength(2);
    expect(pods.map((pod) => pod.seats)).toHaveLength(2);
    expect(pods.map((pod) => pod.seats.length)).toEqual([4, 3]);
    expect(pods[0]?.seats.map((seat) => seat.userId)).toEqual([
      "jules-user-id",
      "riley-user-id",
      "theo-user-id",
      "ari-user-id",
    ]);
    expect(pods[1]?.seats.map((seat) => seat.userId)).toEqual([
      "nora-user-id",
      "sam-user-id",
      "mina-user-id",
    ]);
    expect(pods[0]?.sizeFitScore).toBe(100);
    expect(pods[1]?.sizeFitScore).toBe(75);
    expect(pods[0]?.scoringDetails).toMatchObject({
      method: "draft-pod-optimizer-v2",
      eligibleParticipantCount: 7,
      podSize: 4,
      declaredDeckCount: 4,
      repeatPairing: {
        playerPairCount: 0,
        deckMatchupCount: 0,
      },
    });
  });

  test("uses repeat history to change generated pod assignments", () => {
    const participants = ["A", "B", "C", "D", "E", "F", "G", "H"].map(
      (name, index) =>
        participant(name, "yes", "3", 6, {
          colorIdentity: ["W", "U", "B", "R", "G", "WU", "BR", "GU"][index],
          archetype: [
            "Aggro",
            "Control",
            "Combo",
            "Midrange",
            "Ramp",
            "Tokens",
            "Spells",
            "Stax",
          ][index],
        }),
    );

    const withoutHistory = generateDraftPodAssignments(participants);
    const withHistory = generateDraftPodAssignments(participants, {
      matchupHistory: [
        {
          leftUserId: "a-user-id",
          rightUserId: "b-user-id",
          leftDeckId: "a-deck-id",
          rightDeckId: "b-deck-id",
        },
        {
          leftUserId: "c-user-id",
          rightUserId: "d-user-id",
          leftDeckId: "c-deck-id",
          rightDeckId: "d-deck-id",
        },
      ],
    });

    expect(withoutHistory[0]?.seats.map((seat) => seat.userId)).toEqual([
      "a-user-id",
      "b-user-id",
      "c-user-id",
      "d-user-id",
    ]);
    expect(withHistory[0]?.seats.map((seat) => seat.userId)).toEqual([
      "a-user-id",
      "c-user-id",
      "e-user-id",
      "f-user-id",
    ]);
    expect(withHistory[1]?.seats.map((seat) => seat.userId)).toEqual([
      "b-user-id",
      "d-user-id",
      "g-user-id",
      "h-user-id",
    ]);
    expect(withHistory.every((pod) => pod.repeatPlayerPairPenalty === 0)).toBe(
      true,
    );
    expect(withHistory.every((pod) => pod.repeatDeckMatchupPenalty === 0)).toBe(
      true,
    );
  });

  test("scores deck variety and spreads late arrivals", () => {
    const lateArrival = new Date("2030-06-14T23:45:00.000Z");
    const pods = generateDraftPodAssignments([
      participant("Ari", "yes", "3", 6, {
        colorIdentity: "W",
        archetype: "Aggro",
        arrivalTime: lateArrival,
      }),
      participant("Bea", "yes", "3", 6, {
        colorIdentity: "W",
        archetype: "Aggro",
        arrivalTime: lateArrival,
      }),
      participant("Cal", "yes", "3", 6, {
        colorIdentity: "U",
        archetype: "Control",
        arrivalTime: lateArrival,
      }),
      participant("Dee", "yes", "3", 6, {
        colorIdentity: "B",
        archetype: "Combo",
        arrivalTime: lateArrival,
      }),
      participant("Eli", "yes", "3", 6, {
        colorIdentity: "R",
        archetype: "Midrange",
      }),
      participant("Fae", "yes", "3", 6, {
        colorIdentity: "G",
        archetype: "Ramp",
      }),
      participant("Gia", "yes", "3", 6, {
        colorIdentity: "WU",
        archetype: "Tokens",
      }),
      participant("Hal", "yes", "3", 6, {
        colorIdentity: "BR",
        archetype: "Spells",
      }),
    ]);

    expect(
      pods
        .map((pod) => pod.scoringDetails.availability)
        .map((details) =>
          typeof details === "object" && details !== null
            ? Reflect.get(details, "lateArrivalCount")
            : null,
        ),
    ).toEqual([2, 2]);
    expect(
      pods.some((pod) =>
        JSON.stringify(pod.scoringDetails.deckVariety).includes(
          "repeatedColorIdentityCount",
        ),
      ),
    ).toBe(true);
  });
});

type ParticipantOptions = {
  colorIdentity?: string;
  archetype?: string;
  arrivalTime?: Date | null;
  leavingTime?: Date | null;
};

function participant(
  name: string,
  rsvpStatus: PodGenerationParticipant["rsvpStatus"],
  bracket: "1" | "2" | "3" | "4" | "5",
  power: number,
  options: ParticipantOptions = {},
): PodGenerationParticipant {
  return {
    rsvpId: `${name.toLowerCase()}-rsvp-id`,
    userId: `${name.toLowerCase()}-user-id`,
    displayName: name,
    rsvpStatus,
    arrivalTime: options.arrivalTime ?? null,
    leavingTime: options.leavingTime ?? null,
    deckDeclaration: {
      id: `${name.toLowerCase()}-declaration-id`,
      deckId: `${name.toLowerCase()}-deck-id`,
      deckNameSnapshot: `${name} Deck`,
      commanderSnapshot: [`${name} Commander`],
      colorIdentitySnapshot: options.colorIdentity ?? "W",
      bracketSnapshot: bracket,
      powerEstimateSnapshot: power,
      archetypeSnapshot: options.archetype ?? "Midrange",
    },
  };
}
