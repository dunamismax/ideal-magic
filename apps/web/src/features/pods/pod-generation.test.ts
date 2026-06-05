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
      "theo-user-id",
      "nora-user-id",
      "mina-user-id",
    ]);
    expect(pods[1]?.seats.map((seat) => seat.userId)).toEqual([
      "riley-user-id",
      "ari-user-id",
      "sam-user-id",
    ]);
    expect(pods[0]?.sizeFitScore).toBe(100);
    expect(pods[1]?.sizeFitScore).toBe(75);
    expect(pods[0]?.scoringDetails).toMatchObject({
      method: "draft-rsvp-declaration-v1",
      eligibleParticipantCount: 7,
      podSize: 4,
      maybeCount: 1,
      declaredDeckCount: 4,
    });
  });
});

function participant(
  name: string,
  rsvpStatus: PodGenerationParticipant["rsvpStatus"],
  bracket: "1" | "2" | "3" | "4" | "5",
  power: number,
): PodGenerationParticipant {
  return {
    rsvpId: `${name.toLowerCase()}-rsvp-id`,
    userId: `${name.toLowerCase()}-user-id`,
    displayName: name,
    rsvpStatus,
    arrivalTime: null,
    leavingTime: null,
    deckDeclaration: {
      id: `${name.toLowerCase()}-declaration-id`,
      deckId: `${name.toLowerCase()}-deck-id`,
      deckNameSnapshot: `${name} Deck`,
      commanderSnapshot: [`${name} Commander`],
      colorIdentitySnapshot: "W",
      bracketSnapshot: bracket,
      powerEstimateSnapshot: power,
      archetypeSnapshot: "Midrange",
    },
  };
}
