import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import { playgroupMemberships, users } from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import {
  createPlaygroupForUser,
  listPlaygroupsForViewer,
  listVisiblePlaygroupMembersForViewer,
} from "./playgroups";

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
        members: [
          {
            displayName: "Riley Chen",
            role: "owner",
          },
        ],
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

  test("lists safe member details only for authorized group members", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000004",
      email: "owner@example.test",
      name: "Riley Owner",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000005",
      email: "admin@example.test",
      name: "Mina Admin",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000006",
      email: "host@example.test",
      name: "Hana Host",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000007",
      email: "member@example.test",
      name: "Nora Member",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000008",
      email: "guest@example.test",
      name: "Private Guest",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000009",
      email: "viewer@example.test",
      name: "Read Only",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000010",
      email: "stranger@example.test",
      name: "Stranger User",
    });

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000004",
      ownerDisplayName: "Riley Owner",
      name: "Scoped Member Crew",
      slugBase: "scoped-member-crew",
      description: "",
    });

    await db.insert(playgroupMemberships).values([
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000005",
        role: "admin",
        displayName: "Mina Rules",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000006",
        role: "host",
        displayName: "Hana Host",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000007",
        role: "member",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000008",
        role: "guest",
        displayName: "Private Guest",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000009",
        role: "viewer",
        displayName: "Read Only",
      },
    ]);

    await expect(
      listVisiblePlaygroupMembersForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000004",
        playgroupId: created.id,
      }),
    ).resolves.toMatchObject([
      {
        displayName: "Riley Owner",
        role: "owner",
      },
      {
        displayName: "Mina Rules",
        role: "admin",
      },
      {
        displayName: "Hana Host",
        role: "host",
      },
      {
        displayName: "Nora Member",
        role: "member",
      },
    ]);

    const [group] = await listPlaygroupsForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000004",
    });

    expect(group?.memberCount).toBe(4);
    expect(group?.members).toHaveLength(4);
    expect(JSON.stringify(group?.members)).not.toContain("example.test");
    expect(JSON.stringify(group?.members)).not.toContain("Private Guest");
    expect(JSON.stringify(group?.members)).not.toContain("Read Only");

    await expect(
      listVisiblePlaygroupMembersForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000010",
        playgroupId: created.id,
      }),
    ).resolves.toEqual([]);

    await expect(
      listVisiblePlaygroupMembersForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000008",
        playgroupId: created.id,
      }),
    ).resolves.toEqual([]);
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
