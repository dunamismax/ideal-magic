import { describe, expect, test } from "vitest";

import { developmentSeedIds, seedDevelopmentData } from "@/db/seed";
import { eventRsvps } from "@/db/schema";
import { hashInviteToken } from "@/db/tokens";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import { and, eq, isNull } from "drizzle-orm";
import {
  cancelPublicGuestRsvp,
  createPublicGuestRsvp,
  getPublicEventInviteView,
  getPublicGuestRsvp,
  PublicGuestRsvpValidationError,
  updatePublicGuestRsvp,
} from "./public-event";

describe("public event invite service", () => {
  test("loads a tokenized event view without private fields", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    const view = await getPublicEventInviteView(
      db,
      "fixture-wednesday-event-access",
    );

    expect(view).toMatchObject({
      id: developmentSeedIds.events.wednesdayCommander,
      title: "Wednesday Commander Night",
      status: "scheduled",
      playgroupName: "Example City Commander League",
      locationName: "Example Tabletop Room",
      rsvpCounts: {
        yes: 3,
        maybe: 1,
        no: 1,
        waitlist: 1,
      },
      guestRsvps: 1,
      namedGuests: 1,
      totalResponses: 6,
      expectedPlayers: 5,
      deckDeclarations: 5,
      pods: 1,
      loggedGames: 1,
    });

    const publicPayload = JSON.stringify(view);

    expect(publicPayload).not.toContain("101 Example Tabletop Way");
    expect(publicPayload).not.toContain("Synthetic local fixture address");
    expect(publicPayload).not.toContain("Private fixture RSVP note");
    expect(publicPayload).not.toContain("Private guest RSVP note");
    expect(publicPayload).not.toContain("nora@example.test");
    expect(publicPayload).not.toContain("fixture-wednesday-event-access");
    expect(publicPayload).not.toContain("Example Guest");
  });

  test("fails closed for blank or wrong invite tokens", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    await expect(getPublicEventInviteView(db, "")).resolves.toBeNull();
    await expect(
      getPublicEventInviteView(db, "wrong-token"),
    ).resolves.toBeNull();
  });

  test("creates a token-scoped guest RSVP and returns aggregate-only public data", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    const result = await createPublicGuestRsvp(
      db,
      "fixture-wednesday-event-access",
      {
        guestName: "  Robin   Vale  ",
        status: "yes",
      },
    );

    expect(result).toMatchObject({
      event: {
        id: developmentSeedIds.events.wednesdayCommander,
        rsvpCounts: {
          yes: 4,
          maybe: 1,
          no: 1,
          waitlist: 1,
        },
        guestRsvps: 2,
        namedGuests: 1,
        totalResponses: 7,
        expectedPlayers: 6,
      },
      guestRsvp: {
        guestName: "Robin Vale",
        status: "yes",
      },
    });
    expect(result?.guestRsvp.rsvpToken).toEqual(expect.any(String));

    const storedGuestRsvps = await db
      .select({
        guestName: eventRsvps.guestName,
        guestEditTokenHash: eventRsvps.guestEditTokenHash,
        notes: eventRsvps.notes,
      })
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, developmentSeedIds.events.wednesdayCommander),
          isNull(eventRsvps.userId),
        ),
      );

    expect(storedGuestRsvps).toEqual(
      expect.arrayContaining([
        {
          guestName: "Robin Vale",
          guestEditTokenHash: result?.guestRsvp.rsvpToken
            ? hashInviteToken(result.guestRsvp.rsvpToken)
            : "",
          notes: "",
        },
      ]),
    );

    const publicPayload = JSON.stringify(result?.event);

    expect(publicPayload).not.toContain("Robin Vale");
    expect(publicPayload).not.toContain(result?.guestRsvp.rsvpToken ?? "");
    expect(publicPayload).not.toContain("101 Example Tabletop Way");
    expect(publicPayload).not.toContain("Private guest RSVP note");
    expect(publicPayload).not.toContain("nora@example.test");
    expect(publicPayload).not.toContain("fixture-wednesday-event-access");
    expect(publicPayload).not.toContain("Example Guest");
  });

  test("loads, edits, and cancels a token-scoped guest RSVP", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    const created = await createPublicGuestRsvp(
      db,
      "fixture-wednesday-event-access",
      {
        guestName: "Robin Vale",
        status: "yes",
      },
    );

    expect(created).not.toBeNull();
    const rsvpToken = created?.guestRsvp.rsvpToken ?? "";

    await expect(
      getPublicGuestRsvp(db, "fixture-wednesday-event-access", rsvpToken),
    ).resolves.toMatchObject({
      guestRsvp: {
        guestName: "Robin Vale",
        status: "yes",
      },
    });

    const updated = await updatePublicGuestRsvp(
      db,
      "fixture-wednesday-event-access",
      rsvpToken,
      {
        guestName: "  Robin   Night  ",
        status: "maybe",
      },
    );

    expect(updated).toMatchObject({
      event: {
        rsvpCounts: {
          yes: 3,
          maybe: 2,
          no: 1,
          waitlist: 1,
        },
        expectedPlayers: 6,
      },
      guestRsvp: {
        rsvpToken,
        guestName: "Robin Night",
        status: "maybe",
      },
    });

    const cancelled = await cancelPublicGuestRsvp(
      db,
      "fixture-wednesday-event-access",
      rsvpToken,
    );

    expect(cancelled).toMatchObject({
      event: {
        rsvpCounts: {
          yes: 3,
          maybe: 1,
          no: 2,
          waitlist: 1,
        },
        expectedPlayers: 5,
      },
      guestRsvp: {
        rsvpToken,
        guestName: "Robin Night",
        status: "no",
      },
    });

    await expect(
      updatePublicGuestRsvp(db, "fixture-wednesday-event-access", "bad-token", {
        guestName: "Wrong",
        status: "yes",
      }),
    ).resolves.toBeNull();
    await expect(
      getPublicGuestRsvp(db, "wrong-token", rsvpToken),
    ).resolves.toBeNull();

    const publicPayload = JSON.stringify(cancelled?.event);

    expect(publicPayload).not.toContain("Robin Night");
    expect(publicPayload).not.toContain(rsvpToken);
    expect(publicPayload).not.toContain("fixture-wednesday-event-access");
  });

  test("rejects invalid guest RSVP writes before persistence", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    await expect(
      createPublicGuestRsvp(db, "fixture-wednesday-event-access", {
        guestName: "",
        status: "yes",
      }),
    ).rejects.toBeInstanceOf(PublicGuestRsvpValidationError);

    await expect(
      createPublicGuestRsvp(db, "wrong-token", {
        guestName: "Robin",
        status: "yes",
      }),
    ).resolves.toBeNull();
  });
});
