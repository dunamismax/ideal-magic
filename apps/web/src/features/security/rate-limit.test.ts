import { afterEach, describe, expect, test, vi } from "vitest";

import {
  enforceRateLimitForHeaders,
  rateLimitPolicies,
  RateLimitError,
  RateLimitUnavailableError,
  resetMemoryRateLimitStoreForTests,
  setRateLimitStoreForTests,
} from "./rate-limit";

describe("rate limiting", () => {
  afterEach(() => {
    setRateLimitStoreForTests(null);
    resetMemoryRateLimitStoreForTests();
    vi.unstubAllEnvs();
  });

  test("uses the local memory fallback outside production", async () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.10" });
    const policy = { name: "test-policy", max: 2, windowSeconds: 60 };

    await enforceRateLimitForHeaders(headers, policy, ["write"]);
    await enforceRateLimitForHeaders(headers, policy, ["write"]);

    await expect(
      enforceRateLimitForHeaders(headers, policy, ["write"]),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  test("hashes identity parts before handing keys to the store", async () => {
    const hit = vi.fn().mockResolvedValue({ count: 1, ttlSeconds: 60 });
    setRateLimitStoreForTests({ hit });

    await enforceRateLimitForHeaders(
      new Headers({ "x-forwarded-for": "198.51.100.20" }),
      rateLimitPolicies.publicGuestRsvp,
      ["public-events", "guest-rsvp", "secret-invite-token"],
    );

    const key = hit.mock.calls[0]?.[0] ?? "";
    expect(key).toContain("pod-tracker:rate-limit:public-guest-rsvp:");
    expect(key).not.toContain("198.51.100.20");
    expect(key).not.toContain("secret-invite-token");
  });

  test("requires a Valkey-compatible URL in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VALKEY_URL", "");
    vi.stubEnv("REDIS_URL", "");

    await expect(
      enforceRateLimitForHeaders(
        new Headers({ "x-forwarded-for": "198.51.100.30" }),
        rateLimitPolicies.auth,
        ["auth"],
      ),
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });
});
