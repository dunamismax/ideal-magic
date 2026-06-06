import { describe, expect, test, vi } from "vitest";

import { readAnalyticsConfigForTests, trackAnalyticsEvent } from "./analytics";

describe("Umami analytics", () => {
  test("is disabled unless endpoint and website id are configured", async () => {
    const send = vi.fn<typeof fetch>();

    await expect(
      trackAnalyticsEvent("event_created", {}, send),
    ).resolves.toBe("disabled");

    expect(send).not.toHaveBeenCalled();
  });

  test("reads placeholder-safe env configuration", () => {
    expect(
      readAnalyticsConfigForTests({
        POD_TRACKER_UMAMI_API_URL: "https://umami.example.test/api/send",
        POD_TRACKER_UMAMI_WEBSITE_ID: "website-id",
        POD_TRACKER_UMAMI_HOSTNAME: "pod-tracker.example.test",
      }),
    ).toEqual({
      endpoint: "https://umami.example.test/api/send",
      websiteId: "website-id",
      hostname: "pod-tracker.example.test",
    });
  });

  test("sends only a controlled event payload", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(
      trackAnalyticsEvent(
        "Event Created",
        {
          POD_TRACKER_UMAMI_API_URL: "https://umami.example.test/api/send",
          POD_TRACKER_UMAMI_WEBSITE_ID: "website-id",
          POD_TRACKER_UMAMI_HOSTNAME: "pod-tracker.example.test",
        },
        send,
      ),
    ).resolves.toBe("sent");

    expect(send).toHaveBeenCalledTimes(1);
    const [endpoint, init] = send.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(endpoint).toBe("https://umami.example.test/api/send");
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      "user-agent": "PodTracker/0.1",
    });
    expect(body).toEqual({
      type: "event",
      payload: {
        hostname: "pod-tracker.example.test",
        url: "/",
        website: "website-id",
        name: "event_created",
      },
    });
    expect(String(init?.body)).not.toContain("invite-token");
    expect(String(init?.body)).not.toContain("host@example.com");
  });
});
