import { describe, expect, test, vi } from "vitest";

import { buildLogEntryForTests, logServerError } from "./logger";

describe("structured logging", () => {
  test("emits JSON logs with safe event names and error names only", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logServerError(
      "Deck creation failed",
      new Error("contains host@example.com and invite-token"),
      {
        component: "decks",
        tokenHash: "abc123",
        email: "host@example.com",
        attempts: 2,
      },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(String(consoleSpy.mock.calls[0]?.[0]));

    expect(parsed).toMatchObject({
      level: "error",
      service: "pod-tracker-web",
      event: "deck_creation_failed",
      component: "decks",
      attempts: 2,
      error: {
        name: "Error",
      },
    });
    expect(parsed).not.toHaveProperty("tokenHash");
    expect(parsed).not.toHaveProperty("email");
    expect(JSON.stringify(parsed)).not.toContain("host@example.com");
    expect(JSON.stringify(parsed)).not.toContain("invite-token");

    consoleSpy.mockRestore();
  });

  test("redacts sensitive-looking field values and rejects unsafe events", () => {
    const entry = buildLogEntryForTests(
      "warn",
      "unsafe event / abc",
      {
        component: "calendar",
        value: "https://example.test/invites/events/private-token",
      },
      "plain failure",
    );

    expect(entry).toMatchObject({
      level: "warn",
      event: "application_event",
      component: "calendar",
      value: "[redacted]",
      error: {
        name: "NonErrorThrown",
      },
    });
  });
});
