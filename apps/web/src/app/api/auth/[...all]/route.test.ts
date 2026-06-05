import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  handler: vi.fn(),
}));

vi.mock("@/features/auth/server", () => ({
  getAuth: mocks.getAuth,
}));

import { GET, POST } from "@/app/api/auth/[...all]/route";
import {
  rateLimitPolicies,
  resetMemoryRateLimitStoreForTests,
  setRateLimitStoreForTests,
} from "@/features/security/rate-limit";

describe("auth route rate limiting", () => {
  beforeEach(() => {
    mocks.handler.mockResolvedValue(Response.json({ ok: true }));
    mocks.getAuth.mockReturnValue({ handler: mocks.handler });
  });

  afterEach(() => {
    vi.clearAllMocks();
    setRateLimitStoreForTests(null);
    resetMemoryRateLimitStoreForTests();
  });

  test("rejects over-limit auth writes before Better Auth handles the request", async () => {
    const hit = vi.fn().mockResolvedValue({
      count: rateLimitPolicies.auth.max + 1,
      ttlSeconds: 18,
    });
    setRateLimitStoreForTests({ hit });

    const response = await POST(
      new Request("https://pod-tracker.example.test/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "x-forwarded-for": "198.51.100.60",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Too many auth attempts. Try again later.",
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("18");
    expect(hit).toHaveBeenCalledWith(expect.any(String), 60);
    expect(mocks.getAuth).not.toHaveBeenCalled();
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  test("lets auth GET callbacks pass through without consuming the write limiter", async () => {
    const hit = vi.fn();
    setRateLimitStoreForTests({ hit });

    const response = await GET(
      new Request("https://pod-tracker.example.test/api/auth/verify-email", {
        method: "GET",
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(hit).not.toHaveBeenCalled();
    expect(mocks.getAuth).toHaveBeenCalled();
    expect(mocks.handler).toHaveBeenCalledWith(expect.any(Request));
  });
});
