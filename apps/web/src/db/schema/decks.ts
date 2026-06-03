import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  text,
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
import { events } from "./events";
import { playgroups } from "./groups";
import { users } from "./identity";

export const decks = core.table(
  "decks",
  {
    id: uuidPrimaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    playgroupId: uuid("playgroup_id").references(() => playgroups.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    commanders: text("commanders").array().notNull(),
    colorIdentity: text("color_identity").notNull().default(""),
    bracket: text("bracket"),
    powerEstimate: integer("power_estimate"),
    archetype: text("archetype").notNull().default(""),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    visibility: text("visibility").notNull().default("private"),
    status: text("status").notNull().default("active"),
    externalUrl: text("external_url"),
    gameChangersCount: integer("game_changers_count").notNull().default(0),
    hasInfiniteCombo: boolean("has_infinite_combo").notNull().default(false),
    hasFastMana: boolean("has_fast_mana").notNull().default(false),
    tutorDensity: text("tutor_density").notNull().default("none"),
    hasExtraTurns: boolean("has_extra_turns").notNull().default(false),
    hasMassLandDenial: boolean("has_mass_land_denial").notNull().default(false),
    saltNotes: text("salt_notes").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("decks_owner_user_id_idx").on(table.ownerUserId),
    index("decks_playgroup_id_idx").on(table.playgroupId),
    index("decks_visibility_idx").on(table.visibility),
    index("decks_tags_gin_idx").using("gin", table.tags),
    nonblankTextCheck("decks_name_not_blank", table.name),
    check("decks_has_commander", sql`cardinality(${table.commanders}) > 0`),
    check(
      "decks_commanders_not_blank",
      sql`array_position(${table.commanders}, '') is null`,
    ),
    check(
      "decks_color_identity_check",
      sql`${table.colorIdentity} ~ '^[WUBRG]*$'`,
    ),
    check(
      "decks_bracket_check",
      sql`${table.bracket} is null or ${table.bracket} in ('1', '2', '3', '4', '5')`,
    ),
    check(
      "decks_power_estimate_check",
      sql`${table.powerEstimate} is null or ${table.powerEstimate} between 1 and 10`,
    ),
    check(
      "decks_visibility_check",
      sql`${table.visibility} in ('private', 'playgroup', 'public')`,
    ),
    check("decks_status_check", sql`${table.status} in ('active', 'retired')`),
    nonnegativeIntegerCheck(
      "decks_game_changers_count_nonnegative",
      table.gameChangersCount,
    ),
    check(
      "decks_tutor_density_check",
      sql`${table.tutorDensity} in ('none', 'low', 'medium', 'high')`,
    ),
    check(
      "decks_playgroup_visibility_scope",
      sql`${table.visibility} <> 'playgroup' or ${table.playgroupId} is not null`,
    ),
  ],
);

export const eventDeckDeclarations = core.table(
  "event_deck_declarations",
  {
    id: uuidPrimaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    preference: integer("preference").notNull().default(1),
    commanderSnapshot: text("commander_snapshot").array().notNull(),
    deckNameSnapshot: text("deck_name_snapshot").notNull(),
    colorIdentitySnapshot: text("color_identity_snapshot")
      .notNull()
      .default(""),
    bracketSnapshot: text("bracket_snapshot"),
    testingNotes: text("testing_notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("event_deck_declarations_event_user_deck_key").on(
      table.eventId,
      table.userId,
      table.deckId,
    ),
    index("event_deck_declarations_event_id_idx").on(table.eventId),
    index("event_deck_declarations_user_id_idx").on(table.userId),
    check(
      "event_deck_declarations_preference_check",
      sql`${table.preference} between 1 and 5`,
    ),
    check(
      "event_deck_declarations_has_commander_snapshot",
      sql`cardinality(${table.commanderSnapshot}) > 0`,
    ),
    nonblankTextCheck(
      "event_deck_declarations_deck_name_snapshot_not_blank",
      table.deckNameSnapshot,
    ),
    check(
      "event_deck_declarations_color_identity_snapshot_check",
      sql`${table.colorIdentitySnapshot} ~ '^[WUBRG]*$'`,
    ),
  ],
);
