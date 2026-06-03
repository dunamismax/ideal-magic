import { sql } from "drizzle-orm";
import {
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { core, createdAt, updatedAt, uuidPrimaryKey } from "./common";

export const users = core.table(
  "users",
  {
    id: uuidPrimaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    image: text("image"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_key").on(table.email),
    check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
    check(
      "users_email_shape",
      sql`${table.email} ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`,
    ),
    check("users_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const accounts = core.table(
  "accounts",
  {
    id: uuidPrimaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    passwordHash: text("password_hash"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_key").on(
      table.providerId,
      table.accountId,
    ),
    index("accounts_user_id_idx").on(table.userId),
    check(
      "accounts_provider_id_not_blank",
      sql`length(btrim(${table.providerId})) > 0`,
    ),
    check(
      "accounts_account_id_not_blank",
      sql`length(btrim(${table.accountId})) > 0`,
    ),
    check(
      "accounts_password_hash_not_blank",
      sql`${table.passwordHash} is null or length(btrim(${table.passwordHash})) > 0`,
    ),
  ],
);

export const sessions = core.table(
  "sessions",
  {
    id: uuidPrimaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_key").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_active_idx")
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
    check(
      "sessions_token_hash_not_blank",
      sql`length(btrim(${table.tokenHash})) > 0`,
    ),
    check(
      "sessions_expire_after_create",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const verifications = core.table(
  "verifications",
  {
    id: uuidPrimaryKey(),
    identifier: text("identifier").notNull(),
    tokenHash: text("token_hash").notNull(),
    kind: text("kind").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("verifications_token_hash_key").on(table.tokenHash),
    index("verifications_identifier_idx").on(table.identifier),
    check(
      "verifications_kind_check",
      sql`${table.kind} in ('email_verification', 'password_reset', 'magic_link')`,
    ),
    check(
      "verifications_identifier_not_blank",
      sql`length(btrim(${table.identifier})) > 0`,
    ),
    check(
      "verifications_token_hash_not_blank",
      sql`length(btrim(${table.tokenHash})) > 0`,
    ),
    check(
      "verifications_expire_after_create",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);
