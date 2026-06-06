import { describe, expect, test, vi } from "vitest";

import {
  captureServerErrorReport,
  readErrorReportingConfigForTests,
} from "./error-reporting";

describe("Sentry-compatible error reporting", () => {
  test("is disabled by default", async () => {
    const send = vi.fn<typeof fetch>();

    await expect(
      captureServerErrorReport(
        {
          event: "deck_creation_failed",
          errorName: "Error",
        },
        {},
        send,
      ),
    ).resolves.toBe("disabled");

    expect(send).not.toHaveBeenCalled();
  });

  test("derives the envelope endpoint from a GlitchTip/Sentry DSN", () => {
    expect(
      readErrorReportingConfigForTests({
        POD_TRACKER_ERROR_REPORTING_DSN:
          "https://public@example.test/sentry/42",
        POD_TRACKER_ERROR_REPORTING_ENVIRONMENT: "production",
        POD_TRACKER_RELEASE: "2026.06.06",
      }),
    ).toMatchObject({
      endpoint: "https://example.test/sentry/api/42/envelope/",
      publicKey: "public",
      environment: "production",
      release: "2026.06.06",
    });
  });

  test("sends controlled event fields without raw private payloads", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(
      captureServerErrorReport(
        {
          event: "public_guest_rsvp_write_failed",
          errorName: "DatabaseError",
          component: "public-events",
        },
        {
          POD_TRACKER_ERROR_REPORTING_DSN:
            "https://public@example.test/sentry/42",
          NODE_ENV: "production",
        },
        send,
      ),
    ).resolves.toBe("sent");

    expect(send).toHaveBeenCalledTimes(1);
    const [endpoint, init] = send.mock.calls[0] ?? [];
    const body = String(init?.body);

    expect(endpoint).toBe("https://example.test/sentry/api/42/envelope/");
    expect(init?.headers).toMatchObject({
      "content-type": "application/x-sentry-envelope",
    });
    expect(body).toContain("public_guest_rsvp_write_failed");
    expect(body).toContain("DatabaseError");
    expect(body).toContain("public-events");
    expect(body).not.toContain("host@example.com");
    expect(body).not.toContain("invite-token");
    expect(body).not.toContain("stack");
    expect(body).not.toContain("message");
  });
});
