import { describe, expect, test } from "vitest";

import {
  getPublicRsvpRows,
  normalizePublicGuestRsvpInput,
  PublicGuestRsvpValidationError,
  toPublicEventInviteView,
} from "@/features/events/public-event";

describe("public event invite view model", () => {
  test("builds aggregate-only public event copy", () => {
    const view = toPublicEventInviteView(
      {
        id: "event-1",
        title: "Wednesday Commander Night",
        startsAt: new Date("2026-06-10T23:00:00.000Z"),
        endsAt: new Date("2026-06-11T03:00:00.000Z"),
        visibility: "members",
        playgroup: {
          id: "group-1",
          name: "Example City Commander League",
          slug: "example-city-commander",
        },
        location: {
          id: "location-1",
          name: "Example Tabletop Room",
        },
        counts: {
          rsvps: {
            yes: 3,
            maybe: 1,
            no: 1,
            waitlist: 1,
          },
          guestRsvps: 1,
          namedGuests: 1,
          deckDeclarations: 5,
          pods: 1,
          loggedGames: 1,
        },
      },
      {
        eventId: "event-1",
        rsvps: {
          yes: 3,
          maybe: 1,
          no: 1,
          waitlist: 1,
        },
        guestRsvps: 1,
        namedGuests: 1,
      },
    );

    expect(view).toMatchObject({
      title: "Wednesday Commander Night",
      playgroupName: "Example City Commander League",
      dateLabel: "Wednesday, June 10, 2026",
      timeLabel: "11:00 PM UTC to 3:00 AM UTC",
      locationName: "Example Tabletop Room",
      totalResponses: 6,
      expectedPlayers: 5,
      deckDeclarations: 5,
      pods: 1,
      loggedGames: 1,
    });
    expect(getPublicRsvpRows(view)).toEqual([
      { status: "yes", label: "Yes", count: 3 },
      { status: "maybe", label: "Maybe", count: 1 },
      { status: "no", label: "No", count: 1 },
      { status: "waitlist", label: "Waitlist", count: 1 },
    ]);
  });

  test("normalizes guest RSVP form input", () => {
    expect(
      normalizePublicGuestRsvpInput({
        guestName: "  Robin   Vale  ",
        status: "maybe",
      }),
    ).toEqual({
      guestName: "Robin Vale",
      status: "maybe",
    });
  });

  test("rejects invalid guest RSVP input", () => {
    expect(() =>
      normalizePublicGuestRsvpInput({
        guestName: " ",
        status: "yes",
      }),
    ).toThrow(PublicGuestRsvpValidationError);

    expect(() =>
      normalizePublicGuestRsvpInput({
        guestName: "Robin",
        status: "attending",
      }),
    ).toThrow(PublicGuestRsvpValidationError);
  });
});
