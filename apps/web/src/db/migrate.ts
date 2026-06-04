import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

type Migration = {
  hash: string;
  journalIndex: number;
  path: string;
  statements: string[];
  tag: string;
  when: number;
};

type AppliedMigration = {
  created_at: string;
  hash: string;
};

const defaultDatabaseUrl =
  "postgres://pod_tracker:pod_tracker@localhost:55432/pod_tracker?sslmode=disable";
const currentModulePath = import.meta.url.startsWith("file:")
  ? fileURLToPath(import.meta.url)
  : undefined;

export function getMigrationDatabaseUrl() {
  return (
    process.env.POD_TRACKER_MIGRATION_DATABASE_URL ??
    process.env.POD_TRACKER_DATABASE_URL ??
    defaultDatabaseUrl
  );
}

export function splitMigrationStatements(sql: string) {
  return sql
    .split(/(?:^|\n)\s*-->\s*statement-breakpoint\s*(?:\n|$)/u)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function migrationHash(sql: string) {
  return createHash("sha256").update(sql).digest("hex");
}

export async function readMigrations(
  dir = getDefaultMigrationsDir(),
): Promise<Migration[]> {
  const journal = await readMigrationJournal(dir);
  const files = new Set(await readdir(dir));

  return Promise.all(
    journal
      .sort((left, right) => left.idx - right.idx)
      .map(async (entry) => {
        const fileName = `${entry.tag}.sql`;

        if (!files.has(fileName)) {
          throw new Error(
            `Missing migration file for journal tag ${entry.tag}`,
          );
        }

        const migrationPath = path.join(dir, fileName);
        const sql = await readFile(migrationPath, "utf8");

        return {
          hash: migrationHash(sql),
          journalIndex: entry.idx,
          path: migrationPath,
          statements: splitMigrationStatements(sql),
          tag: entry.tag,
          when: entry.when,
        };
      }),
  );
}

export async function runMigrations(databaseUrl = getMigrationDatabaseUrl()) {
  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const migrations = await readMigrations();

    await ensureMigrationTable(client);

    const appliedRows = await client<AppliedMigration[]>`
      select hash, created_at::text
      from drizzle.__drizzle_migrations
      order by created_at asc
    `;
    const applied = new Map(
      appliedRows.map((row) => [Number(row.created_at), row.hash]),
    );

    for (const migration of migrations) {
      const appliedHash = applied.get(migration.when);

      if (appliedHash === migration.hash) {
        console.log(`Migration ${migration.tag} already applied`);
        continue;
      }

      if (appliedHash) {
        throw new Error(
          `Migration ${migration.tag} has changed since it was applied`,
        );
      }

      await client.begin(async (tx) => {
        for (const statement of migration.statements) {
          try {
            await tx.unsafe(statement);
          } catch (error) {
            const preview = statement.replace(/\s+/gu, " ").slice(0, 160);
            throw new Error(
              `Failed applying ${migration.tag} statement: ${preview}`,
              { cause: error },
            );
          }
        }

        await tx`
          insert into drizzle.__drizzle_migrations (hash, created_at)
          values (${migration.hash}, ${migration.when})
        `;
      });

      console.log(`Applied migration ${migration.tag}`);
    }
  } finally {
    await client.end();
  }
}

async function ensureMigrationTable(client: ReturnType<typeof postgres>) {
  await client`create schema if not exists drizzle`;
  await client`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at numeric not null unique
    )
  `;
}

async function readMigrationJournal(dir: string) {
  const journalPath = path.join(dir, "meta", "_journal.json");
  const raw = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries?: unknown;
  };

  if (!Array.isArray(raw.entries)) {
    throw new Error("Drizzle migration journal is missing entries");
  }

  return raw.entries.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("idx" in entry) ||
      !("when" in entry) ||
      !("tag" in entry) ||
      typeof entry.idx !== "number" ||
      typeof entry.when !== "number" ||
      typeof entry.tag !== "string"
    ) {
      throw new Error("Drizzle migration journal contains an invalid entry");
    }

    return {
      idx: entry.idx,
      when: entry.when,
      tag: entry.tag,
    } satisfies JournalEntry;
  });
}

function getDefaultMigrationsDir() {
  if (!import.meta.url.startsWith("file:")) {
    throw new Error(
      "Migration directory must be provided outside file modules",
    );
  }

  return fileURLToPath(new URL("./migrations", import.meta.url));
}

if (process.argv[1] === currentModulePath) {
  runMigrations().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
