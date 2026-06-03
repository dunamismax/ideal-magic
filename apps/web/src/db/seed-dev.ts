import { createDatabaseConnection } from "./client";
import { seedDevelopmentData } from "./seed";

async function main() {
  const connection = createDatabaseConnection();

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
