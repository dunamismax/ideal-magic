import { and, asc, count, desc, eq, gt, inArray, like, sql } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import {
  events,
  playgroupInvites,
  playgroupMemberships,
  playgroups,
  users,
} from "../schema";
import {
  canManagePlaygroup,
  canManagePlaygroupMemberRole,
  canViewPlaygroupMembers,
  isPlaygroupMemberDirectoryRole,
  type PlaygroupRole,
} from "../scopes";
import {
  generateInviteToken,
  hashInviteToken,
  normalizeInviteToken,
} from "../tokens";

type PlaygroupDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "update" | "delete" | "transaction"
>;
type PlaygroupReadDatabase = Pick<AppDatabase, "select">;

const memberDirectoryRoles = ["owner", "admin", "host", "member"] as const;

export type ViewerPlaygroupListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  role: PlaygroupRole;
  canManagePlaygroup: boolean;
  memberCount: number;
  members: ViewerPlaygroupMember[];
  invites: ViewerPlaygroupInvite[];
  upcomingEventCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ViewerPlaygroupMember = {
  id: string;
  displayName: string;
  role: "owner" | "admin" | "host" | "member";
  joinedAt: Date;
  canChangeRole: boolean;
  canRemove: boolean;
};

export type ViewerPlaygroupInvite = {
  id: string;
  role: PlaygroupRole;
  usedCount: number;
  maxUses: number | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  isActive: boolean;
};

export type CreatedPlaygroup = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export type CreatedPlaygroupInvite = ViewerPlaygroupInvite & {
  playgroupId: string;
  inviteToken: string;
};

export type PlaygroupInviteSummary = ViewerPlaygroupInvite & {
  playgroup: {
    id: string;
    name: string;
    slug: string;
  };
};

export type AcceptedPlaygroupInvite = {
  playgroupId: string;
  alreadyMember: boolean;
};

export class PlaygroupInviteAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot manage invites for this playgroup.");
    this.name = "PlaygroupInviteAuthorizationError";
  }
}

export class PlaygroupInviteAcceptanceError extends Error {
  constructor() {
    super("Invite cannot be accepted.");
    this.name = "PlaygroupInviteAcceptanceError";
  }
}

export class PlaygroupMemberManagementAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot manage this playgroup member.");
    this.name = "PlaygroupMemberManagementAuthorizationError";
  }
}

export class PlaygroupLastOwnerError extends Error {
  constructor() {
    super("Playgroup must keep at least one owner.");
    this.name = "PlaygroupLastOwnerError";
  }
}

export async function listPlaygroupsForViewer(
  db: PlaygroupReadDatabase,
  input: {
    viewerUserId: string;
    now?: Date;
  },
): Promise<ViewerPlaygroupListItem[]> {
  const rows = await db
    .select({
      id: playgroups.id,
      name: playgroups.name,
      slug: playgroups.slug,
      description: playgroups.description,
      createdAt: playgroups.createdAt,
      updatedAt: playgroups.updatedAt,
      role: playgroupMemberships.role,
    })
    .from(playgroupMemberships)
    .innerJoin(playgroups, eq(playgroupMemberships.playgroupId, playgroups.id))
    .where(eq(playgroupMemberships.userId, input.viewerUserId))
    .orderBy(asc(playgroups.name), asc(playgroups.id));

  return Promise.all(
    rows.map(async (row) => {
      const role = asPlaygroupRole(row.role);

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        role,
        canManagePlaygroup: canManagePlaygroup(role),
        memberCount: await countMembersForPlaygroup(db, row.id),
        members: await listVisiblePlaygroupMembersForViewer(db, {
          viewerUserId: input.viewerUserId,
          playgroupId: row.id,
        }),
        invites: await listPlaygroupInvitesForViewer(db, {
          viewerUserId: input.viewerUserId,
          playgroupId: row.id,
          now: input.now,
        }),
        upcomingEventCount: await countUpcomingEventsForPlaygroup(db, {
          playgroupId: row.id,
          now: input.now ?? new Date(),
        }),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),
  );
}

export async function listVisiblePlaygroupMembersForViewer(
  db: PlaygroupReadDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
  },
): Promise<ViewerPlaygroupMember[]> {
  const viewerRole = await getViewerPlaygroupRole(db, input);

  if (!viewerRole || !canViewPlaygroupMembers(viewerRole)) {
    return [];
  }

  const rows = await db
    .select({
      id: playgroupMemberships.id,
      displayName: playgroupMemberships.displayName,
      role: playgroupMemberships.role,
      joinedAt: playgroupMemberships.joinedAt,
      userName: users.name,
    })
    .from(playgroupMemberships)
    .innerJoin(users, eq(playgroupMemberships.userId, users.id))
    .where(
      and(
        eq(playgroupMemberships.playgroupId, input.playgroupId),
        inArray(playgroupMemberships.role, memberDirectoryRoles),
      ),
    )
    .orderBy(asc(playgroupMemberships.joinedAt), asc(playgroupMemberships.id));

  return rows
    .map((row) => {
      const role = asPlaygroupRole(row.role);

      if (!isPlaygroupMemberDirectoryRole(role)) {
        return null;
      }

      return {
        id: row.id,
        displayName: row.displayName ?? row.userName,
        role,
        joinedAt: row.joinedAt,
        canChangeRole: canManagePlaygroupMemberRole(viewerRole, role),
        canRemove: canManagePlaygroupMemberRole(viewerRole, role),
      };
    })
    .filter((member): member is ViewerPlaygroupMember => member !== null)
    .sort(comparePlaygroupMembers);
}

export async function createPlaygroupForUser(
  db: PlaygroupDatabase,
  input: {
    userId: string;
    name: string;
    slugBase: string;
    description: string;
    ownerDisplayName?: string | null;
  },
): Promise<CreatedPlaygroup> {
  return runInTransaction(db, async (tx) => {
    const slug = await createUniquePlaygroupSlug(tx, input.slugBase);
    const [playgroup] = await tx
      .insert(playgroups)
      .values({
        name: input.name,
        slug,
        description: input.description,
        createdByUserId: input.userId,
      })
      .returning({
        id: playgroups.id,
        name: playgroups.name,
        slug: playgroups.slug,
        description: playgroups.description,
      });

    if (!playgroup) {
      throw new Error("Expected playgroup insert to return a row.");
    }

    await tx.insert(playgroupMemberships).values({
      playgroupId: playgroup.id,
      userId: input.userId,
      role: "owner",
      displayName: normalizeOptionalDisplayName(input.ownerDisplayName),
    });

    return playgroup;
  });
}

export async function createPlaygroupInviteForViewer(
  db: PlaygroupDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
    now?: Date;
  },
): Promise<CreatedPlaygroupInvite> {
  return runInTransaction(db, async (tx) => {
    await assertCanManagePlaygroupInvites(tx, input);

    const inviteToken = generateInviteToken();
    const [invite] = await tx
      .insert(playgroupInvites)
      .values({
        playgroupId: input.playgroupId,
        tokenHash: hashInviteToken(inviteToken),
        role: "member",
        createdByUserId: input.viewerUserId,
      })
      .returning({
        id: playgroupInvites.id,
        role: playgroupInvites.role,
        usedCount: playgroupInvites.usedCount,
        maxUses: playgroupInvites.maxUses,
        expiresAt: playgroupInvites.expiresAt,
        revokedAt: playgroupInvites.revokedAt,
        createdAt: playgroupInvites.createdAt,
      });

    if (!invite) {
      throw new Error("Expected playgroup invite insert to return a row.");
    }

    return {
      ...toViewerPlaygroupInvite(invite, input.now ?? new Date()),
      playgroupId: input.playgroupId,
      inviteToken,
    };
  });
}

export async function listPlaygroupInvitesForViewer(
  db: PlaygroupReadDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
    now?: Date;
  },
): Promise<ViewerPlaygroupInvite[]> {
  const role = await getViewerPlaygroupRole(db, input);

  if (!role || !canManagePlaygroup(role)) {
    return [];
  }

  const rows = await db
    .select({
      id: playgroupInvites.id,
      role: playgroupInvites.role,
      usedCount: playgroupInvites.usedCount,
      maxUses: playgroupInvites.maxUses,
      expiresAt: playgroupInvites.expiresAt,
      revokedAt: playgroupInvites.revokedAt,
      createdAt: playgroupInvites.createdAt,
    })
    .from(playgroupInvites)
    .where(eq(playgroupInvites.playgroupId, input.playgroupId))
    .orderBy(desc(playgroupInvites.createdAt), desc(playgroupInvites.id));

  return rows.map((row) =>
    toViewerPlaygroupInvite(row, input.now ?? new Date()),
  );
}

export async function revokePlaygroupInviteForViewer(
  db: PlaygroupDatabase,
  input: {
    viewerUserId: string;
    inviteId: string;
    now?: Date;
  },
): Promise<ViewerPlaygroupInvite> {
  return runInTransaction(db, async (tx) => {
    const [inviteRow] = await tx
      .select({
        playgroupId: playgroupInvites.playgroupId,
        revokedAt: playgroupInvites.revokedAt,
      })
      .from(playgroupInvites)
      .where(eq(playgroupInvites.id, input.inviteId))
      .limit(1);

    if (!inviteRow) {
      throw new PlaygroupInviteAuthorizationError();
    }

    await assertCanManagePlaygroupInvites(tx, {
      viewerUserId: input.viewerUserId,
      playgroupId: inviteRow.playgroupId,
    });

    const revokedAt = inviteRow.revokedAt ?? input.now ?? new Date();
    const [invite] = await tx
      .update(playgroupInvites)
      .set({
        revokedAt,
      })
      .where(eq(playgroupInvites.id, input.inviteId))
      .returning({
        id: playgroupInvites.id,
        role: playgroupInvites.role,
        usedCount: playgroupInvites.usedCount,
        maxUses: playgroupInvites.maxUses,
        expiresAt: playgroupInvites.expiresAt,
        revokedAt: playgroupInvites.revokedAt,
        createdAt: playgroupInvites.createdAt,
      });

    if (!invite) {
      throw new Error("Expected playgroup invite update to return a row.");
    }

    return toViewerPlaygroupInvite(invite, input.now ?? new Date());
  });
}

export async function getPlaygroupInviteSummaryByToken(
  db: PlaygroupReadDatabase,
  input: {
    inviteToken: string;
    now?: Date;
  },
): Promise<PlaygroupInviteSummary | null> {
  const normalizedToken = normalizeInviteToken(input.inviteToken);

  if (!normalizedToken) {
    return null;
  }

  const [row] = await db
    .select({
      id: playgroupInvites.id,
      role: playgroupInvites.role,
      usedCount: playgroupInvites.usedCount,
      maxUses: playgroupInvites.maxUses,
      expiresAt: playgroupInvites.expiresAt,
      revokedAt: playgroupInvites.revokedAt,
      createdAt: playgroupInvites.createdAt,
      playgroupId: playgroups.id,
      playgroupName: playgroups.name,
      playgroupSlug: playgroups.slug,
    })
    .from(playgroupInvites)
    .innerJoin(playgroups, eq(playgroupInvites.playgroupId, playgroups.id))
    .where(eq(playgroupInvites.tokenHash, hashInviteToken(normalizedToken)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...toViewerPlaygroupInvite(row, input.now ?? new Date()),
    playgroup: {
      id: row.playgroupId,
      name: row.playgroupName,
      slug: row.playgroupSlug,
    },
  };
}

export async function acceptPlaygroupInviteForViewer(
  db: PlaygroupDatabase,
  input: {
    viewerUserId: string;
    inviteToken: string;
    displayName?: string | null;
    now?: Date;
  },
): Promise<AcceptedPlaygroupInvite> {
  return runInTransaction(db, async (tx) => {
    const normalizedToken = normalizeInviteToken(input.inviteToken);

    if (!normalizedToken) {
      throw new PlaygroupInviteAcceptanceError();
    }

    const [invite] = await tx
      .select({
        id: playgroupInvites.id,
        playgroupId: playgroupInvites.playgroupId,
        role: playgroupInvites.role,
        usedCount: playgroupInvites.usedCount,
        maxUses: playgroupInvites.maxUses,
        expiresAt: playgroupInvites.expiresAt,
        revokedAt: playgroupInvites.revokedAt,
        createdAt: playgroupInvites.createdAt,
      })
      .from(playgroupInvites)
      .where(eq(playgroupInvites.tokenHash, hashInviteToken(normalizedToken)))
      .limit(1);

    if (!invite) {
      throw new PlaygroupInviteAcceptanceError();
    }

    const inviteProjection = toViewerPlaygroupInvite(
      invite,
      input.now ?? new Date(),
    );
    const inviteRole = inviteProjection.role;

    if (
      !inviteProjection.isActive ||
      inviteRole === "owner" ||
      inviteRole === "admin"
    ) {
      throw new PlaygroupInviteAcceptanceError();
    }

    const [existingMembership] = await tx
      .select({
        id: playgroupMemberships.id,
      })
      .from(playgroupMemberships)
      .where(
        and(
          eq(playgroupMemberships.playgroupId, invite.playgroupId),
          eq(playgroupMemberships.userId, input.viewerUserId),
        ),
      )
      .limit(1);

    if (existingMembership) {
      return {
        playgroupId: invite.playgroupId,
        alreadyMember: true,
      };
    }

    await tx.insert(playgroupMemberships).values({
      playgroupId: invite.playgroupId,
      userId: input.viewerUserId,
      role: inviteRole,
      displayName: normalizeOptionalDisplayName(input.displayName),
    });
    await tx
      .update(playgroupInvites)
      .set({
        usedCount: sql`${playgroupInvites.usedCount} + 1`,
      })
      .where(eq(playgroupInvites.id, invite.id));

    return {
      playgroupId: invite.playgroupId,
      alreadyMember: false,
    };
  });
}

export async function changePlaygroupMemberRoleForViewer(
  db: PlaygroupDatabase,
  input: {
    viewerUserId: string;
    membershipId: string;
    role: "owner" | "admin" | "host" | "member";
  },
): Promise<ViewerPlaygroupMember> {
  return runInTransaction(db, async (tx) => {
    const target = await getManageableMembershipById(tx, input.membershipId);

    if (!target) {
      throw new PlaygroupMemberManagementAuthorizationError();
    }

    const viewerRole = await getViewerPlaygroupRole(tx, {
      viewerUserId: input.viewerUserId,
      playgroupId: target.playgroupId,
    });

    if (
      !viewerRole ||
      !canManagePlaygroupMemberRole(viewerRole, target.role) ||
      !canManagePlaygroupMemberRole(viewerRole, input.role)
    ) {
      throw new PlaygroupMemberManagementAuthorizationError();
    }

    if (target.role === "owner" && input.role !== "owner") {
      await assertPlaygroupHasAnotherOwner(tx, {
        playgroupId: target.playgroupId,
        membershipId: target.id,
      });
    }

    const [updated] = await tx
      .update(playgroupMemberships)
      .set({
        role: input.role,
        updatedAt: new Date(),
      })
      .where(eq(playgroupMemberships.id, input.membershipId))
      .returning({
        id: playgroupMemberships.id,
      });

    if (!updated) {
      throw new Error("Expected membership role update to return a row.");
    }

    return {
      id: updated.id,
      displayName: target.displayName,
      role: input.role,
      joinedAt: target.joinedAt,
      canChangeRole: canManagePlaygroupMemberRole(viewerRole, input.role),
      canRemove: canManagePlaygroupMemberRole(viewerRole, input.role),
    };
  });
}

export async function removePlaygroupMemberForViewer(
  db: PlaygroupDatabase,
  input: {
    viewerUserId: string;
    membershipId: string;
  },
): Promise<{ playgroupId: string; membershipId: string }> {
  return runInTransaction(db, async (tx) => {
    const target = await getManageableMembershipById(tx, input.membershipId);

    if (!target) {
      throw new PlaygroupMemberManagementAuthorizationError();
    }

    const viewerRole = await getViewerPlaygroupRole(tx, {
      viewerUserId: input.viewerUserId,
      playgroupId: target.playgroupId,
    });

    if (!viewerRole || !canManagePlaygroupMemberRole(viewerRole, target.role)) {
      throw new PlaygroupMemberManagementAuthorizationError();
    }

    if (target.role === "owner") {
      await assertPlaygroupHasAnotherOwner(tx, {
        playgroupId: target.playgroupId,
        membershipId: target.id,
      });
    }

    await tx
      .delete(playgroupMemberships)
      .where(eq(playgroupMemberships.id, input.membershipId));

    return {
      playgroupId: target.playgroupId,
      membershipId: target.id,
    };
  });
}

async function createUniquePlaygroupSlug(
  db: PlaygroupReadDatabase,
  slugBase: string,
) {
  const existingRows = await db
    .select({
      slug: playgroups.slug,
    })
    .from(playgroups)
    .where(like(playgroups.slug, `${slugBase}%`));
  const existingSlugs = new Set(existingRows.map((row) => row.slug));

  if (!existingSlugs.has(slugBase)) {
    return slugBase;
  }

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${slugBase}-${suffix}`;

    if (!existingSlugs.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to create a unique playgroup slug.");
}

async function getManageableMembershipById(
  db: PlaygroupReadDatabase,
  membershipId: string,
) {
  const [membership] = await db
    .select({
      id: playgroupMemberships.id,
      playgroupId: playgroupMemberships.playgroupId,
      displayName: playgroupMemberships.displayName,
      role: playgroupMemberships.role,
      joinedAt: playgroupMemberships.joinedAt,
      userName: users.name,
    })
    .from(playgroupMemberships)
    .innerJoin(users, eq(playgroupMemberships.userId, users.id))
    .where(eq(playgroupMemberships.id, membershipId))
    .limit(1);

  if (!membership) {
    return null;
  }

  const role = asPlaygroupRole(membership.role);

  if (!isPlaygroupMemberDirectoryRole(role)) {
    return null;
  }

  return {
    id: membership.id,
    playgroupId: membership.playgroupId,
    displayName: membership.displayName ?? membership.userName,
    role,
    joinedAt: membership.joinedAt,
  };
}

async function assertPlaygroupHasAnotherOwner(
  db: PlaygroupReadDatabase,
  input: {
    playgroupId: string;
    membershipId: string;
  },
) {
  const [row] = await db
    .select({ total: count() })
    .from(playgroupMemberships)
    .where(
      and(
        eq(playgroupMemberships.playgroupId, input.playgroupId),
        eq(playgroupMemberships.role, "owner"),
        sql`${playgroupMemberships.id} <> ${input.membershipId}`,
      ),
    );

  if ((row?.total ?? 0) < 1) {
    throw new PlaygroupLastOwnerError();
  }
}

async function countMembersForPlaygroup(
  db: PlaygroupReadDatabase,
  playgroupId: string,
) {
  const [row] = await db
    .select({ total: count() })
    .from(playgroupMemberships)
    .where(
      and(
        eq(playgroupMemberships.playgroupId, playgroupId),
        inArray(playgroupMemberships.role, memberDirectoryRoles),
      ),
    );

  return row?.total ?? 0;
}

async function getViewerPlaygroupRole(
  db: PlaygroupReadDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
  },
): Promise<PlaygroupRole | null> {
  const [membership] = await db
    .select({
      role: playgroupMemberships.role,
    })
    .from(playgroupMemberships)
    .where(
      and(
        eq(playgroupMemberships.userId, input.viewerUserId),
        eq(playgroupMemberships.playgroupId, input.playgroupId),
      ),
    );

  return membership ? asPlaygroupRole(membership.role) : null;
}

async function assertCanManagePlaygroupInvites(
  db: PlaygroupReadDatabase,
  input: {
    viewerUserId: string;
    playgroupId: string;
  },
) {
  const role = await getViewerPlaygroupRole(db, input);

  if (!role || !canManagePlaygroup(role)) {
    throw new PlaygroupInviteAuthorizationError();
  }
}

async function countUpcomingEventsForPlaygroup(
  db: PlaygroupReadDatabase,
  input: {
    playgroupId: string;
    now: Date;
  },
) {
  const [row] = await db
    .select({ total: count() })
    .from(events)
    .where(
      and(
        eq(events.playgroupId, input.playgroupId),
        gt(events.startsAt, input.now),
      ),
    );

  return row?.total ?? 0;
}

function toViewerPlaygroupInvite(
  invite: {
    id: string;
    role: string;
    usedCount: number;
    maxUses: number | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  },
  now: Date,
): ViewerPlaygroupInvite {
  return {
    id: invite.id,
    role: asPlaygroupRole(invite.role),
    usedCount: invite.usedCount,
    maxUses: invite.maxUses,
    expiresAt: invite.expiresAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
    isActive:
      invite.revokedAt === null &&
      (invite.expiresAt === null || invite.expiresAt > now) &&
      (invite.maxUses === null || invite.usedCount < invite.maxUses),
  };
}

function normalizeOptionalDisplayName(value: string | null | undefined) {
  const displayName = value?.trim();

  return displayName ? displayName : null;
}

function comparePlaygroupMembers(
  left: ViewerPlaygroupMember,
  right: ViewerPlaygroupMember,
) {
  return (
    roleDirectorySortValue(left.role) - roleDirectorySortValue(right.role) ||
    left.displayName.localeCompare(right.displayName) ||
    left.id.localeCompare(right.id)
  );
}

function roleDirectorySortValue(role: ViewerPlaygroupMember["role"]) {
  switch (role) {
    case "owner":
      return 0;
    case "admin":
      return 1;
    case "host":
      return 2;
    case "member":
      return 3;
  }
}

function asPlaygroupRole(value: string): PlaygroupRole {
  switch (value) {
    case "owner":
    case "admin":
    case "member":
    case "host":
    case "guest":
    case "viewer":
      return value;
    default:
      return "viewer";
  }
}
