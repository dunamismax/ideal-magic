import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  core,
  createdAt,
  nonblankTextCheck,
  nonnegativeIntegerCheck,
  updatedAt,
  uuidPrimaryKey,
} from "./common";
import { users } from "./identity";

export const playgroups = core.table(
  "playgroups",
  {
    id: uuidPrimaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("playgroups_slug_key").on(table.slug),
    index("playgroups_archived_at_idx").on(table.archivedAt),
    nonblankTextCheck("playgroups_name_not_blank", table.name),
    check(
      "playgroups_slug_shape",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const playgroupMemberships = core.table(
  "playgroup_memberships",
  {
    id: uuidPrimaryKey(),
    playgroupId: uuid("playgroup_id")
      .notNull()
      .references(() => playgroups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    displayName: text("display_name"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("playgroup_memberships_user_key").on(
      table.playgroupId,
      table.userId,
    ),
    index("playgroup_memberships_user_id_idx").on(table.userId),
    check(
      "playgroup_memberships_role_check",
      sql`${table.role} in ('owner', 'admin', 'member', 'host', 'guest', 'viewer')`,
    ),
    check(
      "playgroup_memberships_display_name_not_blank",
      sql`${table.displayName} is null or length(btrim(${table.displayName})) > 0`,
    ),
  ],
);

export const playgroupInvites = core.table(
  "playgroup_invites",
  {
    id: uuidPrimaryKey(),
    playgroupId: uuid("playgroup_id")
      .notNull()
      .references(() => playgroups.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    role: text("role").notNull().default("member"),
    email: text("email"),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("playgroup_invites_token_hash_key").on(table.tokenHash),
    index("playgroup_invites_playgroup_id_idx").on(table.playgroupId),
    check(
      "playgroup_invites_token_hash_not_blank",
      sql`length(btrim(${table.tokenHash})) > 0`,
    ),
    check(
      "playgroup_invites_role_check",
      sql`${table.role} in ('owner', 'admin', 'member', 'host', 'guest', 'viewer')`,
    ),
    check(
      "playgroup_invites_email_lowercase",
      sql`${table.email} is null or ${table.email} = lower(${table.email})`,
    ),
    check(
      "playgroup_invites_max_uses_positive",
      sql`${table.maxUses} is null or ${table.maxUses} > 0`,
    ),
    nonnegativeIntegerCheck(
      "playgroup_invites_used_count_nonnegative",
      table.usedCount,
    ),
    check(
      "playgroup_invites_used_count_within_limit",
      sql`${table.maxUses} is null or ${table.usedCount} <= ${table.maxUses}`,
    ),
  ],
);

export const houseRules = core.table(
  "house_rules",
  {
    id: uuidPrimaryKey(),
    playgroupId: uuid("playgroup_id")
      .notNull()
      .references(() => playgroups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    visibleToGuests: boolean("visible_to_guests").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("house_rules_playgroup_id_idx").on(table.playgroupId),
    nonblankTextCheck("house_rules_title_not_blank", table.title),
    nonblankTextCheck("house_rules_body_not_blank", table.body),
  ],
);
