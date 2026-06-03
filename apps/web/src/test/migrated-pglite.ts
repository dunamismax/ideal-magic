import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";

import * as schema from "@/db/schema";

const migrationUrl = new URL(
  "../db/migrations/0000_flaky_domino.sql",
  import.meta.url,
);

export async function createMigratedPgliteDatabase() {
  const client = new PGlite();
  const migration = (await readFile(migrationUrl, "utf8")).replaceAll(
    "--> statement-breakpoint",
    "",
  );

  await client.exec(migration);

  return {
    client,
    db: drizzle(client, { schema }),
  };
}
