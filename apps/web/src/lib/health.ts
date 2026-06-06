import { sql } from "drizzle-orm";

import { createDatabaseConnection } from "@/db/client";

export type HealthCheckStatus =
  | "ok"
  | "configured"
  | "missing_config"
  | "unavailable";

export type DependencyCheck = {
  ok: boolean;
  status: HealthCheckStatus;
};

export function getDatabaseConfigurationCheck(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): DependencyCheck {
  return env.POD_TRACKER_DATABASE_URL?.trim()
    ? { ok: true, status: "configured" }
    : { ok: false, status: "missing_config" };
}

export async function checkDatabaseReadiness(
  databaseUrl = process.env.POD_TRACKER_DATABASE_URL,
): Promise<DependencyCheck> {
  if (!databaseUrl?.trim()) {
    return { ok: false, status: "missing_config" };
  }

  let connection;

  try {
    connection = createDatabaseConnection(databaseUrl);
    await connection.db.execute(sql`select 1`);
    return { ok: true, status: "ok" };
  } catch {
    return { ok: false, status: "unavailable" };
  } finally {
    await connection?.close();
  }
}
