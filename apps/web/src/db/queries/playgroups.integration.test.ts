import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import { playgroupMemberships, users } from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import { createPlaygroupForUser, listPlaygroupsForViewer } from "./playgroups";

describe("playgroup data access", () => {
  test("creates a playgroup with an owner membership and lists it for the viewer", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000001",
      email: "riley@example.test",
      name: "Riley Chen",
    });

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000001",
      ownerDisplayName: "Riley Chen",
      name: "Thursday Commander Crew",
      slugBase: "thursday-commander-crew",
      description: "Rotating hosts and bracket-aware pods.",
    });

    expect(created).toMatchObject({
      name: "Thursday Commander Crew",
      slug: "thursday-commander-crew",
      description: "Rotating hosts and bracket-aware pods.",
    });

    const memberships = await db
      .select({
        playgroupId: playgroupMemberships.playgroupId,
        userId: playgroupMemberships.userId,
        role: playgroupMemberships.role,
        displayName: playgroupMemberships.displayName,
      })
      .from(playgroupMemberships)
      .where(eq(playgroupMemberships.playgroupId, created.id));

    expect(memberships).toEqual([
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000001",
        role: "owner",
        displayName: "Riley Chen",
      },
    ]);

    await expect(
      listPlaygroupsForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000001",
        now: new Date("2026-06-04T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject([
      {
        id: created.id,
        name: "Thursday Commander Crew",
        slug: "thursday-commander-crew",
        role: "owner",
        memberCount: 1,
        upcomingEventCount: 0,
      },
    ]);
  });

  test("keeps viewer lists scoped and generates unique slugs", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000002",
      email: "sam@example.test",
      name: "Sam Vale",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000003",
      email: "taylor@example.test",
      name: "Taylor Park",
    });

    await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000002",
      ownerDisplayName: "Sam Vale",
      name: "Friday Pods",
      slugBase: "friday-pods",
      description: "",
    });
    const secondGroup = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000003",
      ownerDisplayName: "Taylor Park",
      name: "Friday Pods",
      slugBase: "friday-pods",
      description: "",
    });

    expect(secondGroup.slug).toBe("friday-pods-2");

    await expect(
      listPlaygroupsForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toMatchObject([
      {
        name: "Friday Pods",
        slug: "friday-pods",
        role: "owner",
      },
    ]);
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
