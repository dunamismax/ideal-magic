import { expect, test } from "@playwright/test";

test("app shell exposes primary Commander workflows", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /life counter/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /game night/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Life Counter" }),
  ).toBeVisible();
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "wide", width: 1920, height: 1080 },
]) {
  test(`life counter layout is usable on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/life");

    await expect(
      page.getByRole("heading", { name: "Life Counter" }),
    ).toBeVisible();
    await expect(page.getByTestId("life-player-card")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "Add 10 life to Player 1" }),
    ).toBeVisible();

    const overflowCount = await page.locator("button, a, input").evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const text =
            element instanceof HTMLInputElement
              ? element.value
              : element.textContent;
          if (!text?.trim()) {
            return false;
          }

          const rect = element.getBoundingClientRect();
          return (
            element.scrollWidth > Math.ceil(rect.width) + 2 ||
            element.scrollHeight > Math.ceil(rect.height) + 2
          );
        }).length,
    );

    expect(overflowCount).toBe(0);

    await page.screenshot({
      path: `test-results/life-counter-${viewport.name}.png`,
      fullPage: true,
    });
  });
}

test("standalone life counter updates local table state", async ({ page }) => {
  await page.goto("/life");

  await page.getByRole("radio", { name: "6" }).click();
  await expect(page.getByTestId("life-player-card")).toHaveCount(6);

  const firstPlayer = page.getByTestId("life-player-card").first();

  await firstPlayer.getByLabel("Player name").fill("Stephen");
  await firstPlayer.getByLabel("Commander 1", { exact: true }).fill("Atraxa");
  await firstPlayer
    .getByRole("button", { name: "Add commander", exact: true })
    .click();
  await firstPlayer.getByLabel("Commander 2", { exact: true }).fill("Tekuthal");
  await firstPlayer.getByLabel("Deck label").fill("Counters");
  await expect(page.getByRole("heading", { name: "Stephen" })).toBeVisible();

  await firstPlayer
    .getByRole("button", { name: "Subtract 5 life from Stephen" })
    .click();
  await expect(firstPlayer).toContainText("35");

  await page.getByRole("button", { name: "Add poison to Stephen" }).click();
  await expect(page.getByTestId("player-1-poison-count")).toHaveText("1");

  await firstPlayer.getByRole("button", { name: "Add cast to Atraxa" }).click();
  await expect(page.getByTestId("player-1-commander-1-cast-count")).toHaveText(
    "1",
  );
});

test("standalone life counter tracks commander damage by source", async ({
  page,
}) => {
  await page.goto("/life");

  const firstPlayer = page.getByTestId("life-player-card").nth(0);
  const secondPlayer = page.getByTestId("life-player-card").nth(1);

  await firstPlayer.getByLabel("Player name").fill("Stephen");
  await firstPlayer.getByLabel("Commander 1", { exact: true }).fill("Atraxa");
  await secondPlayer.getByLabel("Player name").fill("Alex");

  await secondPlayer
    .getByRole("button", {
      name: "Add commander damage from Atraxa to Alex",
    })
    .click();

  await expect(
    page.getByTestId("player-2-player-1-commander-1-commander-damage"),
  ).toHaveText("1");
});

test("standalone life counter supports reset, rematch, and new game flows", async ({
  page,
}) => {
  await page.goto("/life");

  const firstPlayer = page.getByTestId("life-player-card").nth(0);
  const secondPlayer = page.getByTestId("life-player-card").nth(1);

  await firstPlayer.getByLabel("Player name").fill("Stephen");
  await firstPlayer.getByLabel("Commander 1", { exact: true }).fill("Atraxa");
  await firstPlayer.getByLabel("Deck label").fill("Counters");
  await firstPlayer
    .getByRole("button", { name: "Subtract 10 life from Stephen" })
    .click();
  await page.getByRole("button", { name: "Add poison to Stephen" }).click();
  await secondPlayer
    .getByRole("button", {
      name: "Add commander damage from Atraxa to Player 2",
    })
    .click();

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(firstPlayer).toContainText("40");
  await expect(page.getByTestId("player-1-poison-count")).toHaveText("0");
  await expect(
    page.getByTestId("player-2-player-1-commander-1-commander-damage"),
  ).toHaveText("0");
  await expect(page.getByRole("heading", { name: "Stephen" })).toBeVisible();

  await page.getByRole("button", { name: "Rematch" }).click();
  await expect(page.getByTestId("life-player-card").first()).toContainText(
    "Player 2",
  );
  await expect(page.getByRole("heading", { name: "Stephen" })).toBeVisible();

  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByTestId("life-player-card")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Stephen" }),
  ).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Player 1" })).toBeVisible();
});

test("standalone life counter tracks elimination and result states", async ({
  page,
}) => {
  await page.goto("/life");

  const firstPlayer = page.getByTestId("life-player-card").nth(0);
  const secondPlayer = page.getByTestId("life-player-card").nth(1);

  await firstPlayer.getByLabel("Player name").fill("Stephen");
  await secondPlayer.getByLabel("Player name").fill("Alex");

  await firstPlayer.getByRole("button", { name: "Eliminate Stephen" }).click();
  await expect(page.getByTestId("player-1-status")).toHaveText("Eliminated");

  await firstPlayer.getByRole("button", { name: "Restore Stephen" }).click();
  await expect(page.getByTestId("player-1-status")).toHaveText("Active");

  await secondPlayer
    .getByRole("button", { name: "Mark Alex as winner" })
    .click();
  await expect(page.getByTestId("player-2-status")).toHaveText("Winner");
  await expect(page.getByTestId("life-game-result")).toHaveText("Alex wins");

  await page.getByRole("button", { name: "Draw" }).click();
  await expect(page.getByTestId("life-game-result")).toHaveText("Draw");
  await expect(page.getByTestId("player-2-status")).toHaveText("Active");

  await page.getByRole("button", { name: "No contest" }).click();
  await expect(page.getByTestId("life-game-result")).toHaveText("No contest");
});

test("standalone life counter supports desktop keyboard play", async ({
  page,
}) => {
  await page.goto("/life");

  await page.keyboard.press("2");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+ArrowUp");

  const secondPlayer = page.getByTestId("life-player-card").nth(1);
  await expect(secondPlayer).toContainText("Keyboard");
  await expect(secondPlayer).toContainText("44");

  await page.keyboard.press("ArrowRight");
  const thirdPlayer = page.getByTestId("life-player-card").nth(2);
  await expect(thirdPlayer).toContainText("Keyboard");
});

test("standalone life counter opens a table display overlay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/life");

  await page.getByRole("button", { name: "Table display" }).click();

  const tableDisplay = page.getByTestId("life-table-display");
  await expect(tableDisplay).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit table" })).toBeVisible();

  const box = await tableDisplay.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(1360);
  expect(box?.height).toBeGreaterThanOrEqual(760);
});

test("health and readiness probes return ok", async ({ request }) => {
  await expect((await request.get("/healthz")).ok()).toBeTruthy();
  await expect((await request.get("/readyz")).ok()).toBeTruthy();
});
