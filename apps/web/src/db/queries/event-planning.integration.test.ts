import { describe, expect, test } from "vitest";

import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import {
  getPublicSafeEventSummaryByInviteToken,
  getPublicSafeGuestRsvpSummaryByInviteToken,
  getScopedEventPlanningSummary,
  listUpcomingEventsForViewer,
} from "./event-planning";
import { developmentSeedIds, seedDevelopmentData } from "../seed";
import { hashInviteToken } from "../tokens";

describe("event planning data access", () => {
  test("seeds fake planning rows idempotently and returns scoped event counts", async () => {
    const { db } = await createMigratedPgliteDatabase();

    await seedDevelopmentData(db);
    await seedDevelopmentData(db);

    const summary = await getScopedEventPlanningSummary(db, {
      eventId: developmentSeedIds.events.wednesdayCommander,
      viewerUserId: developmentSeedIds.users.nora,
    });

    expect(summary).toMatchObject({
      id: developmentSeedIds.events.wednesdayCommander,
      title: "Wednesday Commander Night",
      playgroup: {
        slug: "example-city-commander",
      },
      viewer: {
        role: "owner",
        rsvpStatus: "yes",
        canManageEvent: true,
        canSeeHostAddress: true,
      },
      counts: {
        rsvps: {
          yes: 3,
          maybe: 1,
          no: 1,
          waitlist: 1,
        },
        deckDeclarations: 5,
        pods: 1,
        loggedGames: 1,
      },
    });
    expect(summary?.location?.address?.addressLine1).toBe(
      "101 Example Tabletop Way",
    );
  });

  test("redacts host location details when RSVP visibility does not allow access", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    const summary = await getScopedEventPlanningSummary(db, {
      eventId: developmentSeedIds.events.wednesdayCommander,
      viewerUserId: developmentSeedIds.users.sol,
    });

    expect(summary?.viewer).toMatchObject({
      role: "member",
      rsvpStatus: "no",
      canManageEvent: false,
      canSeeHostAddress: false,
    });
    expect(summary?.location).toMatchObject({
      id: developmentSeedIds.locations.exampleTabletopRoom,
      name: null,
      address: null,
      notes: null,
    });
  });

  test("does not expose member-only events to anonymous viewers", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    await expect(
      getScopedEventPlanningSummary(db, {
        eventId: developmentSeedIds.events.wednesdayCommander,
        viewerUserId: null,
      }),
    ).resolves.toBeNull();
  });

  test("lists upcoming events by viewer scope with deterministic pagination", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    const firstPage = await listUpcomingEventsForViewer(db, {
      viewerUserId: developmentSeedIds.users.nora,
      now: new Date("2026-06-03T00:00:00.000Z"),
      page: { pageSize: 1 },
    });
    const secondPage = await listUpcomingEventsForViewer(db, {
      viewerUserId: developmentSeedIds.users.nora,
      now: new Date("2026-06-03T00:00:00.000Z"),
      page: { page: 2, pageSize: 1 },
    });
    const anonymousEvents = await listUpcomingEventsForViewer(db, {
      viewerUserId: null,
      now: new Date("2026-06-03T00:00:00.000Z"),
    });

    expect(firstPage).toHaveLength(1);
    expect(firstPage[0]).toMatchObject({
      id: developmentSeedIds.events.wednesdayCommander,
      viewerRole: "owner",
    });
    expect(secondPage).toHaveLength(1);
    expect(secondPage[0]).toMatchObject({
      id: developmentSeedIds.events.sundayPods,
      viewerRole: "owner",
    });
    expect(anonymousEvents).toEqual([]);
  });

  test("returns a token-scoped public-safe event summary without private fields", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    const summary = await getPublicSafeEventSummaryByInviteToken(db, {
      inviteToken: "fixture-wednesday-event-access",
    });

    expect(summary).toMatchObject({
      id: developmentSeedIds.events.wednesdayCommander,
      title: "Wednesday Commander Night",
      visibility: "members",
      playgroup: {
        slug: "example-city-commander",
      },
      location: {
        id: developmentSeedIds.locations.exampleTabletopRoom,
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
    });

    const publicPayload = JSON.stringify(summary);

    expect(publicPayload).not.toContain("101 Example Tabletop Way");
    expect(publicPayload).not.toContain("Synthetic local fixture address");
    expect(publicPayload).not.toContain("Private fixture RSVP note");
    expect(publicPayload).not.toContain("Private guest RSVP note");
    expect(publicPayload).not.toContain("nora@example.test");
    expect(publicPayload).not.toContain("fixture-wednesday-event-access");
    expect(publicPayload).not.toContain(
      hashInviteToken("fixture-wednesday-event-access"),
    );
    expect(publicPayload).not.toContain("Example Guest");
  });

  test("returns token-scoped guest RSVP counts without guest details", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    const summary = await getPublicSafeGuestRsvpSummaryByInviteToken(db, {
      inviteToken: "fixture-wednesday-event-access",
    });

    expect(summary).toEqual({
      eventId: developmentSeedIds.events.wednesdayCommander,
      rsvps: {
        yes: 3,
        maybe: 1,
        no: 1,
        waitlist: 1,
      },
      guestRsvps: 1,
      namedGuests: 1,
    });

    const publicPayload = JSON.stringify(summary);

    expect(publicPayload).not.toContain("Example Guest");
    expect(publicPayload).not.toContain("Private guest RSVP note");
    expect(publicPayload).not.toContain("theo@example.test");
    expect(publicPayload).not.toContain("fixture-wednesday-event-access");
    expect(publicPayload).not.toContain(
      hashInviteToken("fixture-wednesday-event-access"),
    );
  });

  test("rejects missing, blank, and wrong public-safe event tokens", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await seedDevelopmentData(db);

    await expect(
      getPublicSafeEventSummaryByInviteToken(db, {
        inviteToken: "",
      }),
    ).resolves.toBeNull();
    await expect(
      getPublicSafeEventSummaryByInviteToken(db, {
        inviteToken: "   ",
      }),
    ).resolves.toBeNull();
    await expect(
      getPublicSafeEventSummaryByInviteToken(db, {
        inviteToken: "wrong-event-token",
      }),
    ).resolves.toBeNull();
    await expect(
      getPublicSafeGuestRsvpSummaryByInviteToken(db, {
        inviteToken: "wrong-event-token",
      }),
    ).resolves.toBeNull();
  });
});
