import { asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import type { AppDatabase } from "@/db/client";
import {
  auditEvents,
  playgroupInvites,
  playgroupMemberships,
  playgroups,
  users,
} from "@/db/schema";
import { hashInviteToken } from "@/db/tokens";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import {
  acceptPlaygroupInviteForViewer,
  archivePlaygroupForViewer,
  changePlaygroupMemberRoleForViewer,
  createPlaygroupForUser,
  createPlaygroupInviteForViewer,
  getPlaygroupInviteSummaryByToken,
  listPlaygroupsForViewer,
  listPlaygroupInvitesForViewer,
  listVisiblePlaygroupMembersForViewer,
  PlaygroupArchiveAuthorizationError,
  PlaygroupInviteAcceptanceError,
  PlaygroupInviteAuthorizationError,
  PlaygroupLastOwnerError,
  PlaygroupManagementAuthorizationError,
  PlaygroupMemberManagementAuthorizationError,
  removePlaygroupMemberForViewer,
  revokePlaygroupInviteForViewer,
  updatePlaygroupForViewer,
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

  test("lets owners and admins edit active playgroups with safe audit metadata", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000041",
      email: "edit-owner@example.test",
      name: "Edit Owner",
    });
    await insertUser(db, {
      id: "20000000-0000-4000-8000-000000000042",
      email: "edit-admin@example.test",
      name: "Edit Admin",
    });

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000041",
      ownerDisplayName: "Edit Owner",
      name: "Original Group",
      slugBase: "original-group",
      description: "Original planning note.",
    });
    await db.insert(playgroupMemberships).values({
      playgroupId: created.id,
      userId: "20000000-0000-4000-8000-000000000042",
      role: "admin",
    });

    await expect(
      updatePlaygroupForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000042",
        playgroupId: created.id,
        name: "Renamed Group",
        description: "Updated planning note.",
      }),
    ).resolves.toMatchObject({
      id: created.id,
      name: "Renamed Group",
      slug: "original-group",
      description: "Updated planning note.",
    });

    const [listed] = await listPlaygroupsForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000041",
    });
    expect(listed).toMatchObject({
      id: created.id,
      name: "Renamed Group",
      slug: "original-group",
      description: "Updated planning note.",
    });

    const auditRows = await db
      .select({
        action: auditEvents.action,
        actorUserId: auditEvents.actorUserId,
        playgroupId: auditEvents.playgroupId,
        targetType: auditEvents.targetType,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .where(eq(auditEvents.playgroupId, created.id));

    expect(auditRows).toEqual([
      {
        action: "playgroup.updated",
        actorUserId: "20000000-0000-4000-8000-000000000042",
        playgroupId: created.id,
        targetType: "playgroup",
        targetId: created.id,
        metadata: {
          nameChanged: true,
          descriptionChanged: true,
        },
      },
    ]);
    expect(JSON.stringify(auditRows)).not.toContain("Renamed Group");
    expect(JSON.stringify(auditRows)).not.toContain("Updated planning note");
  });

  test("archives groups for owners only and makes archived groups inert", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await Promise.all([
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000043",
        email: "archive-owner@example.test",
        name: "Archive Owner",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000044",
        email: "archive-admin@example.test",
        name: "Archive Admin",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000045",
        email: "archive-member@example.test",
        name: "Archive Member",
      }),
    ]);

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000043",
      ownerDisplayName: "Archive Owner",
      name: "Archive Group",
      slugBase: "archive-group",
      description: "",
    });
    await db.insert(playgroupMemberships).values([
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000044",
        role: "admin",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000045",
        role: "member",
      },
    ]);
    const invite = await createPlaygroupInviteForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000043",
      playgroupId: created.id,
    });

    await expect(
      archivePlaygroupForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000044",
        playgroupId: created.id,
      }),
    ).rejects.toBeInstanceOf(PlaygroupArchiveAuthorizationError);

    const archivedAt = new Date("2030-06-01T12:00:00.000Z");
    await expect(
      archivePlaygroupForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000043",
        playgroupId: created.id,
        archivedAt,
      }),
    ).resolves.toEqual({
      playgroupId: created.id,
      archivedAt,
    });

    const [storedGroup] = await db
      .select({
        archivedAt: playgroups.archivedAt,
      })
      .from(playgroups)
      .where(eq(playgroups.id, created.id));
    expect(storedGroup?.archivedAt).toEqual(archivedAt);

    const [storedInvite] = await db
      .select({
        revokedAt: playgroupInvites.revokedAt,
      })
      .from(playgroupInvites)
      .where(eq(playgroupInvites.id, invite.id));
    expect(storedInvite?.revokedAt).toEqual(archivedAt);

    await expect(
      listPlaygroupsForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000043",
      }),
    ).resolves.toEqual([]);
    await expect(
      listPlaygroupInvitesForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000043",
        playgroupId: created.id,
      }),
    ).resolves.toEqual([]);
    await expect(
      getPlaygroupInviteSummaryByToken(db, {
        inviteToken: invite.inviteToken,
      }),
    ).resolves.toBeNull();
    await expect(
      acceptPlaygroupInviteForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000045",
        inviteToken: invite.inviteToken,
      }),
    ).rejects.toBeInstanceOf(PlaygroupInviteAcceptanceError);
    await expect(
      updatePlaygroupForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000043",
        playgroupId: created.id,
        name: "Archived Rename",
        description: "",
      }),
    ).rejects.toBeInstanceOf(PlaygroupManagementAuthorizationError);

    const auditRows = await db
      .select({
        action: auditEvents.action,
        actorUserId: auditEvents.actorUserId,
        playgroupId: auditEvents.playgroupId,
        targetType: auditEvents.targetType,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .where(eq(auditEvents.playgroupId, created.id))
      .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));

    expect(auditRows.at(-1)).toEqual({
      action: "playgroup.archived",
      actorUserId: "20000000-0000-4000-8000-000000000043",
      playgroupId: created.id,
      targetType: "playgroup",
      targetId: created.id,
      metadata: {
        activeInviteCount: 1,
        memberCount: 3,
      },
    });
    expect(JSON.stringify(auditRows)).not.toContain("Archive Group");
    expect(JSON.stringify(auditRows)).not.toContain(invite.inviteToken);
    expect(JSON.stringify(auditRows)).not.toContain(
      hashInviteToken(invite.inviteToken),
    );
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

    const auditRows = await db
      .select({
        action: auditEvents.action,
        actorUserId: auditEvents.actorUserId,
        playgroupId: auditEvents.playgroupId,
        targetType: auditEvents.targetType,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .where(eq(auditEvents.playgroupId, created.id))
      .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));

    expect(auditRows).toEqual([
      {
        action: "playgroup.invite.created",
        actorUserId: "20000000-0000-4000-8000-000000000011",
        playgroupId: created.id,
        targetType: "playgroup_invite",
        targetId: ownerInvite.id,
        metadata: {
          role: "member",
        },
      },
      {
        action: "playgroup.invite.created",
        actorUserId: "20000000-0000-4000-8000-000000000012",
        playgroupId: created.id,
        targetType: "playgroup_invite",
        targetId: adminInvite.id,
        metadata: {
          role: "member",
        },
      },
      {
        action: "playgroup.invite.revoked",
        actorUserId: "20000000-0000-4000-8000-000000000011",
        playgroupId: created.id,
        targetType: "playgroup_invite",
        targetId: ownerInvite.id,
        metadata: {
          role: "member",
          alreadyRevoked: false,
        },
      },
    ]);
    expect(JSON.stringify(auditRows)).not.toContain(ownerInvite.inviteToken);
    expect(JSON.stringify(auditRows)).not.toContain(
      hashInviteToken(ownerInvite.inviteToken),
    );
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

  test("lets owners and admins change allowed member roles and remove memberships only", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await Promise.all([
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000021",
        email: "manage-owner@example.test",
        name: "Manage Owner",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000022",
        email: "manage-admin@example.test",
        name: "Manage Admin",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000023",
        email: "manage-member@example.test",
        name: "Manage Member",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000024",
        email: "remove-member@example.test",
        name: "Remove Member",
      }),
    ]);

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000021",
      ownerDisplayName: "Manage Owner",
      name: "Member Managers",
      slugBase: "member-managers",
      description: "",
    });
    await db.insert(playgroupMemberships).values([
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000022",
        role: "admin",
        displayName: "Manage Admin",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000023",
        role: "member",
        displayName: "Manage Member",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000024",
        role: "member",
        displayName: "Remove Member",
      },
    ]);

    const memberships = await db
      .select({
        id: playgroupMemberships.id,
        userId: playgroupMemberships.userId,
      })
      .from(playgroupMemberships)
      .where(eq(playgroupMemberships.playgroupId, created.id));
    const memberMembership = memberships.find(
      (membership) =>
        membership.userId === "20000000-0000-4000-8000-000000000023",
    );
    const removedMembership = memberships.find(
      (membership) =>
        membership.userId === "20000000-0000-4000-8000-000000000024",
    );

    expect(memberMembership).toBeDefined();
    expect(removedMembership).toBeDefined();

    await expect(
      changePlaygroupMemberRoleForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000021",
        membershipId: memberMembership!.id,
        role: "host",
      }),
    ).resolves.toMatchObject({
      id: memberMembership!.id,
      displayName: "Manage Member",
      role: "host",
      canChangeRole: true,
      canRemove: true,
    });

    await expect(
      changePlaygroupMemberRoleForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000022",
        membershipId: memberMembership!.id,
        role: "member",
      }),
    ).resolves.toMatchObject({
      id: memberMembership!.id,
      role: "member",
      canChangeRole: true,
      canRemove: true,
    });

    await expect(
      removePlaygroupMemberForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000022",
        membershipId: removedMembership!.id,
      }),
    ).resolves.toEqual({
      playgroupId: created.id,
      membershipId: removedMembership!.id,
    });

    const remainingRemovedMemberships = await db
      .select({
        id: playgroupMemberships.id,
      })
      .from(playgroupMemberships)
      .where(eq(playgroupMemberships.id, removedMembership!.id));
    const [removedUser] = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, "20000000-0000-4000-8000-000000000024"));

    expect(remainingRemovedMemberships).toEqual([]);
    expect(removedUser).toEqual({
      id: "20000000-0000-4000-8000-000000000024",
      email: "remove-member@example.test",
    });

    const auditRows = await db
      .select({
        action: auditEvents.action,
        actorUserId: auditEvents.actorUserId,
        playgroupId: auditEvents.playgroupId,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .where(eq(auditEvents.playgroupId, created.id))
      .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));

    expect(auditRows).toEqual([
      {
        action: "playgroup.member.role_changed",
        actorUserId: "20000000-0000-4000-8000-000000000021",
        playgroupId: created.id,
        targetId: memberMembership!.id,
        metadata: {
          targetUserId: "20000000-0000-4000-8000-000000000023",
          previousRole: "member",
          newRole: "host",
        },
      },
      {
        action: "playgroup.member.role_changed",
        actorUserId: "20000000-0000-4000-8000-000000000022",
        playgroupId: created.id,
        targetId: memberMembership!.id,
        metadata: {
          targetUserId: "20000000-0000-4000-8000-000000000023",
          previousRole: "host",
          newRole: "member",
        },
      },
      {
        action: "playgroup.member.removed",
        actorUserId: "20000000-0000-4000-8000-000000000022",
        playgroupId: created.id,
        targetId: removedMembership!.id,
        metadata: {
          targetUserId: "20000000-0000-4000-8000-000000000024",
          previousRole: "member",
        },
      },
    ]);
    expect(JSON.stringify(auditRows)).not.toContain("Manage Member");
    expect(JSON.stringify(auditRows)).not.toContain("Remove Member");
    expect(JSON.stringify(auditRows)).not.toContain(
      "remove-member@example.test",
    );
  });

  test("protects owner roles, last owner, and member management authorization", async () => {
    const { db } = await createMigratedPgliteDatabase();
    await Promise.all([
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000025",
        email: "rules-owner@example.test",
        name: "Rules Owner",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000026",
        email: "rules-admin@example.test",
        name: "Rules Admin",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000027",
        email: "rules-host@example.test",
        name: "Rules Host",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000028",
        email: "rules-member@example.test",
        name: "Rules Member",
      }),
      insertUser(db, {
        id: "20000000-0000-4000-8000-000000000029",
        email: "rules-stranger@example.test",
        name: "Rules Stranger",
      }),
    ]);

    const created = await createPlaygroupForUser(db, {
      userId: "20000000-0000-4000-8000-000000000025",
      ownerDisplayName: "Rules Owner",
      name: "Member Rules",
      slugBase: "member-rules",
      description: "",
    });
    await db.insert(playgroupMemberships).values([
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000026",
        role: "admin",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000027",
        role: "host",
      },
      {
        playgroupId: created.id,
        userId: "20000000-0000-4000-8000-000000000028",
        role: "member",
      },
    ]);

    const memberships = await db
      .select({
        id: playgroupMemberships.id,
        userId: playgroupMemberships.userId,
      })
      .from(playgroupMemberships)
      .where(eq(playgroupMemberships.playgroupId, created.id));
    const ownerMembership = memberships.find(
      (membership) =>
        membership.userId === "20000000-0000-4000-8000-000000000025",
    );
    const adminMembership = memberships.find(
      (membership) =>
        membership.userId === "20000000-0000-4000-8000-000000000026",
    );
    const hostMembership = memberships.find(
      (membership) =>
        membership.userId === "20000000-0000-4000-8000-000000000027",
    );
    const memberMembership = memberships.find(
      (membership) =>
        membership.userId === "20000000-0000-4000-8000-000000000028",
    );

    expect(ownerMembership).toBeDefined();
    expect(adminMembership).toBeDefined();
    expect(hostMembership).toBeDefined();
    expect(memberMembership).toBeDefined();

    await expect(
      changePlaygroupMemberRoleForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000026",
        membershipId: ownerMembership!.id,
        role: "member",
      }),
    ).rejects.toBeInstanceOf(PlaygroupMemberManagementAuthorizationError);
    await expect(
      removePlaygroupMemberForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000026",
        membershipId: ownerMembership!.id,
      }),
    ).rejects.toBeInstanceOf(PlaygroupMemberManagementAuthorizationError);
    await expect(
      changePlaygroupMemberRoleForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000026",
        membershipId: memberMembership!.id,
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(PlaygroupMemberManagementAuthorizationError);

    for (const viewerUserId of [
      "20000000-0000-4000-8000-000000000027",
      "20000000-0000-4000-8000-000000000028",
      "20000000-0000-4000-8000-000000000029",
    ]) {
      await expect(
        changePlaygroupMemberRoleForViewer(db, {
          viewerUserId,
          membershipId: hostMembership!.id,
          role: "member",
        }),
      ).rejects.toBeInstanceOf(PlaygroupMemberManagementAuthorizationError);
      await expect(
        removePlaygroupMemberForViewer(db, {
          viewerUserId,
          membershipId: hostMembership!.id,
        }),
      ).rejects.toBeInstanceOf(PlaygroupMemberManagementAuthorizationError);
    }

    await expect(
      changePlaygroupMemberRoleForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000025",
        membershipId: ownerMembership!.id,
        role: "member",
      }),
    ).rejects.toBeInstanceOf(PlaygroupLastOwnerError);
    await expect(
      removePlaygroupMemberForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000025",
        membershipId: ownerMembership!.id,
      }),
    ).rejects.toBeInstanceOf(PlaygroupLastOwnerError);

    await changePlaygroupMemberRoleForViewer(db, {
      viewerUserId: "20000000-0000-4000-8000-000000000025",
      membershipId: adminMembership!.id,
      role: "owner",
    });
    await expect(
      changePlaygroupMemberRoleForViewer(db, {
        viewerUserId: "20000000-0000-4000-8000-000000000025",
        membershipId: ownerMembership!.id,
        role: "member",
      }),
    ).resolves.toMatchObject({
      id: ownerMembership!.id,
      role: "member",
    });
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
