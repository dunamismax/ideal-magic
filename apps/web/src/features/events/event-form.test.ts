import { describe, expect, test } from "vitest";

import { validateCreateEventInput } from "./event-form";

const playgroupId = "20000000-0000-4000-8000-000000000001";
const now = new Date("2026-06-04T12:00:00.000Z");

describe("event form validation", () => {
  test("normalizes valid event input", () => {
    const result = validateCreateEventInput(
      {
        playgroupId,
        title: "  Friday   Commander  ",
        startsAt: "2030-06-14T19:00",
        description: "  Bring bracket 2-3 decks. ",
        visibility: "members",
      },
      { now },
    );

    expect(result).toMatchObject({
      ok: true,
      input: {
        playgroupId,
        title: "Friday Commander",
        description: "Bring bracket 2-3 decks.",
        visibility: "members",
      },
    });
    expect(result.ok ? result.input.startsAt : null).toBeInstanceOf(Date);
  });

  test("rejects invalid scoped fields", () => {
    expect(
      validateCreateEventInput(
        {
          playgroupId: "not-a-playgroup-id",
          title: "",
          startsAt: "2030-06-14T19:00",
          description: "",
          visibility: "team_only",
        },
        { now },
      ),
    ).toEqual({
      ok: false,
      fields: {
        playgroupId: "not-a-playgroup-id",
        title: "",
        startsAt: "2030-06-14T19:00",
        description: "",
        visibility: "team_only",
      },
      fieldErrors: {
        playgroupId: "Choose a playgroup.",
        title: "Title is required.",
        visibility: "Choose a visibility.",
      },
    });
  });

  test("rejects past dates and oversized copy", () => {
    expect(
      validateCreateEventInput(
        {
          playgroupId,
          title: "x".repeat(101),
          startsAt: "2026-06-04T07:00",
          description: "x".repeat(1_001),
          visibility: "public_safe",
        },
        { now },
      ),
    ).toEqual({
      ok: false,
      fields: {
        playgroupId,
        title: "x".repeat(101),
        startsAt: "2026-06-04T07:00",
        description: "x".repeat(1_001),
        visibility: "public_safe",
      },
      fieldErrors: {
        title: "Use 100 characters or fewer.",
        startsAt: "Choose a future date and time.",
        description: "Use 1000 characters or fewer.",
      },
    });
  });
});
