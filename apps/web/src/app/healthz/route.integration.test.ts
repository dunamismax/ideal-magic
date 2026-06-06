import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /healthz", () => {
  const originalDatabaseUrl = process.env.POD_TRACKER_DATABASE_URL;

  afterEach(() => {
    process.env.POD_TRACKER_DATABASE_URL = originalDatabaseUrl;
  });

  it("reports process health and database configuration status", async () => {
    delete process.env.POD_TRACKER_DATABASE_URL;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "pod-tracker-web",
      checks: {
        process: "ok",
        database: "missing_config",
      },
    });
  });

  it("reports when database configuration is present", async () => {
    process.env.POD_TRACKER_DATABASE_URL =
      "postgres://pod_tracker:pod_tracker@localhost:55432/pod_tracker";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks.database).toBe("configured");
  });
});
