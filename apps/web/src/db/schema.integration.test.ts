import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

const migrationUrl = new URL(
  "./migrations/0000_flaky_domino.sql",
  import.meta.url,
);

async function migratedDatabase() {
  const db = new PGlite();
  const migration = (await readFile(migrationUrl, "utf8")).replaceAll(
    "--> statement-breakpoint",
    "",
  );

  await db.exec(migration);

  return db;
}

async function seedPlanningRows(db: PGlite) {
  await db.exec(`
    insert into core.users (id, email, name)
    values ('00000000-0000-4000-8000-000000000001', 'stephen@example.test', 'Stephen');

    insert into core.playgroups (id, name, slug, created_by_user_id)
    values (
      '00000000-0000-4000-8000-000000000011',
      'Thursday Commander',
      'thursday-commander',
      '00000000-0000-4000-8000-000000000001'
    );

    insert into core.events (
      id,
      playgroup_id,
      title,
      starts_at,
      visibility,
      created_by_user_id
    )
    values (
      '00000000-0000-4000-8000-000000000021',
      '00000000-0000-4000-8000-000000000011',
      'Commander Night',
      '2026-06-12 19:00:00+00',
      'members',
      '00000000-0000-4000-8000-000000000001'
    );
  `);
}

test("initial Drizzle migration creates the rewrite schemas and tables", async () => {
  const db = await migratedDatabase();

  const tables = await db.query<{ table_schema: string; table_name: string }>(`
    select table_schema, table_name
    from information_schema.tables
    where table_schema in ('core', 'meta')
    order by table_schema, table_name
  `);

  expect(tables.rows).toEqual(
    expect.arrayContaining([
      { table_schema: "core", table_name: "events" },
      { table_schema: "core", table_name: "life_counter_actions" },
      { table_schema: "core", table_name: "life_counter_sessions" },
      { table_schema: "core", table_name: "pods" },
      { table_schema: "meta", table_name: "matchup_history" },
    ]),
  );
  expect(tables.rows).toHaveLength(28);

  const indexes = await db.query<{ indexname: string }>(`
    select indexname
    from pg_indexes
    where schemaname in ('core', 'meta')
  `);

  expect(indexes.rows).toEqual(
    expect.arrayContaining([
      { indexname: "events_starts_at_idx" },
      { indexname: "life_counter_actions_session_sequence_key" },
      { indexname: "pod_seats_pod_position_key" },
    ]),
  );
});

test("planning constraints reject malformed sensitive or scoped rows", async () => {
  const db = await migratedDatabase();
  await seedPlanningRows(db);

  await expect(
    db.exec(`
      insert into core.users (email, name)
      values ('NotLower@example.test', 'Case Leak');
    `),
  ).rejects.toThrow(/users_email_lowercase/);

  await expect(
    db.exec(`
      insert into core.events (playgroup_id, title, starts_at, visibility)
      values (
        '00000000-0000-4000-8000-000000000011',
        'Bad Event',
        '2026-06-12 19:00:00+00',
        'world_readable'
      );
    `),
  ).rejects.toThrow(/events_visibility_check/);

  await expect(
    db.exec(`
      insert into core.event_rsvps (event_id, status)
      values ('00000000-0000-4000-8000-000000000021', 'yes');
    `),
  ).rejects.toThrow(/event_rsvps_user_or_guest_name/);
});

test("life counter persistence enforces link scope and action-log invariants", async () => {
  const db = await migratedDatabase();
  await seedPlanningRows(db);

  await db.exec(`
    insert into core.life_counter_sessions (
      id,
      local_session_key,
      mode,
      save_state
    )
    values (
      '00000000-0000-4000-8000-000000000031',
      'standalone:local',
      'standalone',
      'local_only'
    );

    insert into core.life_counter_players (
      id,
      session_id,
      seat_position,
      display_name,
      color
    )
    values (
      '00000000-0000-4000-8000-000000000041',
      '00000000-0000-4000-8000-000000000031',
      1,
      'Stephen',
      'amber'
    );

    insert into core.life_counter_commanders (
      id,
      player_id,
      name,
      source_order
    )
    values (
      '00000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000041',
      'Atraxa, Praetors Voice',
      1
    );
  `);

  await expect(
    db.exec(`
      insert into core.life_counter_sessions (
        local_session_key,
        mode,
        event_id
      )
      values (
        'standalone:linked-by-mistake',
        'standalone',
        '00000000-0000-4000-8000-000000000021'
      );
    `),
  ).rejects.toThrow(/life_counter_sessions_link_scope_check/);

  await expect(
    db.exec(`
      insert into core.life_counter_actions (
        session_id,
        sequence,
        action_type
      )
      values (
        '00000000-0000-4000-8000-000000000031',
        0,
        'life.adjust'
      );
    `),
  ).rejects.toThrow(/life_counter_actions_sequence_positive/);

  await expect(
    db.exec(`
      insert into core.life_counter_commander_damage (
        session_id,
        defending_player_id,
        source_commander_id,
        damage
      )
      values (
        '00000000-0000-4000-8000-000000000031',
        '00000000-0000-4000-8000-000000000041',
        '00000000-0000-4000-8000-000000000051',
        -1
      );
    `),
  ).rejects.toThrow(/life_counter_commander_damage_nonnegative/);

  await db.exec(`
    insert into core.life_counter_actions (
      session_id,
      sequence,
      action_type
    )
    values (
      '00000000-0000-4000-8000-000000000031',
      1,
      'life.adjust'
    );

    delete from core.life_counter_sessions
    where id = '00000000-0000-4000-8000-000000000031';
  `);

  const remainingLifeRows = await db.query<{ row_count: string }>(`
    select (
      (select count(*) from core.life_counter_players) +
      (select count(*) from core.life_counter_commanders) +
      (select count(*) from core.life_counter_actions)
    )::text as row_count
  `);

  expect(remainingLifeRows.rows[0]?.row_count).toBe("0");
});
