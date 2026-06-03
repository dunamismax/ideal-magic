import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
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
  positiveIntegerCheck,
  updatedAt,
  uuidPrimaryKey,
} from "./common";
import { decks } from "./decks";
import { events } from "./events";
import { users } from "./identity";
import { pods } from "./pods";

export const lifeCounterSessions = core.table(
  "life_counter_sessions",
  {
    id: uuidPrimaryKey(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
    }),
    podId: uuid("pod_id").references(() => pods.id, {
      onDelete: "set null",
    }),
    localSessionKey: text("local_session_key").notNull(),
    mode: text("mode").notNull(),
    saveState: text("save_state").notNull().default("local_only"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    lastActionSequence: integer("last_action_sequence").notNull().default(0),
    rawState: jsonb("raw_state")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("life_counter_sessions_local_session_key_key").on(
      table.localSessionKey,
    ),
    index("life_counter_sessions_owner_user_id_idx")
      .on(table.ownerUserId)
      .where(sql`${table.ownerUserId} is not null`),
    index("life_counter_sessions_event_id_idx")
      .on(table.eventId)
      .where(sql`${table.eventId} is not null`),
    index("life_counter_sessions_pod_id_idx")
      .on(table.podId)
      .where(sql`${table.podId} is not null`),
    nonblankTextCheck(
      "life_counter_sessions_local_session_key_not_blank",
      table.localSessionKey,
    ),
    check(
      "life_counter_sessions_mode_check",
      sql`${table.mode} in ('standalone', 'event', 'pod')`,
    ),
    check(
      "life_counter_sessions_save_state_check",
      sql`${table.saveState} in ('local_only', 'saved_to_group', 'sync_pending', 'conflicted')`,
    ),
    nonnegativeIntegerCheck(
      "life_counter_sessions_last_action_sequence_nonnegative",
      table.lastActionSequence,
    ),
    check(
      "life_counter_sessions_link_scope_check",
      sql`(${table.mode} = 'standalone' and ${table.eventId} is null and ${table.podId} is null) or (${table.mode} = 'event' and ${table.eventId} is not null and ${table.podId} is null) or (${table.mode} = 'pod' and ${table.eventId} is not null and ${table.podId} is not null)`,
    ),
  ],
);

export const lifeCounterPlayers = core.table(
  "life_counter_players",
  {
    id: uuidPrimaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => lifeCounterSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    deckId: uuid("deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    seatPosition: integer("seat_position").notNull(),
    displayName: text("display_name").notNull(),
    color: text("color").notNull(),
    startingLife: integer("starting_life").notNull().default(40),
    currentLife: integer("current_life").notNull().default(40),
    poison: integer("poison").notNull().default(0),
    isEliminated: boolean("is_eliminated").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("life_counter_players_session_seat_key").on(
      table.sessionId,
      table.seatPosition,
    ),
    index("life_counter_players_session_id_idx").on(table.sessionId),
    positiveIntegerCheck(
      "life_counter_players_seat_position_positive",
      table.seatPosition,
    ),
    nonblankTextCheck(
      "life_counter_players_display_name_not_blank",
      table.displayName,
    ),
    nonblankTextCheck("life_counter_players_color_not_blank", table.color),
    positiveIntegerCheck(
      "life_counter_players_starting_life_positive",
      table.startingLife,
    ),
    nonnegativeIntegerCheck(
      "life_counter_players_poison_nonnegative",
      table.poison,
    ),
  ],
);

export const lifeCounterCommanders = core.table(
  "life_counter_commanders",
  {
    id: uuidPrimaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => lifeCounterPlayers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceOrder: integer("source_order").notNull().default(1),
    castCount: integer("cast_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("life_counter_commanders_player_order_key").on(
      table.playerId,
      table.sourceOrder,
    ),
    index("life_counter_commanders_player_id_idx").on(table.playerId),
    nonblankTextCheck("life_counter_commanders_name_not_blank", table.name),
    positiveIntegerCheck(
      "life_counter_commanders_source_order_positive",
      table.sourceOrder,
    ),
    nonnegativeIntegerCheck(
      "life_counter_commanders_cast_count_nonnegative",
      table.castCount,
    ),
  ],
);

export const lifeCounterCommanderDamage = core.table(
  "life_counter_commander_damage",
  {
    id: uuidPrimaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => lifeCounterSessions.id, { onDelete: "cascade" }),
    defendingPlayerId: uuid("defending_player_id")
      .notNull()
      .references(() => lifeCounterPlayers.id, { onDelete: "cascade" }),
    sourceCommanderId: uuid("source_commander_id")
      .notNull()
      .references(() => lifeCounterCommanders.id, { onDelete: "cascade" }),
    damage: integer("damage").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("life_counter_commander_damage_source_defender_key").on(
      table.sessionId,
      table.defendingPlayerId,
      table.sourceCommanderId,
    ),
    nonnegativeIntegerCheck(
      "life_counter_commander_damage_nonnegative",
      table.damage,
    ),
  ],
);

export const lifeCounterActions = core.table(
  "life_counter_actions",
  {
    id: uuidPrimaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => lifeCounterSessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    actionType: text("action_type").notNull(),
    actorPlayerId: uuid("actor_player_id").references(
      () => lifeCounterPlayers.id,
      { onDelete: "set null" },
    ),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    localCreatedAt: timestamp("local_created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("life_counter_actions_session_sequence_key").on(
      table.sessionId,
      table.sequence,
    ),
    index("life_counter_actions_session_id_idx").on(table.sessionId),
    positiveIntegerCheck(
      "life_counter_actions_sequence_positive",
      table.sequence,
    ),
    nonblankTextCheck(
      "life_counter_actions_action_type_not_blank",
      table.actionType,
    ),
  ],
);

export const lifeCounterSnapshots = core.table(
  "life_counter_snapshots",
  {
    id: uuidPrimaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => lifeCounterSessions.id, { onDelete: "cascade" }),
    actionSequence: integer("action_sequence").notNull(),
    state: jsonb("state")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("life_counter_snapshots_session_sequence_key").on(
      table.sessionId,
      table.actionSequence,
    ),
    positiveIntegerCheck(
      "life_counter_snapshots_action_sequence_positive",
      table.actionSequence,
    ),
  ],
);
