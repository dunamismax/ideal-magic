import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  createDatabaseConnection: vi.fn(),
  createPublicGuestRsvp: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  createDatabaseConnection: mocks.createDatabaseConnection,
}));

vi.mock("@/features/events/public-event", () => ({
  createPublicGuestRsvp: mocks.createPublicGuestRsvp,
  PublicGuestRsvpValidationError: class PublicGuestRsvpValidationError extends Error {
    fieldErrors: Record<string, string>;

    constructor(fieldErrors: Record<string, string>) {
      super("Guest RSVP validation failed");
      this.fieldErrors = fieldErrors;
    }
  },
}));

import { POST } from "./route";
import {
  rateLimitPolicies,
  resetMemoryRateLimitStoreForTests,
  setRateLimitStoreForTests,
} from "@/features/security/rate-limit";

describe("public guest RSVP route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    setRateLimitStoreForTests(null);
    resetMemoryRateLimitStoreForTests();
    vi.unstubAllEnvs();
  });

  test("accepts a same-origin RSVP write", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test");
    mocks.createDatabaseConnection.mockReturnValue({
      db: { test: "db" },
      close: mocks.close,
    });
    mocks.createPublicGuestRsvp.mockResolvedValue({
      id: "event-1",
      title: "Commander Night",
    });

    const response = await POST(
      new Request(
        "https://pod-tracker.example.test/api/public-events/invite/guest-rsvp",
        {
          method: "POST",
          headers: {
            origin: "https://pod-tracker.example.test",
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
      event: {
        id: "event-1",
        title: "Commander Night",
      },
    });
    expect(response.status).toBe(201);
    expect(mocks.createPublicGuestRsvp).toHaveBeenCalledWith(
      { test: "db" },
      "public-test-token",
      {
        guestName: "Riley",
        status: "yes",
      },
    );
    expect(mocks.close).toHaveBeenCalled();
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
    expect(mocks.createDatabaseConnection).not.toHaveBeenCalled();
    expect(mocks.createPublicGuestRsvp).not.toHaveBeenCalled();
  });

  test("rejects over-limit RSVP writes before parsing or opening the database", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test");
    const hit = vi.fn().mockResolvedValue({
      count: rateLimitPolicies.publicGuestRsvp.max + 1,
      ttlSeconds: 37,
    });
    setRateLimitStoreForTests({ hit });

    const response = await POST(
      new Request(
        "https://pod-tracker.example.test/api/public-events/invite/guest-rsvp",
        {
          method: "POST",
          headers: {
            origin: "https://pod-tracker.example.test",
            "content-type": "application/json",
            "x-forwarded-for": "198.51.100.50",
          },
          body: "not-json",
        },
      ),
      { params: Promise.resolve({ inviteToken: "public-test-token" }) },
    );

    await expect(response.json()).resolves.toEqual({
      error: "Too many guest RSVP attempts. Try again later.",
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(hit).toHaveBeenCalledWith(expect.any(String), 60);
    expect(mocks.createDatabaseConnection).not.toHaveBeenCalled();
    expect(mocks.createPublicGuestRsvp).not.toHaveBeenCalled();
  });
});
