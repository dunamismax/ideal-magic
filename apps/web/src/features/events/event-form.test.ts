import { describe, expect, test } from "vitest";

import {
  validateCreateEventInput,
  validateArchiveHostLocationInput,
  validateEventStatusInput,
  validateHostLocationInput,
  validateUpdateEventInput,
} from "./event-form";

const playgroupId = "20000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000002";
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
        locationId: "",
        addressVisibility: "rsvps",
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
        locationId: "",
        addressVisibility: "rsvps",
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
          locationId: "not-a-location-id",
          addressVisibility: "everybody",
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
        locationId: "not-a-location-id",
        addressVisibility: "everybody",
      },
      fieldErrors: {
        playgroupId: "Choose a playgroup.",
        title: "Title is required.",
        visibility: "Choose a visibility.",
        locationId: "Choose a saved location.",
        addressVisibility: "Choose address visibility.",
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
          locationId: "",
          addressVisibility: "members",
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
        locationId: "",
        addressVisibility: "members",
      },
      fieldErrors: {
        title: "Use 100 characters or fewer.",
        startsAt: "Choose a future date and time.",
        description: "Use 1000 characters or fewer.",
      },
    });
  });

  test("normalizes valid event update input", () => {
    const result = validateUpdateEventInput(
      {
        eventId: ` ${eventId} `,
        title: "  Saturday   Pods  ",
        startsAt: "2030-06-14T19:30",
        description: "  New start time. ",
        visibility: "invite_only",
        locationId: "20000000-0000-4000-8000-000000000003",
        addressVisibility: "members",
      },
      { now },
    );

    expect(result).toMatchObject({
      ok: true,
      input: {
        eventId,
        title: "Saturday Pods",
        description: "New start time.",
        visibility: "invite_only",
        locationId: "20000000-0000-4000-8000-000000000003",
        addressVisibility: "members",
      },
    });
    expect(result.ok ? result.input.startsAt : null).toBeInstanceOf(Date);
  });

  test("rejects invalid event update and lifecycle action input", () => {
    expect(
      validateUpdateEventInput(
        {
          eventId: "not-an-event-id",
          title: "",
          startsAt: "bad-date",
          description: "",
          visibility: "private",
          locationId: "",
          addressVisibility: "hidden",
        },
        { now },
      ),
    ).toEqual({
      ok: false,
      fields: {
        eventId: "not-an-event-id",
        title: "",
        startsAt: "bad-date",
        description: "",
        visibility: "private",
        locationId: "",
        addressVisibility: "hidden",
      },
      fieldErrors: {
        eventId: "Choose an event.",
        title: "Title is required.",
        startsAt: "Choose a valid date and time.",
        visibility: "Choose a visibility.",
      },
    });

    expect(
      validateEventStatusInput({
        eventId: "not-an-event-id",
        status: "scheduled",
      }),
    ).toEqual({
      ok: false,
      fields: {
        eventId: "not-an-event-id",
        status: "scheduled",
      },
      fieldErrors: {
        eventId: "Choose an event.",
        status: "Choose an event action.",
      },
    });
  });

  test("normalizes valid host location input", () => {
    expect(
      validateHostLocationInput({
        playgroupId,
        name: "  Riley's   Table  ",
        addressLine1: "  101   Example Way ",
        addressLine2: " Suite 2 ",
        city: " Playtest City ",
        stateProvince: " TS ",
        postalCode: " 00000 ",
        country: " US ",
        notes: " Door   code at table.\n\n\nBring mats. ",
      }),
    ).toEqual({
      ok: true,
      input: {
        locationId: "",
        playgroupId,
        name: "Riley's Table",
        addressLine1: "101 Example Way",
        addressLine2: "Suite 2",
        city: "Playtest City",
        stateProvince: "TS",
        postalCode: "00000",
        country: "US",
        notes: "Door code at table.\n\nBring mats.",
      },
    });
  });

  test("rejects invalid host location and archive input", () => {
    expect(
      validateHostLocationInput(
        {
          locationId: "",
          playgroupId: "not-a-playgroup-id",
          name: "",
          addressLine1: "x".repeat(181),
          addressLine2: "",
          city: "",
          stateProvince: "",
          postalCode: "",
          country: "",
          notes: "x".repeat(1_001),
        },
        { requireLocationId: true },
      ),
    ).toEqual({
      ok: false,
      fields: {
        locationId: "",
        playgroupId: "not-a-playgroup-id",
        name: "",
        addressLine1: "x".repeat(181),
        addressLine2: "",
        city: "",
        stateProvince: "",
        postalCode: "",
        country: "",
        notes: "x".repeat(1_001),
      },
      fieldErrors: {
        locationId: "Choose a location.",
        playgroupId: "Choose a playgroup.",
        name: "Location name is required.",
        addressLine1: "Use 180 characters or fewer.",
        notes: "Use 1000 characters or fewer.",
      },
    });

    expect(
      validateArchiveHostLocationInput({
        locationId: "not-a-location-id",
      }),
    ).toEqual({
      ok: false,
      fields: {
        locationId: "not-a-location-id",
      },
      fieldErrors: {
        locationId: "Choose a location.",
      },
    });
  });
});
