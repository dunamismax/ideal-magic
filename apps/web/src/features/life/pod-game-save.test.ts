import { describe, expect, test } from "vitest";

import { validateSavePodLifeGameInput } from "./pod-game-save";

describe("pod life game save validation", () => {
  test("accepts an explicit completed pod result with one winner", () => {
    const result = validateSavePodLifeGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "combat_win",
      winnerSeatIds: ["50000000-0000-4000-8000-000000000003"],
      notes: "  Saved from counter.  ",
    });

    expect(result).toEqual({
      ok: true,
      input: {
        eventId: "50000000-0000-4000-8000-000000000001",
        podId: "50000000-0000-4000-8000-000000000002",
        resultType: "combat_win",
        winnerSeatIds: ["50000000-0000-4000-8000-000000000003"],
        playerOutcomes: [],
        notes: "Saved from counter.",
      },
    });
  });

  test("keeps no-winner result semantics for draw and time-called saves", () => {
    const draw = validateSavePodLifeGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "draw",
      winnerSeatIds: [],
    });
    const timeCalledWithWinner = validateSavePodLifeGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "time_called",
      winnerSeatIds: ["50000000-0000-4000-8000-000000000003"],
    });

    expect(draw.ok).toBe(true);
    expect(timeCalledWithWinner.ok).toBe(false);

    if (!timeCalledWithWinner.ok) {
      expect(timeCalledWithWinner.fieldErrors.winnerSeatIds).toBe(
        "Draw, time called, and unfinished games do not use winners.",
      );
    }
  });
});
