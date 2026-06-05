import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import { eventRsvps, playgroupMemberships, pods, users } from "@/db/schema";
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
  PodGenerationAuthorizationError,
  PodGenerationBlockedByExistingPodsError,
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
