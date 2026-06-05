import { randomUUID } from "node:crypto";
import { describe, expect, test, vi } from "vitest";

import {
  sendAccountVerificationEmail,
  sendChangeEmailConfirmation,
  sendPasswordResetEmail,
} from "./email";

describe("auth email payloads", () => {
  test("builds an account verification email with escaped HTML", async () => {
    const send = vi.fn(async () => undefined);
    const url = `https://pod-tracker.example.test/api/auth/verify-email?token=${randomUUID()}`;

    await sendAccountVerificationEmail(
      { send },
      {
        to: "player@example.test",
        url,
      },
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "player@example.test",
        subject: "Verify your Pod Tracker account",
        textBody: expect.stringContaining(url),
        htmlBody: expect.stringContaining(encodeForHtmlAttribute(url)),
      }),
    );
  });

  test("builds a password reset email with the Better Auth callback URL", async () => {
    const send = vi.fn(async () => undefined);
    const url = `https://pod-tracker.example.test/api/auth/reset-password/${randomUUID()}`;

    await sendPasswordResetEmail(
      { send },
      {
        to: "player@example.test",
        url,
      },
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "player@example.test",
        subject: "Reset your Pod Tracker password",
        textBody: expect.stringContaining(url),
      }),
    );
  });

  test("sends email-change confirmation to the current address", async () => {
    const send = vi.fn(async () => undefined);
    const url = `https://pod-tracker.example.test/api/auth/verify-email?token=${randomUUID()}`;

    await sendChangeEmailConfirmation(
      { send },
      {
        to: "current@example.test",
        newEmail: "next@example.test",
        url,
      },
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "current@example.test",
        subject: "Confirm your Pod Tracker email change",
        textBody: expect.stringContaining("next@example.test"),
      }),
    );
  });
});

function encodeForHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;");
}
