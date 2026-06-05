import { describe, expect, test } from "vitest";

import { validateLogPodGameInput } from "./game-form";

describe("game log form validation", () => {
  test("normalizes a valid quick pod game log", () => {
    const result = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "normal_win",
      winnerSeatIds: ["50000000-0000-4000-8000-000000000003"],
      notes: "  Fast finish.  ",
    });

    expect(result).toEqual({
      ok: true,
      input: {
        eventId: "50000000-0000-4000-8000-000000000001",
        podId: "50000000-0000-4000-8000-000000000002",
        resultType: "normal_win",
        winnerSeatIds: ["50000000-0000-4000-8000-000000000003"],
        notes: "Fast finish.",
      },
    });
  });

  test("rejects invalid ids and result types", () => {
    const result = validateLogPodGameInput({
      eventId: "not-an-event",
      podId: "not-a-pod",
      resultType: "wrong",
      winnerSeatIds: ["not-a-seat"],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors).toMatchObject({
        eventId: "Choose an event.",
        podId: "Choose a pod.",
        resultType: "Choose a result.",
        winnerSeatIds: "Choose winners from this pod.",
      });
    }
  });

  test("requires exactly one winner for single-winner result types", () => {
    const missingWinner = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "combat_win",
      winnerSeatIds: [],
    });
    const tooManyWinners = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "archenemy_win",
      winnerSeatIds: [
        "50000000-0000-4000-8000-000000000003",
        "50000000-0000-4000-8000-000000000004",
      ],
    });

    expect(missingWinner.ok).toBe(false);
    expect(tooManyWinners.ok).toBe(false);

    if (!missingWinner.ok && !tooManyWinners.ok) {
      expect(missingWinner.fieldErrors.winnerSeatIds).toBe(
        "Choose exactly one winner for this result.",
      );
      expect(tooManyWinners.fieldErrors.winnerSeatIds).toBe(
        "Choose exactly one winner for this result.",
      );
    }
  });

  test("allows no-winner results without forcing a winner", () => {
    const result = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "draw",
      winnerSeatIds: [],
      notes: "",
    });

    expect(result).toEqual({
      ok: true,
      input: {
        eventId: "50000000-0000-4000-8000-000000000001",
        podId: "50000000-0000-4000-8000-000000000002",
        resultType: "draw",
        winnerSeatIds: [],
        notes: "",
      },
    });
  });

  test("rejects winners on no-winner results", () => {
    const result = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "unfinished",
      winnerSeatIds: ["50000000-0000-4000-8000-000000000003"],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors.winnerSeatIds).toBe(
        "Draw, time called, and unfinished games do not use winners.",
      );
    }
  });

  test("requires at least two winners for team wins", () => {
    const result = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "team_win",
      winnerSeatIds: ["50000000-0000-4000-8000-000000000003"],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors.winnerSeatIds).toBe(
        "Choose at least two winners for a team win.",
      );
    }
  });

  test("deduplicates repeated winner seat ids", () => {
    const result = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "team_win",
      winnerSeatIds: [
        "50000000-0000-4000-8000-000000000003",
        "50000000-0000-4000-8000-000000000003",
        "50000000-0000-4000-8000-000000000004",
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      input: {
        winnerSeatIds: [
          "50000000-0000-4000-8000-000000000003",
          "50000000-0000-4000-8000-000000000004",
        ],
      },
    });
  });
});
