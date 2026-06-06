import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import {
  lifeCounterSessions,
  lifeCounterSnapshots,
  playgroupMemberships,
  pods,
  users,
} from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import {
  createInitialLifeCounterSession,
  createLifeCounterAction,
  recordLifeCounterAction,
} from "@/features/life/session";
import { createEventForPlaygroup } from "./event-planning";
import {
  getLinkedLifeCounterSessionForViewer,
  LinkedLifeCounterAuthorizationError,
  LinkedLifeCounterValidationError,
  persistLinkedLifeCounterSession,
} from "./life-counter";
import { createPlaygroupForUser } from "./playgroups";

describe("linked life counter persistence", () => {
  test("persists and reloads scoped event-linked server snapshots", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createLinkedLifeCounterFixture(db);
    const localSessionKey = createEventSessionKey(fixture.eventId);
    const session = createSessionWithLifeLoss(localSessionKey, 3);

    const persisted = await persistLinkedLifeCounterSession(db, {
      viewerUserId: fixture.ownerId,
      kind: "event",
      eventId: fixture.eventId,
      localSessionKey,
      expectedServerActionSequence: null,
      expectedServerUpdatedAt: null,
      session,
    });

    expect(persisted.ok).toBe(true);

    const [sessionRow] = await db
      .select({
        localSessionKey: lifeCounterSessions.localSessionKey,
        mode: lifeCounterSessions.mode,
        eventId: lifeCounterSessions.eventId,
        podId: lifeCounterSessions.podId,
        ownerUserId: lifeCounterSessions.ownerUserId,
        saveState: lifeCounterSessions.saveState,
        lastActionSequence: lifeCounterSessions.lastActionSequence,
      })
      .from(lifeCounterSessions)
      .where(eq(lifeCounterSessions.localSessionKey, localSessionKey));
    const snapshotRows = await db
      .select({
        actionSequence: lifeCounterSnapshots.actionSequence,
        state: lifeCounterSnapshots.state,
      })
      .from(lifeCounterSnapshots);

    expect(sessionRow).toMatchObject({
      localSessionKey,
      mode: "event",
      eventId: fixture.eventId,
      podId: null,
      ownerUserId: fixture.ownerId,
      saveState: "saved_to_group",
      lastActionSequence: 1,
    });
    expect(snapshotRows).toHaveLength(1);
    expect(snapshotRows[0]?.actionSequence).toBe(1);

    const reloaded = await getLinkedLifeCounterSessionForViewer(db, {
      viewerUserId: fixture.memberId,
      kind: "event",
      eventId: fixture.eventId,
      localSessionKey,
    });

    expect(reloaded?.session.players[0]?.life).toBe(37);
    expect(reloaded?.serverActionSequence).toBe(1);

    await expect(
      getLinkedLifeCounterSessionForViewer(db, {
        viewerUserId: fixture.outsiderId,
        kind: "event",
        eventId: fixture.eventId,
        localSessionKey,
      }),
    ).rejects.toThrow(LinkedLifeCounterAuthorizationError);

    await expect(
      getLinkedLifeCounterSessionForViewer(db, {
        viewerUserId: fixture.ownerId,
        kind: "event",
        eventId: fixture.eventId,
        localSessionKey: createEventSessionKey(
          "50000000-0000-4000-8000-000000000099",
        ),
      }),
    ).rejects.toThrow(LinkedLifeCounterValidationError);
  });

  test("blocks stale linked writes instead of overwriting newer server state", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createLinkedLifeCounterFixture(db);
    const localSessionKey = createEventSessionKey(fixture.eventId);
    const firstSession = createSessionWithLifeLoss(localSessionKey, 2);
    const firstPersist = await persistLinkedLifeCounterSession(db, {
      viewerUserId: fixture.ownerId,
      kind: "event",
      eventId: fixture.eventId,
      localSessionKey,
      expectedServerActionSequence: null,
      expectedServerUpdatedAt: null,
      session: firstSession,
    });

    if (!firstPersist.ok) {
      throw new Error("Expected first snapshot to persist.");
    }

    const secondSession = recordLifeCounterAction(
      firstSession,
      createLifeCounterAction(
        "adjust-poison",
        {
          playerId: "player-1",
          amount: 1,
          previousPoison: 0,
          nextPoison: 1,
        },
        { createdAt: "2030-06-15T00:00:02.000Z" },
      ),
    );
    const secondPersist = await persistLinkedLifeCounterSession(db, {
      viewerUserId: fixture.ownerId,
      kind: "event",
      eventId: fixture.eventId,
      localSessionKey,
      expectedServerActionSequence: firstPersist.serverActionSequence,
      expectedServerUpdatedAt: firstPersist.serverUpdatedAt,
      session: secondSession,
    });

    if (!secondPersist.ok) {
      throw new Error("Expected second snapshot to persist.");
    }

    const staleSession = recordLifeCounterAction(
      firstSession,
      createLifeCounterAction(
        "adjust-storm",
        {
          amount: 1,
          previousValue: 0,
          nextValue: 1,
        },
        { createdAt: "2030-06-15T00:00:03.000Z" },
      ),
    );
    const stalePersist = await persistLinkedLifeCounterSession(db, {
      viewerUserId: fixture.memberId,
      kind: "event",
      eventId: fixture.eventId,
      localSessionKey,
      expectedServerActionSequence: firstPersist.serverActionSequence,
      expectedServerUpdatedAt: firstPersist.serverUpdatedAt,
      session: staleSession,
    });

    expect(stalePersist).toMatchObject({
      ok: false,
      reason: "conflict",
      serverActionSequence: secondPersist.serverActionSequence,
      serverUpdatedAt: secondPersist.serverUpdatedAt,
    });
    expect(
      stalePersist.ok ? null : stalePersist.serverSession?.players[0]?.poison,
    ).toBe(1);

    const reloaded = await getLinkedLifeCounterSessionForViewer(db, {
      viewerUserId: fixture.ownerId,
      kind: "event",
      eventId: fixture.eventId,
      localSessionKey,
    });

    expect(reloaded?.session.stormCount).toBe(0);
    expect(reloaded?.session.players[0]?.poison).toBe(1);
  });

  test("requires scoped access and a published pod for pod-linked snapshots", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const fixture = await createLinkedLifeCounterFixture(db);
    const podId = "61000000-0000-4000-8000-000000000201";
    const localSessionKey = createPodSessionKey(fixture.eventId, podId);

    await db.insert(pods).values({
      id: podId,
      eventId: fixture.eventId,
      name: "Pod 1",
      state: "locked",
      position: 1,
      publishedAt: new Date("2030-06-15T00:05:00.000Z"),
    });

    const persisted = await persistLinkedLifeCounterSession(db, {
      viewerUserId: fixture.memberId,
      kind: "pod",
      eventId: fixture.eventId,
      podId,
      localSessionKey,
      expectedServerActionSequence: null,
      expectedServerUpdatedAt: null,
      session: createSessionWithLifeLoss(localSessionKey, 4),
    });

    expect(persisted.ok).toBe(true);

    await expect(
      persistLinkedLifeCounterSession(db, {
        viewerUserId: fixture.outsiderId,
        kind: "pod",
        eventId: fixture.eventId,
        podId,
        localSessionKey,
        expectedServerActionSequence: null,
        expectedServerUpdatedAt: null,
        session: createSessionWithLifeLoss(localSessionKey, 5),
      }),
    ).rejects.toThrow(LinkedLifeCounterAuthorizationError);

    await db.update(pods).set({ publishedAt: null }).where(eq(pods.id, podId));

    await expect(
      getLinkedLifeCounterSessionForViewer(db, {
        viewerUserId: fixture.ownerId,
        kind: "pod",
        eventId: fixture.eventId,
        podId,
        localSessionKey,
      }),
    ).rejects.toThrow(LinkedLifeCounterAuthorizationError);
  });
});

async function createLinkedLifeCounterFixture(db: AppDatabase) {
  const ownerId = "61000000-0000-4000-8000-000000000001";
  const memberId = "61000000-0000-4000-8000-000000000002";
  const outsiderId = "61000000-0000-4000-8000-000000000003";

  await db.insert(users).values([
    {
      id: ownerId,
      email: "linked-life-owner@example.test",
      name: "Linked Owner",
    },
    {
      id: memberId,
      email: "linked-life-member@example.test",
      name: "Linked Member",
    },
    {
      id: outsiderId,
      email: "linked-life-outsider@example.test",
      name: "Linked Outsider",
    },
  ]);

  const group = await createPlaygroupForUser(db, {
    userId: ownerId,
    ownerDisplayName: "Linked Owner",
    name: "Linked Life Group",
    slugBase: "linked-life-group",
    description: "",
  });

  await db.insert(playgroupMemberships).values({
    playgroupId: group.id,
    userId: memberId,
    role: "member",
    displayName: "Linked Member",
  });

  const event = await createEventForPlaygroup(db, {
    viewerUserId: ownerId,
    playgroupId: group.id,
    title: "Linked Life Night",
    description: "",
    startsAt: new Date("2030-06-15T00:00:00.000Z"),
    visibility: "members",
  });

  return {
    eventId: event.id,
    memberId,
    outsiderId,
    ownerId,
    playgroupId: group.id,
  };
}

function createSessionWithLifeLoss(sessionId: string, amount: number) {
  const session = createInitialLifeCounterSession("2030-06-15T00:00:00.000Z", {
    id: sessionId,
  });

  return recordLifeCounterAction(
    session,
    createLifeCounterAction(
      "adjust-life",
      {
        playerId: "player-1",
        amount: -amount,
        previousLife: 40,
        nextLife: 40 - amount,
      },
      { createdAt: "2030-06-15T00:00:01.000Z" },
    ),
  );
}

function createEventSessionKey(eventId: string) {
  return `linked-life:event:${eventId}`;
}

function createPodSessionKey(eventId: string, podId: string) {
  return `linked-life:pod:${eventId}:${podId}`;
}
