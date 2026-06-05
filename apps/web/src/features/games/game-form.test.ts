import { describe, expect, test } from "vitest";

import { validateLogPodGameInput } from "./game-form";

describe("game log form validation", () => {
  test("normalizes a valid quick pod game log", () => {
    const result = validateLogPodGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      podId: "50000000-0000-4000-8000-000000000002",
      resultType: "normal_win",
      winnerSeatId: "50000000-0000-4000-8000-000000000003",
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
      winnerSeatId: "not-a-seat",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors).toMatchObject({
        eventId: "Choose an event.",
        podId: "Choose a pod.",
        resultType: "Choose a result.",
        winnerSeatId: "Choose a winner from this pod.",
      });
    }
  });
});
