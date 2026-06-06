import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /readyz", () => {
  const originalDatabaseUrl = process.env.POD_TRACKER_DATABASE_URL;

  afterEach(() => {
    process.env.POD_TRACKER_DATABASE_URL = originalDatabaseUrl;
  });

  it("fails readiness when required database configuration is missing", async () => {
    delete process.env.POD_TRACKER_DATABASE_URL;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      service: "pod-tracker-web",
      checks: {
        next: "ready",
        database: "missing_config",
      },
    });
  });
});
