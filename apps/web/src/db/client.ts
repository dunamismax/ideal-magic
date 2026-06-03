import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

export function getDatabaseUrl() {
  const databaseUrl = process.env.POD_TRACKER_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("POD_TRACKER_DATABASE_URL is required for database access");
  }

  return databaseUrl;
}

export function createDatabase(databaseUrl = getDatabaseUrl()) {
  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

  return drizzle(client, { schema });
}
