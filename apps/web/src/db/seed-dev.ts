import { createDatabaseConnection } from "./client";
import { getMigrationDatabaseUrl } from "./migrate";
import { seedDevelopmentData } from "./seed";

async function main() {
  const connection = createDatabaseConnection(getMigrationDatabaseUrl());

  try {
    await seedDevelopmentData(connection.db);
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
