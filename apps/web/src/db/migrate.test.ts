import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  migrationHash,
  readMigrations,
  splitMigrationStatements,
} from "./migrate";

describe("migration runner", () => {
  test("splits Drizzle statement breakpoints into executable statements", () => {
    expect(
      splitMigrationStatements(`
        create schema if not exists core;
        --> statement-breakpoint
        create table core.users (id uuid primary key);
      `),
    ).toEqual([
      "create schema if not exists core;",
      "create table core.users (id uuid primary key);",
    ]);
  });

  test("hashes migration SQL deterministically", () => {
    expect(migrationHash("select 1;")).toEqual(migrationHash("select 1;"));
    expect(migrationHash("select 1;")).not.toEqual(migrationHash("select 2;"));
  });

  test("loads journal entries in migration order", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pod-tracker-migrations-"));
    await mkdir(path.join(dir, "meta"));
    await writeFile(
      path.join(dir, "meta", "_journal.json"),
      JSON.stringify({
        entries: [
          { idx: 1, when: 20, tag: "0001_second" },
          { idx: 0, when: 10, tag: "0000_first" },
        ],
      }),
    );
    await writeFile(path.join(dir, "0000_first.sql"), "select 1;");
    await writeFile(path.join(dir, "0001_second.sql"), "select 2;");

    const migrations = await readMigrations(dir);

    expect(migrations.map((migration) => migration.tag)).toEqual([
      "0000_first",
      "0001_second",
    ]);
  });
});
