import { sql } from "drizzle-orm";
import { check, index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { core, uuidPrimaryKey } from "./common";
import { events } from "./events";
import { playgroups } from "./groups";
import { users } from "./identity";

export const auditEvents = core.table(
  "audit_events",
  {
    id: uuidPrimaryKey(),
    action: text("action").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    playgroupId: uuid("playgroup_id").references(() => playgroups.id, {
      onDelete: "cascade",
    }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_actor_user_id_idx").on(table.actorUserId),
    index("audit_events_event_id_idx").on(table.eventId),
    index("audit_events_playgroup_created_at_idx").on(
      table.playgroupId,
      table.createdAt,
    ),
    index("audit_events_action_created_at_idx").on(
      table.action,
      table.createdAt,
    ),
    check(
      "audit_events_action_shape",
      sql`${table.action} ~ '^[a-z0-9_]+(\\.[a-z0-9_]+)*$'`,
    ),
    check(
      "audit_events_target_type_shape",
      sql`${table.targetType} ~ '^[a-z0-9_]+$'`,
    ),
    check(
      "audit_events_metadata_object",
      sql`jsonb_typeof(${table.metadata}) = 'object'`,
    ),
  ],
);
