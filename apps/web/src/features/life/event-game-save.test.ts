import { describe, expect, test } from "vitest";

import { validateSaveEventLifeGameInput } from "./event-game-save";

describe("event life game save validation", () => {
  test("accepts an explicit completed event result with one winner", () => {
    const result = validateSaveEventLifeGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      resultType: "combat_win",
      winnerParticipantIds: ["50000000-0000-4000-8000-000000000002"],
      notes: "  Saved from event counter.  ",
    });

    expect(result).toEqual({
      ok: true,
      input: {
        eventId: "50000000-0000-4000-8000-000000000001",
        resultType: "combat_win",
        winnerParticipantIds: ["50000000-0000-4000-8000-000000000002"],
        notes: "Saved from event counter.",
      },
    });
  });

  test("keeps no-winner result semantics for draw and time-called saves", () => {
    const draw = validateSaveEventLifeGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      resultType: "draw",
      winnerParticipantIds: [],
    });
    const timeCalledWithWinner = validateSaveEventLifeGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      resultType: "time_called",
      winnerParticipantIds: ["50000000-0000-4000-8000-000000000002"],
    });

    expect(draw.ok).toBe(true);
    expect(timeCalledWithWinner.ok).toBe(false);

    if (!timeCalledWithWinner.ok) {
      expect(timeCalledWithWinner.fieldErrors.winnerParticipantIds).toBe(
        "Draw, time called, and unfinished games do not use winners.",
      );
    }
  });

  test("requires at least two winners for team wins", () => {
    const result = validateSaveEventLifeGameInput({
      eventId: "50000000-0000-4000-8000-000000000001",
      resultType: "team_win",
      winnerParticipantIds: ["50000000-0000-4000-8000-000000000002"],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.fieldErrors.winnerParticipantIds).toBe(
        "Choose at least two winners for a team win.",
      );
    }
  });
});
