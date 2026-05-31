import { expect, test } from "@playwright/test";

test("app shell exposes primary Commander workflows", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /life counter/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /game night/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Life Counter" }),
  ).toBeVisible();
});

test("health and readiness probes return ok", async ({ request }) => {
  await expect((await request.get("/healthz")).ok()).toBeTruthy();
  await expect((await request.get("/readyz")).ok()).toBeTruthy();
});
