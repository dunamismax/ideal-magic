import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.POD_TRACKER_MIGRATION_DATABASE_URL ??
  process.env.POD_TRACKER_DATABASE_URL ??
  "postgres://pod_tracker:pod_tracker@localhost:5432/pod_tracker?sslmode=disable";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "core",
  },
  strict: true,
  verbose: true,
});
