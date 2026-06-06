import { sql } from "drizzle-orm";
import {
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
import { playgroups } from "./groups";
import { users } from "./identity";

export const eventLocations = core.table(
  "event_locations",
  {
    id: uuidPrimaryKey(),
    playgroupId: uuid("playgroup_id")
      .notNull()
      .references(() => playgroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    stateProvince: text("state_province"),
    postalCode: text("postal_code"),
    country: text("country"),
    notes: text("notes").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("event_locations_playgroup_id_idx").on(table.playgroupId),
    index("event_locations_playgroup_archived_idx").on(
      table.playgroupId,
      table.archivedAt,
    ),
    nonblankTextCheck("event_locations_name_not_blank", table.name),
  ],
);

export const events = core.table(
  "events",
  {
    id: uuidPrimaryKey(),
    playgroupId: uuid("playgroup_id")
      .notNull()
      .references(() => playgroups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: text("status").notNull().default("scheduled"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    locationId: uuid("location_id").references(() => eventLocations.id, {
      onDelete: "set null",
    }),
    visibility: text("visibility").notNull().default("members"),
    inviteTokenHash: text("invite_token_hash"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("events_invite_token_hash_key").on(table.inviteTokenHash),
    index("events_playgroup_id_idx").on(table.playgroupId),
    index("events_starts_at_idx").on(table.startsAt),
    nonblankTextCheck("events_title_not_blank", table.title),
    check(
      "events_visibility_check",
      sql`${table.visibility} in ('members', 'invite_only', 'public_safe')`,
    ),
    check(
      "events_status_check",
      sql`${table.status} in ('scheduled', 'cancelled', 'archived')`,
    ),
    check(
      "events_cancelled_at_matches_status",
      sql`(${table.status} = 'cancelled' and ${table.cancelledAt} is not null) or (${table.status} <> 'cancelled' and ${table.cancelledAt} is null)`,
    ),
    check(
      "events_archived_at_matches_status",
      sql`(${table.status} = 'archived' and ${table.archivedAt} is not null) or (${table.status} <> 'archived' and ${table.archivedAt} is null)`,
    ),
    check(
      "events_ends_after_start",
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
  ],
);

export const eventHosts = core.table(
  "event_hosts",
  {
    id: uuidPrimaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addressVisibility: text("address_visibility").notNull().default("rsvps"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("event_hosts_event_user_key").on(table.eventId, table.userId),
    check(
      "event_hosts_address_visibility_check",
      sql`${table.addressVisibility} in ('rsvps', 'members', 'public', 'hidden')`,
    ),
  ],
);

export const eventRsvps = core.table(
  "event_rsvps",
  {
    id: uuidPrimaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    guestName: text("guest_name"),
    guestEditTokenHash: text("guest_edit_token_hash"),
    status: text("status").notNull(),
    arrivalTime: timestamp("arrival_time", { withTimezone: true }),
    leavingTime: timestamp("leaving_time", { withTimezone: true }),
    guestCount: integer("guest_count").notNull().default(0),
    travelBufferMinutes: integer("travel_buffer_minutes"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("event_rsvps_event_user_key")
      .on(table.eventId, table.userId)
      .where(sql`${table.userId} is not null`),
    uniqueIndex("event_rsvps_guest_edit_token_hash_key")
      .on(table.guestEditTokenHash)
      .where(sql`${table.guestEditTokenHash} is not null`),
    index("event_rsvps_event_id_idx").on(table.eventId),
    check(
      "event_rsvps_status_check",
      sql`${table.status} in ('yes', 'maybe', 'no', 'waitlist')`,
    ),
    nonnegativeIntegerCheck(
      "event_rsvps_guest_count_nonnegative",
      table.guestCount,
    ),
    check(
      "event_rsvps_user_or_guest_name",
      sql`(${table.userId} is not null and ${table.guestName} is null) or (${table.userId} is null and ${table.guestName} is not null and length(btrim(${table.guestName})) > 0)`,
    ),
    check(
      "event_rsvps_leaving_after_arrival",
      sql`${table.leavingTime} is null or ${table.arrivalTime} is null or ${table.leavingTime} > ${table.arrivalTime}`,
    ),
  ],
);

export const eventGuests = core.table(
  "event_guests",
  {
    id: uuidPrimaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    rsvpId: uuid("rsvp_id")
      .notNull()
      .references(() => eventRsvps.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("event_guests_event_id_idx").on(table.eventId),
    nonblankTextCheck("event_guests_name_not_blank", table.name),
  ],
);
