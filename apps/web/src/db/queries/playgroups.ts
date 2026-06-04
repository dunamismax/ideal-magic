import { and, asc, count, eq, gt, inArray, like } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import { events, playgroupMemberships, playgroups, users } from "../schema";
import {
  canViewPlaygroupMembers,
  isPlaygroupMemberDirectoryRole,
  type PlaygroupRole,
} from "../scopes";

type PlaygroupDatabase = Pick<AppDatabase, "select" | "insert" | "transaction">;
type PlaygroupReadDatabase = Pick<AppDatabase, "select">;

const memberDirectoryRoles = ["owner", "admin", "host", "member"] as const;

export type ViewerPlaygroupListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  role: PlaygroupRole;
  memberCount: number;
  members: ViewerPlaygroupMember[];
  upcomingEventCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ViewerPlaygroupMember = {
  id: string;
  displayName: string;
  role: "owner" | "admin" | "host" | "member";
  joinedAt: Date;
};

export type CreatedPlaygroup = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

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
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      role: asPlaygroupRole(row.role),
      memberCount: await countMembersForPlaygroup(db, row.id),
      members: await listVisiblePlaygroupMembersForViewer(db, {
        viewerUserId: input.viewerUserId,
        playgroupId: row.id,
      }),
      upcomingEventCount: await countUpcomingEventsForPlaygroup(db, {
        playgroupId: row.id,
        now: input.now ?? new Date(),
      }),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
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
