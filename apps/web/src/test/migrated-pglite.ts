import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readdir, readFile } from "node:fs/promises";

import * as schema from "@/db/schema";

const migrationsUrl = new URL("../db/migrations/", import.meta.url);

export async function createMigratedPgliteDatabase() {
  const client = new PGlite();
  const migrationFiles = (await readdir(migrationsUrl))
    .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
    .sort();

  for (const fileName of migrationFiles) {
    const migration = (
      await readFile(new URL(fileName, migrationsUrl), "utf8")
    ).replaceAll("--> statement-breakpoint", "");

    await client.exec(migration);
  }

  return {
    client,
    db: drizzle(client, { schema }),
  };
}
