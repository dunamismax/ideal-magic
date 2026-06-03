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
  positiveIntegerCheck,
  updatedAt,
  uuidPrimaryKey,
} from "./common";
import { decks, eventDeckDeclarations } from "./decks";
import { events, eventRsvps } from "./events";
import { users } from "./identity";

export const pods = core.table(
  "pods",
  {
    id: uuidPrimaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    state: text("state").notNull().default("proposed"),
    position: integer("position").notNull(),
    sizeFitScore: integer("size_fit_score").notNull().default(0),
    bracketCompatibilityScore: integer("bracket_compatibility_score")
      .notNull()
      .default(0),
    repeatPlayerPairPenalty: integer("repeat_player_pair_penalty")
      .notNull()
      .default(0),
    repeatDeckMatchupPenalty: integer("repeat_deck_matchup_penalty")
      .notNull()
      .default(0),
    guestPlacementScore: integer("guest_placement_score").notNull().default(0),
    availabilityWindowScore: integer("availability_window_score")
      .notNull()
      .default(0),
    totalScore: integer("total_score").notNull().default(0),
    scoringDetails: jsonb("scoring_details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("pods_event_position_key").on(table.eventId, table.position),
    index("pods_event_id_idx").on(table.eventId),
    index("pods_state_idx").on(table.state),
    nonblankTextCheck("pods_name_not_blank", table.name),
    positiveIntegerCheck("pods_position_positive", table.position),
    check(
      "pods_state_check",
      sql`${table.state} in ('proposed', 'locked', 'active', 'completed', 'cancelled')`,
    ),
  ],
);

export const podSeats = core.table(
  "pod_seats",
  {
    id: uuidPrimaryKey(),
    podId: uuid("pod_id")
      .notNull()
      .references(() => pods.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    rsvpId: uuid("rsvp_id")
      .notNull()
      .references(() => eventRsvps.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    guestName: text("guest_name"),
    deckDeclarationId: uuid("deck_declaration_id").references(
      () => eventDeckDeclarations.id,
      { onDelete: "set null" },
    ),
    deckId: uuid("deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    seatPosition: integer("seat_position").notNull(),
    locked: boolean("locked").notNull().default(false),
    arrivalTime: timestamp("arrival_time", { withTimezone: true }),
    leavingTime: timestamp("leaving_time", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("pod_seats_pod_position_key").on(
      table.podId,
      table.seatPosition,
    ),
    uniqueIndex("pod_seats_event_rsvp_key").on(table.eventId, table.rsvpId),
    index("pod_seats_event_id_idx").on(table.eventId),
    index("pod_seats_user_id_idx")
      .on(table.userId)
      .where(sql`${table.userId} is not null`),
    index("pod_seats_deck_id_idx")
      .on(table.deckId)
      .where(sql`${table.deckId} is not null`),
    positiveIntegerCheck("pod_seats_position_positive", table.seatPosition),
    check(
      "pod_seats_user_or_guest_name",
      sql`(${table.userId} is not null and ${table.guestName} is null) or (${table.userId} is null and ${table.guestName} is not null and length(btrim(${table.guestName})) > 0)`,
    ),
  ],
);
