import { and, asc, count, eq, gt, like } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import { events, playgroupMemberships, playgroups } from "../schema";
import type { PlaygroupRole } from "../scopes";

type PlaygroupDatabase = Pick<AppDatabase, "select" | "insert" | "transaction">;
type PlaygroupReadDatabase = Pick<AppDatabase, "select">;

export type ViewerPlaygroupListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  role: PlaygroupRole;
  memberCount: number;
  upcomingEventCount: number;
  createdAt: Date;
  updatedAt: Date;
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
      upcomingEventCount: await countUpcomingEventsForPlaygroup(db, {
        playgroupId: row.id,
        now: input.now ?? new Date(),
      }),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  );
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
    .where(eq(playgroupMemberships.playgroupId, playgroupId));

  return row?.total ?? 0;
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
