import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    env: {
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? "pod-tracker-playwright-auth-secret",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3100",
      POD_TRACKER_AUTH_RATE_LIMIT_MAX:
        process.env.POD_TRACKER_AUTH_RATE_LIMIT_MAX ?? "500",
      POD_TRACKER_DATABASE_URL:
        process.env.POD_TRACKER_DATABASE_URL ??
        "postgres://pod_tracker:pod_tracker@127.0.0.1:55432/pod_tracker",
      POD_TRACKER_EMAIL_DELIVERY_MODE:
        process.env.POD_TRACKER_EMAIL_DELIVERY_MODE ?? "test",
      POD_TRACKER_INVITE_RATE_LIMIT_MAX:
        process.env.POD_TRACKER_INVITE_RATE_LIMIT_MAX ?? "500",
      POD_TRACKER_PUBLIC_GUEST_RSVP_RATE_LIMIT_MAX:
        process.env.POD_TRACKER_PUBLIC_GUEST_RSVP_RATE_LIMIT_MAX ?? "500",
      POD_TRACKER_WRITE_RATE_LIMIT_MAX:
        process.env.POD_TRACKER_WRITE_RATE_LIMIT_MAX ?? "500",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
