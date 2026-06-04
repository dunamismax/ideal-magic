import { describe, expect, test } from "vitest";

import { validateMemberRsvpInput } from "./member-rsvp";

const eventId = "20000000-0000-4000-8000-000000000001";

describe("member RSVP validation", () => {
  test("normalizes valid RSVP input with optional arrival and leaving times", () => {
    const result = validateMemberRsvpInput({
      eventId: ` ${eventId} `,
      status: "maybe",
      arrivalTime: "2030-06-14T19:30",
      leavingTime: "2030-06-14T23:00",
    });

    expect(result).toMatchObject({
      ok: true,
      fields: {
        eventId,
        status: "maybe",
        arrivalTime: "2030-06-14T19:30",
        leavingTime: "2030-06-14T23:00",
      },
      input: {
        eventId,
        status: "maybe",
      },
    });
    expect(result.ok ? result.input.arrivalTime : null).toBeInstanceOf(Date);
    expect(result.ok ? result.input.leavingTime : null).toBeInstanceOf(Date);
  });

  test("accepts blank optional times", () => {
    expect(
      validateMemberRsvpInput({
        eventId,
        status: "yes",
        arrivalTime: "",
        leavingTime: "  ",
      }),
    ).toEqual({
      ok: true,
      fields: {
        eventId,
        status: "yes",
        arrivalTime: "",
        leavingTime: "",
      },
      input: {
        eventId,
        status: "yes",
        arrivalTime: null,
        leavingTime: null,
      },
    });
  });

  test("rejects invalid status, event id, and time ordering", () => {
    expect(
      validateMemberRsvpInput({
        eventId: "not-an-event-id",
        status: "later",
        arrivalTime: "2030-06-14T23:00",
        leavingTime: "2030-06-14T19:30",
      }),
    ).toEqual({
      ok: false,
      fields: {
        eventId: "not-an-event-id",
        status: "later",
        arrivalTime: "2030-06-14T23:00",
        leavingTime: "2030-06-14T19:30",
      },
      fieldErrors: {
        eventId: "Choose an event.",
        status: "Choose an RSVP status.",
        leavingTime: "Leaving time must be after arrival.",
      },
    });
  });
});
