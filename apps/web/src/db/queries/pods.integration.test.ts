import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import {
  eventRsvps,
  games,
  lifeCounterSessions,
  playgroupMemberships,
  podSeats,
  pods,
  users,
} from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import {
  createDeckForUser,
  declareDeckForEvent,
  updateDeckForUser,
} from "./decks";
import {
  createEventForPlaygroup,
  upsertMemberRsvpForEvent,
} from "./event-planning";
import { createPlaygroupForUser } from "./playgroups";
import {
  generateDraftPodsForEvent,
  listPodsForEventViewer,
  movePodSeatForEventManager,
  PodPublicationAuthorizationError,
  PodPublicationBlockedError,
  publishPodsForEventManager,
  PodGenerationAuthorizationError,
  PodGenerationBlockedByExistingPodsError,
  PodSeatMoveAuthorizationError,
  PodSeatMoveBlockedError,
  unpublishPodsForEventManager,
} from "./pods";

describe("pod data access", () => {
  test("generates draft pods from eligible RSVPs and declaration snapshots", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPodPlanningFixture(db);

    await expect(
      generateDraftPodsForEvent(db, {
        viewerUserId: fixture.memberIds[0] ?? fixture.ownerId,
        eventId: fixture.eventId,
      }),
    ).rejects.toBeInstanceOf(PodGenerationAuthorizationError);

    const generated = await generateDraftPodsForEvent(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });

    expect(generated).toHaveLength(2);
    expect(generated.map((pod) => pod.seats.length)).toEqual([4, 3]);
    expect(generated[0]).toMatchObject({
      name: "Pod 1",
      state: "proposed",
      publishedAt: null,
      sizeFitScore: 100,
    });
    expect(generated[0]?.seats[0]).toMatchObject({
      participantName: "Player 7",
      rsvpStatus: "yes",
      deck: {
        deckNameSnapshot: "Player 7 Deck",
        commanderSnapshot: ["Player 7 Commander"],
        bracketSnapshot: "5",
        powerEstimateSnapshot: 9,
      },
    });

    const memberPods = await listPodsForEventViewer(db, {
      viewerUserId: fixture.memberIds[1] ?? fixture.ownerId,
      eventId: fixture.eventId,
    });
    const outsiderPods = await listPodsForEventViewer(db, {
      viewerUserId: fixture.outsiderId,
      eventId: fixture.eventId,
    });

    expect(memberPods.map((pod) => pod.seats.length)).toEqual([4, 3]);
    expect(outsiderPods).toEqual([]);

    await updateDeckForUser(db, {
      ownerUserId: fixture.ownerId,
      deckId: fixture.ownerDeckId,
      name: "Edited After Declaration",
      commanders: ["Edited Commander"],
      colorIdentity: "WUBG",
      bracket: "2",
      powerEstimate: 5,
      archetype: "Edited",
      tags: ["edited"],
      visibility: "playgroup",
      playgroupId: fixture.playgroupId,
      externalUrl: null,
    });

    const afterDeckEdit = await listPodsForEventViewer(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });
    const serializedPods = JSON.stringify(afterDeckEdit);

    expect(serializedPods).toContain("Owner Deck");
    expect(serializedPods).not.toContain("Edited After Declaration");
    expect(serializedPods).not.toContain("@example.test");
    expect(serializedPods).not.toContain("Private RSVP note");

    const regenerated = await generateDraftPodsForEvent(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });

    expect(regenerated.map((pod) => pod.seats.length)).toEqual([4, 3]);

    const persistedPods = await db
      .select({
        id: pods.id,
      })
      .from(pods)
      .where(eq(pods.eventId, fixture.eventId));

    expect(persistedPods).toHaveLength(2);
  });

  test("does not overwrite non-draft pods during generation", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPodPlanningFixture(db);
    const generated = await generateDraftPodsForEvent(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });

    await db
      .update(pods)
      .set({
        state: "locked",
      })
      .where(eq(pods.id, generated[0]?.id ?? ""));

    await expect(
      generateDraftPodsForEvent(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
      }),
    ).rejects.toBeInstanceOf(PodGenerationBlockedByExistingPodsError);
  });

  test("publishes and unpublishes pods only for event managers", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPodPlanningFixture(db);
    const generated = await generateDraftPodsForEvent(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });

    await expect(
      publishPodsForEventManager(db, {
        viewerUserId: fixture.memberIds[0] ?? fixture.outsiderId,
        eventId: fixture.eventId,
      }),
    ).rejects.toBeInstanceOf(PodPublicationAuthorizationError);

    const published = await publishPodsForEventManager(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });

    expect(published.map((pod) => pod.state)).toEqual(["locked", "locked"]);
    expect(published.every((pod) => pod.publishedAt instanceof Date)).toBe(
      true,
    );
    expect(published.map((pod) => pod.seats.length)).toEqual([4, 3]);

    const memberPublishedPods = await listPodsForEventViewer(db, {
      viewerUserId: fixture.memberIds[1] ?? fixture.ownerId,
      eventId: fixture.eventId,
    });
    const serializedPods = JSON.stringify(memberPublishedPods);

    expect(memberPublishedPods.map((pod) => pod.state)).toEqual([
      "locked",
      "locked",
    ]);
    expect(serializedPods).toContain("Owner Deck");
    expect(serializedPods).not.toContain("@example.test");
    expect(serializedPods).not.toContain("Private RSVP note");

    await expect(
      movePodSeatForEventManager(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        seatId: generated[0]?.seats[0]?.id ?? "",
        targetPodId: generated[1]?.id ?? "",
        targetSeatPosition: 1,
      }),
    ).rejects.toBeInstanceOf(PodSeatMoveBlockedError);

    const unpublished = await unpublishPodsForEventManager(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });

    expect(unpublished.map((pod) => pod.state)).toEqual([
      "proposed",
      "proposed",
    ]);
    expect(unpublished.every((pod) => pod.publishedAt === null)).toBe(true);
  });

  test("blocks unpublish after active or linked pod state exists", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPodPlanningFixture(db);
    const generated = await generateDraftPodsForEvent(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });
    const [firstPod] = generated;

    if (!firstPod) {
      throw new Error("Expected a generated pod fixture.");
    }

    await publishPodsForEventManager(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });

    await db
      .update(pods)
      .set({
        state: "active",
      })
      .where(eq(pods.id, firstPod.id));

    await expect(
      unpublishPodsForEventManager(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
      }),
    ).rejects.toBeInstanceOf(PodPublicationBlockedError);

    await db
      .update(pods)
      .set({
        state: "locked",
      })
      .where(eq(pods.id, firstPod.id));

    await db.insert(games).values({
      eventId: fixture.eventId,
      podId: firstPod.id,
      loggedByUserId: fixture.ownerId,
      resultType: "normal_win",
    });

    await expect(
      unpublishPodsForEventManager(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
      }),
    ).rejects.toBeInstanceOf(PodPublicationBlockedError);

    await db.delete(games).where(eq(games.podId, firstPod.id));
    await db.insert(lifeCounterSessions).values({
      ownerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      podId: firstPod.id,
      localSessionKey: "linked-pod-counter",
      mode: "pod",
      saveState: "saved_to_group",
    });

    await expect(
      unpublishPodsForEventManager(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
      }),
    ).rejects.toBeInstanceOf(PodPublicationBlockedError);
  });

  test("moves unlocked draft seats between proposed pods for event managers", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createPodPlanningFixture(db);
    const generated = await generateDraftPodsForEvent(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
    });
    const sourceSeat = generated[1]?.seats[0];
    const targetPod = generated[0];

    if (!sourceSeat || !targetPod) {
      throw new Error("Expected a generated two-pod fixture.");
    }

    await expect(
      movePodSeatForEventManager(db, {
        viewerUserId: fixture.memberIds[0] ?? fixture.outsiderId,
        eventId: fixture.eventId,
        seatId: sourceSeat.id,
        targetPodId: targetPod.id,
        targetSeatPosition: 2,
      }),
    ).rejects.toBeInstanceOf(PodSeatMoveAuthorizationError);

    const moved = await movePodSeatForEventManager(db, {
      viewerUserId: fixture.ownerId,
      eventId: fixture.eventId,
      seatId: sourceSeat.id,
      targetPodId: targetPod.id,
      targetSeatPosition: 2,
    });

    expect(moved.map((pod) => pod.seats.length)).toEqual([5, 2]);
    expect(moved[0]?.seats.map((seat) => seat.seatPosition)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(moved[1]?.seats.map((seat) => seat.seatPosition)).toEqual([1, 2]);
    expect(moved[0]?.seats[1]).toMatchObject({
      id: sourceSeat.id,
      participantName: sourceSeat.participantName,
      deck: {
        deckNameSnapshot: sourceSeat.deck?.deckNameSnapshot,
        commanderSnapshot: sourceSeat.deck?.commanderSnapshot,
      },
    });

    await db
      .update(podSeats)
      .set({
        locked: true,
      })
      .where(eq(podSeats.id, sourceSeat.id));

    await expect(
      movePodSeatForEventManager(db, {
        viewerUserId: fixture.ownerId,
        eventId: fixture.eventId,
        seatId: sourceSeat.id,
        targetPodId: moved[1]?.id ?? "",
        targetSeatPosition: 1,
      }),
    ).rejects.toBeInstanceOf(PodSeatMoveBlockedError);
  });
});

async function createPodPlanningFixture(db: AppDatabase) {
  const ownerId = "30000000-0000-4000-8000-000000000001";
  const memberIds = [
    "30000000-0000-4000-8000-000000000002",
    "30000000-0000-4000-8000-000000000003",
    "30000000-0000-4000-8000-000000000004",
    "30000000-0000-4000-8000-000000000005",
    "30000000-0000-4000-8000-000000000006",
    "30000000-0000-4000-8000-000000000007",
  ];
  const outsiderId = "30000000-0000-4000-8000-000000000008";
  const allUserIds = [ownerId, ...memberIds, outsiderId];

  await db.insert(users).values(
    allUserIds.map((id, index) => ({
      id,
      email: `pod-fixture-${index + 1}@example.test`,
      name: index === 0 ? "Owner Player" : `Player ${index + 1}`,
    })),
  );

  const group = await createPlaygroupForUser(db, {
    userId: ownerId,
    ownerDisplayName: "Owner Player",
    name: "Draft Pod Group",
    slugBase: "draft-pod-group",
    description: "",
  });

  await db.insert(playgroupMemberships).values(
    memberIds.map((userId, index) => ({
      playgroupId: group.id,
      userId,
      role: "member",
      displayName: `Player ${index + 2}`,
    })),
  );

  const event = await createEventForPlaygroup(db, {
    viewerUserId: ownerId,
    playgroupId: group.id,
    title: "Draft Pod Night",
    description: "",
    startsAt: new Date("2030-06-14T23:00:00.000Z"),
    visibility: "members",
  });
  const deckIds: string[] = [];

  for (const [index, userId] of [ownerId, ...memberIds].entries()) {
    const playerNumber = index + 1;
    const deck = await createDeckForUser(db, {
      ownerUserId: userId,
      name: playerNumber === 1 ? "Owner Deck" : `Player ${playerNumber} Deck`,
      commanders: [
        playerNumber === 1
          ? "Owner Commander"
          : `Player ${playerNumber} Commander`,
      ],
      colorIdentity: "WUBG",
      bracket: String(Math.min(5, playerNumber)) as "1" | "2" | "3" | "4" | "5",
      powerEstimate: Math.min(10, playerNumber + 2),
      archetype: "Midrange",
      tags: ["fixture"],
      visibility: "playgroup",
      playgroupId: group.id,
      externalUrl: null,
    });

    deckIds.push(deck.id);

    await declareDeckForEvent(db, {
      viewerUserId: userId,
      eventId: event.id,
      deckId: deck.id,
      preference: 1,
    });
    await upsertMemberRsvpForEvent(db, {
      viewerUserId: userId,
      eventId: event.id,
      status: playerNumber === 2 ? "maybe" : "yes",
      arrivalTime: null,
      leavingTime: null,
    });
  }

  await db
    .update(eventRsvps)
    .set({
      notes: "Private RSVP note",
    })
    .where(eq(eventRsvps.eventId, event.id));

  return {
    eventId: event.id,
    ownerDeckId: deckIds[0] ?? "",
    ownerId,
    memberIds,
    outsiderId,
    playgroupId: group.id,
  };
}
