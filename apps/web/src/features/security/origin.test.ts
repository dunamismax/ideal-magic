import { afterEach, describe, expect, test, vi } from "vitest";

import {
  getAppBaseUrl,
  getServerActionAllowedOrigins,
  getTrustedOrigins,
  isTrustedRequestOrigin,
  parseOriginList,
} from "./origin";

describe("origin security helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("requires an explicit HTTPS app origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(() => getAppBaseUrl()).toThrow(
      "BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL is required in production",
    );

    vi.stubEnv("BETTER_AUTH_URL", "http://pod-tracker.example.test");

    expect(() => getAppBaseUrl()).toThrow(
      "Configured app URL must use HTTPS in production",
    );
  });

  test("normalizes trusted origins for auth and server actions", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test/app");
    vi.stubEnv(
      "POD_TRACKER_TRUSTED_ORIGINS",
      "https://www.pod-tracker.example.test, not-a-url, http://localhost:3100",
    );

    expect(getTrustedOrigins()).toEqual([
      "https://pod-tracker.example.test",
      "https://www.pod-tracker.example.test",
      "http://localhost:3100",
    ]);
    expect(getServerActionAllowedOrigins()).toEqual([
      "pod-tracker.example.test",
      "www.pod-tracker.example.test",
      "localhost:3100",
    ]);
  });

  test("checks write origins from origin or referer headers", () => {
    const trustedOrigins = ["https://pod-tracker.example.test"];

    expect(
      isTrustedRequestOrigin(
        new Request("https://pod-tracker.example.test/api", {
          headers: { origin: "https://pod-tracker.example.test" },
        }),
        trustedOrigins,
      ),
    ).toBe(true);
    expect(
      isTrustedRequestOrigin(
        new Request("https://pod-tracker.example.test/api", {
          headers: { referer: "https://pod-tracker.example.test/invite" },
        }),
        trustedOrigins,
      ),
    ).toBe(true);
    expect(
      isTrustedRequestOrigin(
        new Request("https://pod-tracker.example.test/api", {
          headers: { origin: "https://evil.example.test" },
        }),
        trustedOrigins,
      ),
    ).toBe(false);
  });

  test("fails closed for missing write origins in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      isTrustedRequestOrigin(
        new Request("https://pod-tracker.example.test/api"),
        ["https://pod-tracker.example.test"],
      ),
    ).toBe(false);
  });

  test("parses only HTTP(S) origins", () => {
    expect(
      parseOriginList(
        "https://pod-tracker.example.test/path, chrome-extension://bad, http://localhost:3000",
      ),
    ).toEqual(["https://pod-tracker.example.test", "http://localhost:3000"]);
  });
});
