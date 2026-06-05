import { afterEach, describe, expect, test, vi } from "vitest";

import { POST } from "./route";

vi.mock("@/db/client", () => ({
  createDatabaseConnection: vi.fn(() => {
    throw new Error("Database should not be opened for rejected origins.");
  }),
}));

vi.mock("@/features/events/public-event", () => ({
  createPublicGuestRsvp: vi.fn(),
  PublicGuestRsvpValidationError: class PublicGuestRsvpValidationError extends Error {
    fieldErrors: Record<string, string>;

    constructor(fieldErrors: Record<string, string>) {
      super("Guest RSVP validation failed");
      this.fieldErrors = fieldErrors;
    }
  },
}));

describe("public guest RSVP route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("rejects cross-site RSVP writes before parsing or opening the database", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test");

    const response = await POST(
      new Request(
        "https://pod-tracker.example.test/api/public-events/invite/guest-rsvp",
        {
          method: "POST",
          headers: {
            origin: "https://evil.example.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            guestName: "Riley",
            status: "yes",
          }),
        },
      ),
      { params: Promise.resolve({ inviteToken: "public-test-token" }) },
    );

    await expect(response.json()).resolves.toEqual({
      error: "Guest RSVP origin is not allowed",
    });
    expect(response.status).toBe(403);
  });
});
