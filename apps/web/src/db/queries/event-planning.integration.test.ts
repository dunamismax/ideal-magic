import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import {
  eventHosts,
  eventRsvps,
  playgroupMemberships,
  users,
} from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import { createPlaygroupForUser } from "./playgroups";
import {
  createEventForPlaygroup,
  EventCreationAuthorizationError,
  EventRsvpAuthorizationError,
  getPublicSafeEventSummaryByInviteToken,
  getPublicSafeGuestRsvpSummaryByInviteToken,
  getScopedEventPlanningSummary,
  listUpcomingEventsForViewer,
  upsertMemberRsvpForEvent,
} from "./event-planning";
import { developmentSeedIds, seedDevelopmentData } from "../seed";
import { hashInviteToken } from "../tokens";

describe("event planning data access", () => {
  test("creates events for authorized group hosts and lists them by viewer scope", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000001",
      email: "riley@example.test",
      name: "Riley Chen",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000002",
      email: "sam@example.test",
      name: "Sam Vale",
    });

    const group = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000001",
      ownerDisplayName: "Riley Chen",
      name: "Friday Pods",
      slugBase: "friday-pods",
      description: "",
    });

    const created = await createEventForPlaygroup(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000001",
      playgroupId: group.id,
      title: "Friday Commander",
      description: "Bracket-aware pods.",
      startsAt: new Date("2030-06-14T23:00:00.000Z"),
      visibility: "members",
    });

    expect(created).toMatchObject({
      title: "Friday Commander",
      description: "Bracket-aware pods.",
      playgroupId: group.id,
      visibility: "members",
      createdByUserId: "20000000-0000-4000-8000-000000000001",
    });

    await expect(
      db
        .select({
          eventId: eventHosts.eventId,
          userId: eventHosts.userId,
          addressVisibility: eventHosts.addressVisibility,
        })
        .from(eventHosts)
        .where(eq(eventHosts.eventId, created.id)),
    ).resolves.toEqual([
      {
        eventId: created.id,
        userId: "20000000-0000-4000-8000-000000000001",
        addressVisibility: "hidden",
      },
    ]);

    await expect(
      listUpcomingEventsForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000001",
        now: new Date("2030-06-01T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject([
      {
        id: created.id,
        title: "Friday Commander",
        viewerRole: "owner",
        playgroup: {
          id: group.id,
          slug: "friday-pods",
        },
      },
    ]);
    await expect(
      listUpcomingEventsForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000002",
        now: new Date("2030-06-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual([]);
  });

  test("rejects event creation for non-members", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000003",
      email: "jules@example.test",
      name: "Jules Stone",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000004",
      email: "mara@example.test",
      name: "Mara Imani",
    });
    const group = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000003",
      ownerDisplayName: "Jules Stone",
      name: "Sunday Pods",
      slugBase: "sunday-pods",
      description: "",
    });

    await expect(
      createEventForPlaygroup(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000004",
        playgroupId: group.id,
        title: "Sunday Commander",
        description: "",
        startsAt: new Date("2030-06-16T19:00:00.000Z"),
        visibility: "members",
      }),
    ).rejects.toBeInstanceOf(EventCreationAuthorizationError);
  });

  test("upserts authenticated member RSVPs without exposing them to non-members", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000005",
      email: "owner@example.test",
      name: "Owner One",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000006",
      email: "member@example.test",
      name: "Member Two",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000007",
      email: "outsider@example.test",
      name: "Outsider Three",
    });
    const group = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000005",
      ownerDisplayName: "Owner One",
      name: "Member RSVP Pods",
      slugBase: "member-rsvp-pods",
      description: "",
    });
    await db.insert(playgroupMemberships).values({
      playgroupId: group.id,
      userId: "20000000-0000-4000-8000-000000000006",
      role: "member",
      displayName: "Member Two",
    });
    const event = await createEventForPlaygroup(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000005",
      playgroupId: group.id,
      title: "Member RSVP Night",
      description: "",
      startsAt: new Date("2030-06-14T23:00:00.000Z"),
      visibility: "members",
    });

    await expect(
      upsertMemberRsvpForEvent(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000006",
        eventId: event.id,
        status: "yes",
        arrivalTime: new Date("2030-06-14T23:30:00.000Z"),
        leavingTime: new Date("2030-06-15T03:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      eventId: event.id,
      userId: "20000000-0000-4000-8000-000000000006",
      status: "yes",
    });
    await upsertMemberRsvpForEvent(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000006",
      eventId: event.id,
      status: "maybe",
      arrivalTime: null,
      leavingTime: null,
    });

    const summary = await getScopedEventPlanningSummary(db, {
      eventId: event.id,
      viewerUserId: "20000000-0000-4000-8000-000000000006",
    });

    expect(summary).toMatchObject({
      id: event.id,
      viewer: {
        role: "member",
        rsvpStatus: "maybe",
        rsvpArrivalTime: null,
        rsvpLeavingTime: null,
        canRsvp: true,
      },
      counts: {
        rsvps: {
          yes: 0,
          maybe: 1,
          no: 0,
          waitlist: 0,
        },
      },
    });

    const rsvpRows = await db
      .select({
        eventId: eventRsvps.eventId,
        userId: eventRsvps.userId,
        guestName: eventRsvps.guestName,
        status: eventRsvps.status,
        notes: eventRsvps.notes,
      })
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, event.id));

    expect(rsvpRows).toEqual([
      {
        eventId: event.id,
        userId: "20000000-0000-4000-8000-000000000006",
        guestName: null,
        status: "maybe",
        notes: "",
      },
    ]);
    await expect(
      getScopedEventPlanningSummary(db, {
        eventId: event.id,
        viewerUserId: "20000000-0000-4000-8000-000000000007",
      }),
    ).resolves.toBeNull();
    await expect(
      upsertMemberRsvpForEvent(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000007",
        eventId: event.id,
        status: "yes",
        arrivalTime: null,
        leavingTime: null,
      }),
    ).rejects.toBeInstanceOf(EventRsvpAuthorizationError);
  });

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

async function insertUser(
  db: Pick<AppDatabase, "insert">,
  input: {
    id: string;
    email: string;
    name: string;
  },
) {
  await db.insert(users).values(input);
}
