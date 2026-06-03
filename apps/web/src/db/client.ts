import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import postgres from "postgres";

import * as schema from "./schema";

type DrizzleConnection = ReturnType<typeof createDrizzleConnection>;

export type AppDatabase<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
> = PgDatabase<TQueryResult, typeof schema>;
export type Database = DrizzleConnection["db"];
export type DatabaseConnection = {
  db: Database;
  close: () => Promise<void>;
};

export type DatabaseTransaction<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
> = Parameters<Parameters<AppDatabase<TQueryResult>["transaction"]>[0]>[0];

export function getDatabaseUrl() {
  const databaseUrl = process.env.POD_TRACKER_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("POD_TRACKER_DATABASE_URL is required for database access");
  }

  return databaseUrl;
}

export function createDatabase(databaseUrl = getDatabaseUrl()) {
  return createDrizzleConnection(databaseUrl).db;
}

export function createDatabaseConnection(
  databaseUrl = getDatabaseUrl(),
): DatabaseConnection {
  const connection = createDrizzleConnection(databaseUrl);

  return {
    db: connection.db,
    close: () => connection.client.end(),
  };
}

export function runInTransaction<TQueryResult extends PgQueryResultHKT, T>(
  db: Pick<AppDatabase<TQueryResult>, "transaction">,
  work: (tx: DatabaseTransaction<TQueryResult>) => Promise<T>,
) {
  return db.transaction(work);
}

function createDrizzleConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}
