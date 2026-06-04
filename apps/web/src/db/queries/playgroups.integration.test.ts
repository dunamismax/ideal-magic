import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import { playgroupInvites, playgroupMemberships, users } from "@/db/schema";
import { hashInviteToken } from "@/db/tokens";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import {
  acceptPlaygroupInviteForViewer,
  createPlaygroupForUser,
  createPlaygroupInviteForViewer,
  getPlaygroupInviteSummaryByToken,
  listPlaygroupsForViewer,
  listPlaygroupInvitesForViewer,
  listVisiblePlaygroupMembersForViewer,
  PlaygroupInviteAcceptanceError,
  PlaygroupInviteAuthorizationError,
  revokePlaygroupInviteForViewer,
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

  test("lets owners and admins create, list, and revoke hashed group invites", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000011",
      email: "invite-owner@example.test",
      name: "Invite Owner",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000012",
      email: "invite-admin@example.test",
      name: "Invite Admin",
    });

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000011",
      ownerDisplayName: "Invite Owner",
      name: "Invite Managers",
      slugBase: "invite-managers",
      description: "",
    });
    await db.insert(playgroupMemberships).values({
      playgroupId: created.id,
      userId: "20000000-0000-4000-8000-000000000012",
      role: "admin",
      displayName: "Invite Admin",
    });

    const ownerInvite = await createPlaygroupInviteForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000011",
      playgroupId: created.id,
      now: new Date("2026-06-04T00:00:00.000Z"),
    });
    const adminInvite = await createPlaygroupInviteForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000012",
      playgroupId: created.id,
      now: new Date("2026-06-04T00:00:00.000Z"),
    });

    expect(ownerInvite.inviteToken).toHaveLength(43);
    expect(ownerInvite).toMatchObject({
      playgroupId: created.id,
      role: "member",
      usedCount: 0,
      maxUses: null,
      expiresAt: null,
      revokedAt: null,
      isActive: true,
    });

    const storedInviteRows = await db
      .select({
        tokenHash: playgroupInvites.tokenHash,
      })
      .from(playgroupInvites)
      .where(eq(playgroupInvites.id, ownerInvite.id));

    expect(storedInviteRows).toEqual([
      {
        tokenHash: hashInviteToken(ownerInvite.inviteToken),
      },
    ]);
    expect(JSON.stringify(storedInviteRows)).not.toContain(
      ownerInvite.inviteToken,
    );

    const listed = await listPlaygroupInvitesForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000011",
      playgroupId: created.id,
      now: new Date("2026-06-04T00:00:00.000Z"),
    });

    expect(listed).toHaveLength(2);
    expect(listed.map((invite) => invite.id)).toContain(ownerInvite.id);
    expect(listed.map((invite) => invite.id)).toContain(adminInvite.id);
    expect(JSON.stringify(listed)).not.toContain(ownerInvite.inviteToken);
    expect(JSON.stringify(listed)).not.toContain("tokenHash");

    const revoked = await revokePlaygroupInviteForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000011",
      inviteId: ownerInvite.id,
      now: new Date("2026-06-04T01:00:00.000Z"),
    });

    expect(revoked).toMatchObject({
      id: ownerInvite.id,
      isActive: false,
      revokedAt: new Date("2026-06-04T01:00:00.000Z"),
    });
  });

  test("denies invite management to hosts, members, guests, viewers, and non-members", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await Promise.all([
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000013",
        email: "deny-owner@example.test",
        name: "Deny Owner",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000014",
        email: "deny-host@example.test",
        name: "Deny Host",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000015",
        email: "deny-member@example.test",
        name: "Deny Member",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000016",
        email: "deny-guest@example.test",
        name: "Deny Guest",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000017",
        email: "deny-viewer@example.test",
        name: "Deny Viewer",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000018",
        email: "deny-stranger@example.test",
        name: "Deny Stranger",
      }),
    ]);

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000013",
      ownerDisplayName: "Deny Owner",
      name: "Invite Denials",
      slugBase: "invite-denials",
      description: "",
    });
    await db.insert(playgroupMemberships).values([
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000014",
        role: "host",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000015",
        role: "member",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000016",
        role: "guest",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000017",
        role: "viewer",
      },
    ]);
    const invite = await createPlaygroupInviteForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000013",
      playgroupId: created.id,
    });

    for (const viewerUserId of [
      "20000000-0000-4000-8000-000000000014",
      "20000000-0000-4000-8000-000000000015",
      "20000000-0000-4000-8000-000000000016",
      "20000000-0000-4000-8000-000000000017",
      "20000000-0000-4000-8000-000000000018",
    ]) {
      await expect(
        createPlaygroupInviteForViewer(db, {
          viewerUserId,
          playgroupId: created.id,
        }),
      ).rejects.toBeInstanceOf(PlaygroupInviteAuthorizationError);
      await expect(
        listPlaygroupInvitesForViewer(db, {
          viewerUserId,
          playgroupId: created.id,
        }),
      ).resolves.toEqual([]);
      await expect(
        revokePlaygroupInviteForViewer(db, {
          viewerUserId,
          inviteId: invite.id,
        }),
      ).rejects.toBeInstanceOf(PlaygroupInviteAuthorizationError);
    }
  });

  test("accepts active invite tokens without leaking raw tokens through summaries", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000019",
      email: "accept-owner@example.test",
      name: "Accept Owner",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000020",
      email: "accept-member@example.test",
      name: "Accept Member",
    });

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000019",
      ownerDisplayName: "Accept Owner",
      name: "Invite Acceptance",
      slugBase: "invite-acceptance",
      description: "",
    });
    const invite = await createPlaygroupInviteForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000019",
      playgroupId: created.id,
      now: new Date("2026-06-04T00:00:00.000Z"),
    });

    const summary = await getPlaygroupInviteSummaryByToken(db, {
      inviteToken: invite.inviteToken,
      now: new Date("2026-06-04T00:00:00.000Z"),
    });

    expect(summary).toMatchObject({
      id: invite.id,
      role: "member",
      isActive: true,
      playgroup: {
        id: created.id,
        name: "Invite Acceptance",
        slug: "invite-acceptance",
      },
    });
    expect(JSON.stringify(summary)).not.toContain(invite.inviteToken);
    expect(JSON.stringify(summary)).not.toContain("tokenHash");

    await expect(
      acceptPlaygroupInviteForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000020",
        inviteToken: invite.inviteToken,
        displayName: "Accepted Member",
        now: new Date("2026-06-04T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      playgroupId: created.id,
      alreadyMember: false,
    });

    const memberships = await db
      .select({
        userId: playgroupMemberships.userId,
        role: playgroupMemberships.role,
        displayName: playgroupMemberships.displayName,
      })
      .from(playgroupMemberships)
      .where(eq(playgroupMemberships.playgroupId, created.id));

    expect(memberships).toContainEqual({
      userId: "20000000-0000-4000-8000-000000000020",
      role: "member",
      displayName: "Accepted Member",
    });

    await expect(
      acceptPlaygroupInviteForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000020",
        inviteToken: invite.inviteToken,
        displayName: "Accepted Member",
      }),
    ).resolves.toEqual({
      playgroupId: created.id,
      alreadyMember: true,
    });

    const [inviteUsage] = await db
      .select({
        usedCount: playgroupInvites.usedCount,
      })
      .from(playgroupInvites)
      .where(eq(playgroupInvites.id, invite.id));

    expect(inviteUsage?.usedCount).toBe(1);

    await revokePlaygroupInviteForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000019",
      inviteId: invite.id,
    });
    await expect(
      acceptPlaygroupInviteForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000020",
        inviteToken: invite.inviteToken,
      }),
    ).rejects.toBeInstanceOf(PlaygroupInviteAcceptanceError);
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
