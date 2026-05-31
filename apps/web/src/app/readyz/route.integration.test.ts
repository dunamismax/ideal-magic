import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /readyz", () => {
  it("reports Next.js readiness before external services are required", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "pod-tracker-web",
      checks: {
        next: "ready",
      },
    });
  });
});
