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
  meta,
  nonblankTextCheck,
  positiveIntegerCheck,
  updatedAt,
  uuidPrimaryKey,
} from "./common";
import { decks } from "./decks";
import { events } from "./events";
import { playgroups } from "./groups";
import { users } from "./identity";
import { podSeats, pods } from "./pods";

export const games = core.table(
  "games",
  {
    id: uuidPrimaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    podId: uuid("pod_id").references(() => pods.id, { onDelete: "set null" }),
    loggedByUserId: uuid("logged_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resultType: text("result_type").notNull(),
    turnCount: integer("turn_count"),
    durationMinutes: integer("duration_minutes"),
    firstPlayerUserId: uuid("first_player_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    notes: text("notes").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("games_event_id_idx").on(table.eventId, table.completedAt),
    index("games_pod_id_idx")
      .on(table.podId)
      .where(sql`${table.podId} is not null`),
    index("games_result_type_idx").on(table.resultType),
    index("games_tags_gin_idx").using("gin", table.tags),
    check(
      "games_result_type_check",
      sql`${table.resultType} in ('normal_win', 'combo_win', 'combat_win', 'concession', 'draw', 'time_called', 'unfinished', 'archenemy_win', 'team_win')`,
    ),
    check(
      "games_turn_count_positive",
      sql`${table.turnCount} is null or ${table.turnCount} > 0`,
    ),
    check(
      "games_duration_minutes_positive",
      sql`${table.durationMinutes} is null or ${table.durationMinutes} > 0`,
    ),
  ],
);

export const gamePlayers = core.table(
  "game_players",
  {
    id: uuidPrimaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    podSeatId: uuid("pod_seat_id").references(() => podSeats.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    guestName: text("guest_name"),
    deckId: uuid("deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    participantNameSnapshot: text("participant_name_snapshot")
      .notNull()
      .default(""),
    deckNameSnapshot: text("deck_name_snapshot").notNull().default(""),
    commanderSnapshot: text("commander_snapshot")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    colorIdentitySnapshot: text("color_identity_snapshot")
      .notNull()
      .default(""),
    bracketSnapshot: text("bracket_snapshot"),
    powerEstimateSnapshot: integer("power_estimate_snapshot"),
    archetypeSnapshot: text("archetype_snapshot").notNull().default(""),
    seatPosition: integer("seat_position").notNull(),
    finishPosition: integer("finish_position"),
    eliminationOrder: integer("elimination_order"),
    eliminatedTurn: integer("eliminated_turn"),
    isWinner: boolean("is_winner").notNull().default(false),
    team: text("team"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("game_players_game_seat_key").on(
      table.gameId,
      table.seatPosition,
    ),
    index("game_players_user_id_idx")
      .on(table.userId)
      .where(sql`${table.userId} is not null`),
    index("game_players_deck_id_idx")
      .on(table.deckId)
      .where(sql`${table.deckId} is not null`),
    positiveIntegerCheck(
      "game_players_seat_position_positive",
      table.seatPosition,
    ),
    check(
      "game_players_finish_position_positive",
      sql`${table.finishPosition} is null or ${table.finishPosition} > 0`,
    ),
    check(
      "game_players_elimination_order_positive",
      sql`${table.eliminationOrder} is null or ${table.eliminationOrder} > 0`,
    ),
    check(
      "game_players_eliminated_turn_positive",
      sql`${table.eliminatedTurn} is null or ${table.eliminatedTurn} > 0`,
    ),
    check(
      "game_players_user_or_guest_name",
      sql`(${table.userId} is not null and ${table.guestName} is null) or (${table.userId} is null and ${table.guestName} is not null and length(btrim(${table.guestName})) > 0)`,
    ),
    check(
      "game_players_color_identity_snapshot_check",
      sql`${table.colorIdentitySnapshot} ~ '^[WUBRG]*$'`,
    ),
    check(
      "game_players_bracket_snapshot_check",
      sql`${table.bracketSnapshot} is null or ${table.bracketSnapshot} in ('1', '2', '3', '4', '5')`,
    ),
    check(
      "game_players_power_estimate_snapshot_check",
      sql`${table.powerEstimateSnapshot} is null or ${table.powerEstimateSnapshot} between 1 and 10`,
    ),
  ],
);

export const gameResults = core.table(
  "game_results",
  {
    id: uuidPrimaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    resultType: text("result_type").notNull(),
    winnerUserId: uuid("winner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    winningDeckId: uuid("winning_deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    winningTeam: text("winning_team"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("game_results_game_id_key").on(table.gameId),
    index("game_results_winner_user_id_idx")
      .on(table.winnerUserId)
      .where(sql`${table.winnerUserId} is not null`),
    index("game_results_winning_deck_id_idx")
      .on(table.winningDeckId)
      .where(sql`${table.winningDeckId} is not null`),
    check(
      "game_results_result_type_check",
      sql`${table.resultType} in ('normal_win', 'combo_win', 'combat_win', 'concession', 'draw', 'time_called', 'unfinished', 'archenemy_win', 'team_win')`,
    ),
  ],
);

export const gameNotes = core.table(
  "game_notes",
  {
    id: uuidPrimaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    noteText: text("note_text").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("game_notes_game_id_idx").on(table.gameId, table.createdAt),
    nonblankTextCheck("game_notes_text_not_blank", table.noteText),
  ],
);

export const matchupHistory = meta.table(
  "matchup_history",
  {
    id: uuidPrimaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    playgroupId: uuid("playgroup_id")
      .notNull()
      .references(() => playgroups.id, { onDelete: "cascade" }),
    leftUserId: uuid("left_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    rightUserId: uuid("right_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    leftDeckId: uuid("left_deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    rightDeckId: uuid("right_deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("matchup_history_game_user_pair_key")
      .on(table.gameId, table.leftUserId, table.rightUserId)
      .where(
        sql`${table.leftUserId} is not null and ${table.rightUserId} is not null`,
      ),
    uniqueIndex("matchup_history_game_deck_pair_key")
      .on(table.gameId, table.leftDeckId, table.rightDeckId)
      .where(
        sql`${table.leftDeckId} is not null and ${table.rightDeckId} is not null`,
      ),
    index("matchup_history_playgroup_event_idx").on(
      table.playgroupId,
      table.eventId,
    ),
    check(
      "matchup_history_has_pair",
      sql`(${table.leftUserId} is not null and ${table.rightUserId} is not null) or (${table.leftDeckId} is not null and ${table.rightDeckId} is not null)`,
    ),
  ],
);
