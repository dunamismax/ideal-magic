import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelPublicGuestRsvp: vi.fn(),
  close: vi.fn(),
  createDatabaseConnection: vi.fn(),
  getPublicGuestRsvp: vi.fn(),
  updatePublicGuestRsvp: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  createDatabaseConnection: mocks.createDatabaseConnection,
}));

vi.mock("@/features/events/public-event", () => ({
  cancelPublicGuestRsvp: mocks.cancelPublicGuestRsvp,
  getPublicGuestRsvp: mocks.getPublicGuestRsvp,
  updatePublicGuestRsvp: mocks.updatePublicGuestRsvp,
  PublicGuestRsvpValidationError: class PublicGuestRsvpValidationError extends Error {
    fieldErrors: Record<string, string>;

    constructor(fieldErrors: Record<string, string>) {
      super("Guest RSVP validation failed");
      this.fieldErrors = fieldErrors;
    }
  },
}));

import { DELETE, GET, PATCH } from "./route";
import {
  resetMemoryRateLimitStoreForTests,
  setRateLimitStoreForTests,
} from "@/features/security/rate-limit";

describe("public guest RSVP edit route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    setRateLimitStoreForTests(null);
    resetMemoryRateLimitStoreForTests();
    vi.unstubAllEnvs();
  });

  test("loads a token-scoped RSVP receipt", async () => {
    mocks.createDatabaseConnection.mockReturnValue({
      db: { test: "db" },
      close: mocks.close,
    });
    mocks.getPublicGuestRsvp.mockResolvedValue({
      event: {
        id: "event-1",
      },
      guestRsvp: {
        rsvpToken: "rsvp-token",
        guestName: "Riley",
        status: "yes",
      },
    });

    const response = await GET(
      new Request(
        "https://pod-tracker.example.test/api/public-events/invite/guest-rsvp/rsvp-token",
      ),
      {
        params: Promise.resolve({
          inviteToken: "public-test-token",
          rsvpToken: "rsvp-token",
        }),
      },
    );

    await expect(response.json()).resolves.toEqual({
      event: {
        id: "event-1",
      },
      guestRsvp: {
        rsvpToken: "rsvp-token",
        guestName: "Riley",
        status: "yes",
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.getPublicGuestRsvp).toHaveBeenCalledWith(
      { test: "db" },
      "public-test-token",
      "rsvp-token",
    );
    expect(mocks.close).toHaveBeenCalled();
  });

  test("updates a same-origin token-scoped RSVP", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test");
    mocks.createDatabaseConnection.mockReturnValue({
      db: { test: "db" },
      close: mocks.close,
    });
    mocks.updatePublicGuestRsvp.mockResolvedValue({
      event: {
        id: "event-1",
      },
      guestRsvp: {
        rsvpToken: "rsvp-token",
        guestName: "Riley Night",
        status: "maybe",
      },
    });

    const response = await PATCH(
      new Request(
        "https://pod-tracker.example.test/api/public-events/invite/guest-rsvp/rsvp-token",
        {
          method: "PATCH",
          headers: {
            origin: "https://pod-tracker.example.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            guestName: "Riley Night",
            status: "maybe",
          }),
        },
      ),
      {
        params: Promise.resolve({
          inviteToken: "public-test-token",
          rsvpToken: "rsvp-token",
        }),
      },
    );

    await expect(response.json()).resolves.toEqual({
      event: {
        id: "event-1",
      },
      guestRsvp: {
        rsvpToken: "rsvp-token",
        guestName: "Riley Night",
        status: "maybe",
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.updatePublicGuestRsvp).toHaveBeenCalledWith(
      { test: "db" },
      "public-test-token",
      "rsvp-token",
      {
        guestName: "Riley Night",
        status: "maybe",
      },
    );
    expect(mocks.close).toHaveBeenCalled();
  });

  test("cancels a same-origin token-scoped RSVP", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test");
    mocks.createDatabaseConnection.mockReturnValue({
      db: { test: "db" },
      close: mocks.close,
    });
    mocks.cancelPublicGuestRsvp.mockResolvedValue({
      event: {
        id: "event-1",
      },
      guestRsvp: {
        rsvpToken: "rsvp-token",
        guestName: "Riley",
        status: "no",
      },
    });

    const response = await DELETE(
      new Request(
        "https://pod-tracker.example.test/api/public-events/invite/guest-rsvp/rsvp-token",
        {
          method: "DELETE",
          headers: {
            origin: "https://pod-tracker.example.test",
          },
        },
      ),
      {
        params: Promise.resolve({
          inviteToken: "public-test-token",
          rsvpToken: "rsvp-token",
        }),
      },
    );

    await expect(response.json()).resolves.toEqual({
      event: {
        id: "event-1",
      },
      guestRsvp: {
        rsvpToken: "rsvp-token",
        guestName: "Riley",
        status: "no",
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.cancelPublicGuestRsvp).toHaveBeenCalledWith(
      { test: "db" },
      "public-test-token",
      "rsvp-token",
    );
    expect(mocks.close).toHaveBeenCalled();
  });

  test("rejects cross-site RSVP edits before parsing or opening the database", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test");

    const response = await PATCH(
      new Request(
        "https://pod-tracker.example.test/api/public-events/invite/guest-rsvp/rsvp-token",
        {
          method: "PATCH",
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
      {
        params: Promise.resolve({
          inviteToken: "public-test-token",
          rsvpToken: "rsvp-token",
        }),
      },
    );

    await expect(response.json()).resolves.toEqual({
      error: "Guest RSVP origin is not allowed",
    });
    expect(response.status).toBe(403);
    expect(mocks.createDatabaseConnection).not.toHaveBeenCalled();
    expect(mocks.updatePublicGuestRsvp).not.toHaveBeenCalled();
  });
});
