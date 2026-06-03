import { sql, type SQLWrapper } from "drizzle-orm";
import { check, pgSchema, timestamp, uuid } from "drizzle-orm/pg-core";

export const core = pgSchema("core");
export const meta = pgSchema("meta");

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const uuidPrimaryKey = () => uuid("id").primaryKey().defaultRandom();

export const nonblankTextCheck = (name: string, column: SQLWrapper) =>
  check(name, sql`length(btrim(${column})) > 0`);

export const positiveIntegerCheck = (name: string, column: SQLWrapper) =>
  check(name, sql`${column} > 0`);

export const nonnegativeIntegerCheck = (name: string, column: SQLWrapper) =>
  check(name, sql`${column} >= 0`);
