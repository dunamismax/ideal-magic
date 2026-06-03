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

test("standalone life counter supports action-log undo and redo", async ({
  page,
}) => {
  await page.goto("/life");

  const firstPlayer = page.getByTestId("life-player-card").first();

  await firstPlayer.getByLabel("Player name").fill("Stephen");
  await firstPlayer
    .getByRole("button", { name: "Subtract 5 life from Stephen" })
    .click();
  await expect(firstPlayer).toContainText("35");

  await page
    .getByRole("button", { name: "Undo last life counter action" })
    .click();
  await expect(firstPlayer).toContainText("40");

  await page.getByRole("button", { name: "Redo life counter action" }).click();
  await expect(firstPlayer).toContainText("35");

  await page
    .getByRole("button", { name: "Undo last life counter action" })
    .click();
  await page.getByRole("button", { name: "Add poison to Stephen" }).click();

  await expect(firstPlayer).toContainText("40");
  await expect(page.getByTestId("player-1-poison-count")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Redo life counter action" }),
  ).toBeDisabled();
});

test("standalone life counter restores local Dexie state after refresh", async ({
  page,
}) => {
  await page.goto("/life");

  const firstPlayer = page.getByTestId("life-player-card").first();
  await firstPlayer.getByLabel("Player name").fill("Stephen");
  await firstPlayer.getByLabel("Commander 1", { exact: true }).fill("Atraxa");

  let blockedRequests = 0;
  await page.route("**/*", async (route) => {
    blockedRequests += 1;
    await route.abort();
  });

  await firstPlayer
    .getByRole("button", { name: "Subtract 10 life from Stephen" })
    .click();
  await page.getByRole("button", { name: "Add poison to Stephen" }).click();
  await expect(firstPlayer).toContainText("30");
  await expect(page.getByTestId("player-1-poison-count")).toHaveText("1");
  expect(blockedRequests).toBe(0);

  await page.unroute("**/*");
  await page.reload();

  const restoredFirstPlayer = page.getByTestId("life-player-card").first();
  await expect(page.getByRole("heading", { name: "Stephen" })).toBeVisible();
  await expect(
    restoredFirstPlayer.getByLabel("Commander 1", { exact: true }),
  ).toHaveValue("Atraxa");
  await expect(restoredFirstPlayer).toContainText("30");
  await expect(page.getByTestId("player-1-poison-count")).toHaveText("1");
});

test("standalone life counter tracks Commander counters and table roles", async ({
  page,
}) => {
  await page.goto("/life");

  const firstPlayer = page.getByTestId("life-player-card").first();

  await firstPlayer.getByLabel("Player name").fill("Stephen");
  await firstPlayer
    .getByRole("button", { name: "Make Stephen monarch" })
    .click();
  await firstPlayer
    .getByRole("button", { name: "Give initiative to Stephen" })
    .click();
  await firstPlayer
    .getByRole("button", { name: "Give city's blessing to Stephen" })
    .click();

  await expect(page.getByTestId("monarch-holder")).toHaveText(
    "Stephen monarch",
  );
  await expect(page.getByTestId("initiative-holder")).toHaveText(
    "Stephen initiative",
  );
  await expect(page.getByTestId("player-1-city-blessing")).toHaveText(
    "City's blessing",
  );

  await page.getByRole("button", { name: "Night" }).click();
  await page.getByRole("button", { name: "Add storm" }).click();
  await page.getByRole("button", { name: "Add storm" }).click();
  await expect(page.getByTestId("day-night-state")).toHaveText("night");
  await expect(page.getByTestId("storm-count")).toHaveText("2");

  await firstPlayer
    .getByRole("button", { name: "Add experience to Stephen" })
    .click();
  await firstPlayer
    .getByRole("button", { name: "Add energy to Stephen" })
    .click();
  await firstPlayer.getByRole("button", { name: "Add rad to Stephen" }).click();
  await firstPlayer
    .getByRole("button", { name: "Add treasure to Stephen" })
    .click();
  await firstPlayer
    .getByRole("button", { name: "Add White floating mana to Stephen" })
    .click();

  await expect(page.getByTestId("player-1-experience-count")).toHaveText("1");
  await expect(page.getByTestId("player-1-energy-count")).toHaveText("1");
  await expect(page.getByTestId("player-1-rad-count")).toHaveText("1");
  await expect(page.getByTestId("player-1-treasure-count")).toHaveText("1");
  await expect(page.getByTestId("player-1-floating-mana-W-count")).toHaveText(
    "1",
  );

  await firstPlayer
    .getByRole("button", { name: "Add custom counter for Stephen" })
    .click();
  const customCounter = page.getByTestId("player-1-custom-counter-row").first();
  await customCounter
    .getByLabel("Custom counter name 1 for Stephen")
    .fill("Shield");
  await customCounter
    .getByRole("button", { name: "Add Shield to Stephen" })
    .click();
  await expect(customCounter.locator("[data-testid$='-count']")).toHaveText(
    "1",
  );

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("monarch-holder")).toHaveText("No monarch");
  await expect(page.getByTestId("initiative-holder")).toHaveText(
    "No initiative",
  );
  await expect(page.getByTestId("day-night-state")).toHaveText(
    "Day/night unset",
  );
  await expect(page.getByTestId("storm-count")).toHaveText("0");
  await expect(page.getByTestId("player-1-experience-count")).toHaveText("0");
  await expect(page.getByTestId("player-1-floating-mana-W-count")).toHaveText(
    "0",
  );
  await expect(customCounter.locator("[data-testid$='-count']")).toHaveText(
    "0",
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
  await expect(
    page.getByRole("button", { name: "Add 10 life to Player 1" }),
  ).toBeVisible();

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

test("standalone life counter tracks timers and turn order", async ({
  page,
}) => {
  await page.goto("/life");
  await page.clock.install({
    time: new Date("2026-01-01T00:00:00Z"),
  });

  await expect(page.getByTestId("game-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:00");
  await expect(page.getByTestId("active-turn-player")).toHaveText("Player 1");
  await expect(page.getByTestId("turn-count")).toHaveText("Turn 1");
  await expect(page.getByTestId("turn-order")).toContainText("1. Player 1");

  await page.getByRole("button", { name: "Start timers" }).click();
  await page.clock.fastForward(3000);
  await expect(page.getByTestId("game-timer")).toHaveText("00:03");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:03");

  await page.getByRole("button", { name: "Pause timers" }).click();
  await page.clock.fastForward(2000);
  await expect(page.getByTestId("game-timer")).toHaveText("00:03");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:03");

  await page.getByRole("button", { name: "Start timers" }).click();
  await page.clock.fastForward(1000);
  await expect(page.getByTestId("game-timer")).toHaveText("00:04");

  await page.getByRole("button", { name: "Next turn" }).click();
  await expect(page.getByTestId("active-turn-player")).toHaveText("Player 2");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-count")).toHaveText("Turn 1");

  await page.clock.fastForward(2000);
  await expect(page.getByTestId("game-timer")).toHaveText("00:06");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:02");

  await page.getByRole("button", { name: "Turn timer" }).click();
  await expect(page.getByTestId("turn-timer")).toHaveText("00:00");

  await page.getByRole("button", { name: "Next turn" }).click();
  await page.getByRole("button", { name: "Next turn" }).click();
  await page.getByRole("button", { name: "Next turn" }).click();
  await expect(page.getByTestId("active-turn-player")).toHaveText("Player 1");
  await expect(page.getByTestId("turn-count")).toHaveText("Turn 2");

  await page.getByRole("button", { name: "Reset timers" }).click();
  await expect(page.getByTestId("game-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-count")).toHaveText("Turn 1");

  await page.getByRole("button", { name: "Start timers" }).click();
  await page.clock.fastForward(1000);
  await page.getByRole("button", { name: "Rematch" }).click();
  await expect(page.getByTestId("game-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-count")).toHaveText("Turn 1");

  await page.getByRole("button", { name: "Start timers" }).click();
  await page.clock.fastForward(1000);
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByTestId("game-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-timer")).toHaveText("00:00");
  await expect(page.getByTestId("turn-count")).toHaveText("Turn 1");
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

test("event-linked life counter imports event participants and decks", async ({
  page,
}) => {
  await page.goto("/events/commander-night-demo/life");

  await expect(
    page.getByRole("heading", {
      name: "Wednesday Commander Night Life Counter",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("linked-life-status")).toContainText(
    "6 event players imported",
  );
  await expect(page.getByTestId("life-player-card")).toHaveCount(6);

  const firstPlayer = page.getByTestId("life-player-card").first();
  await expect(firstPlayer.getByLabel("Player name")).toHaveValue("Nora");
  await expect(
    firstPlayer.getByLabel("Commander 1", { exact: true }),
  ).toHaveValue("Muldrotha, the Gravetide");
  await expect(firstPlayer.getByLabel("Deck label")).toHaveValue(
    "Graveyard Value",
  );

  const partnerPlayer = page.getByTestId("life-player-card").nth(4);
  await expect(
    partnerPlayer.getByLabel("Commander 1", { exact: true }),
  ).toHaveValue("Kraum, Ludevic's Opus");
  await expect(
    partnerPlayer.getByLabel("Commander 2", { exact: true }),
  ).toHaveValue("Tymna the Weaver");
});

test("pod-linked life counter imports published pod seats", async ({
  page,
}) => {
  await page.goto("/events/commander-night-demo/pods/pod-alpha/life");

  await expect(
    page.getByRole("heading", { name: "Pod Alpha Life Counter" }),
  ).toBeVisible();
  await expect(page.getByTestId("linked-life-status")).toContainText(
    "4 published pod seats imported",
  );
  await expect(page.getByTestId("life-player-card")).toHaveCount(4);

  await expect(page.getByTestId("life-player-card").nth(0)).toContainText(
    "Seat North",
  );
  await expect(
    page.getByTestId("life-player-card").nth(0).getByLabel("Player name"),
  ).toHaveValue("Nora");
  await expect(page.getByTestId("life-player-card").nth(3)).toContainText(
    "Seat West",
  );
  await expect(
    page.getByTestId("life-player-card").nth(3).getByLabel("Player name"),
  ).toHaveValue("Sol");
});

test("health and readiness probes return ok", async ({ request }) => {
  await expect((await request.get("/healthz")).ok()).toBeTruthy();
  await expect((await request.get("/readyz")).ok()).toBeTruthy();
});
