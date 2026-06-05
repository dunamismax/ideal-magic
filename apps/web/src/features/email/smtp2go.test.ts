import { describe, expect, test, vi } from "vitest";

import {
  createSmtp2goEmailDelivery,
  createSmtp2goPayload,
  readSmtp2goConfig,
} from "./smtp2go";

describe("SMTP2GO email delivery", () => {
  test("requires env-only credentials and sender configuration", () => {
    expect(() => readSmtp2goConfig({})).toThrow(
      "SMTP2GO_API_KEY is required",
    );
    expect(() =>
      readSmtp2goConfig({
        SMTP2GO_API_KEY: "configured-api-key",
      }),
    ).toThrow("POD_TRACKER_EMAIL_FROM is required");
  });

  test("constructs a standard SMTP2GO payload without embedding the API key", () => {
    const payload = createSmtp2goPayload(
      {
        apiKey: "configured-api-key",
        sender: "Pod Tracker <noreply@example.test>",
        replyTo: "support@example.test",
      },
      {
        to: "player@example.test",
        subject: "Verify your Pod Tracker account",
        textBody: "Open the account link.",
        htmlBody: "<p>Open the account link.</p>",
      },
    );

    expect(payload).toMatchObject({
      sender: "Pod Tracker <noreply@example.test>",
      to: ["player@example.test"],
      subject: "Verify your Pod Tracker account",
      text_body: "Open the account link.",
      html_body: "<p>Open the account link.</p>",
      custom_headers: [
        { header: "Reply-To", value: "support@example.test" },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("configured-api-key");
  });

  test("sends through SMTP2GO with the API key header", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ data: { succeeded: 1, failed: 0 } }),
    ) as unknown as typeof fetch;
    const delivery = createSmtp2goEmailDelivery(
      {
        apiKey: "configured-api-key",
        sender: "Pod Tracker <noreply@example.test>",
      },
      fetchImpl,
    );

    await delivery.send({
      to: "player@example.test",
      subject: "Reset your Pod Tracker password",
      textBody: "Open the password link.",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.smtp2go.com/v3/email/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Smtp2go-Api-Key": "configured-api-key",
        }),
      }),
    );
  });

  test("throws generic delivery errors without response details", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { data: { error: "recipient-specific failure", failed: 1 } },
        { status: 400 },
      ),
    ) as unknown as typeof fetch;
    const delivery = createSmtp2goEmailDelivery(
      {
        apiKey: "configured-api-key",
        sender: "Pod Tracker <noreply@example.test>",
      },
      fetchImpl,
    );

    await expect(
      delivery.send({
        to: "player@example.test",
        subject: "Reset your Pod Tracker password",
        textBody: "Open the password link.",
      }),
    ).rejects.toThrow("SMTP2GO email delivery failed");
  });
});
