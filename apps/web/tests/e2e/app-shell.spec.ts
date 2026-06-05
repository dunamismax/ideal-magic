import { expect, test } from "@playwright/test";

const appNetworkRequestTypes = new Set(["document", "fetch", "xhr"]);

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
    if (appNetworkRequestTypes.has(route.request().resourceType())) {
      blockedRequests += 1;
    }
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

test("event-linked life counter restores keyed local state after refresh", async ({
  page,
}) => {
  await page.goto("/events/commander-night-demo/life");

  await expect(page.getByTestId("life-save-status")).toHaveText(
    "Saved locally",
  );
  await expect(page.getByTestId("life-sync-scope")).toHaveText(
    "Local only - not saved to group",
  );

  const firstPlayer = page.getByTestId("life-player-card").first();

  let blockedRequests = 0;
  await page.route("**/*", async (route) => {
    if (appNetworkRequestTypes.has(route.request().resourceType())) {
      blockedRequests += 1;
    }
    await route.abort();
  });

  await firstPlayer
    .getByRole("button", { name: "Subtract 5 life from Nora" })
    .click();
  await page.getByRole("button", { name: "Add poison to Nora" }).click();
  await expect(firstPlayer).toContainText("35");
  await expect(page.getByTestId("player-1-poison-count")).toHaveText("1");
  expect(blockedRequests).toBe(0);

  await page.unroute("**/*");
  await page.reload();

  const restoredFirstPlayer = page.getByTestId("life-player-card").first();
  await expect(
    page.getByRole("heading", {
      name: "Wednesday Commander Night Life Counter",
    }),
  ).toBeVisible();
  await expect(
    restoredFirstPlayer.getByLabel("Commander 1", { exact: true }),
  ).toHaveValue("Muldrotha, the Gravetide");
  await expect(restoredFirstPlayer).toContainText("35");
  await expect(page.getByTestId("player-1-poison-count")).toHaveText("1");
  await expect(page.getByTestId("life-save-status")).toHaveText(
    "Saved locally",
  );
  await expect(page.getByTestId("life-sync-scope")).toHaveText(
    "Local only - not saved to group",
  );
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

test("pod-linked life counter restores keyed local state after refresh", async ({
  page,
}) => {
  await page.goto("/events/commander-night-demo/pods/pod-alpha/life");

  await expect(page.getByTestId("life-save-status")).toHaveText(
    "Saved locally",
  );
  await expect(page.getByTestId("life-sync-scope")).toHaveText(
    "Local only - not saved to group",
  );

  const westSeat = page.getByTestId("life-player-card").nth(3);

  let blockedRequests = 0;
  await page.route("**/*", async (route) => {
    if (appNetworkRequestTypes.has(route.request().resourceType())) {
      blockedRequests += 1;
    }
    await route.abort();
  });

  await westSeat
    .getByRole("button", { name: "Subtract 10 life from Sol" })
    .click();
  await expect(westSeat).toContainText("30");
  expect(blockedRequests).toBe(0);

  await page.unroute("**/*");
  await page.reload();

  const restoredWestSeat = page.getByTestId("life-player-card").nth(3);
  await expect(
    page.getByRole("heading", { name: "Pod Alpha Life Counter" }),
  ).toBeVisible();
  await expect(restoredWestSeat).toContainText("Seat West");
  await expect(restoredWestSeat.getByLabel("Player name")).toHaveValue("Sol");
  await expect(restoredWestSeat).toContainText("30");
  await expect(page.getByTestId("life-save-status")).toHaveText(
    "Saved locally",
  );
  await expect(page.getByTestId("life-sync-scope")).toHaveText(
    "Local only - not saved to group",
  );
});

test("tokenized public event invite shows public-safe planning details", async ({
  page,
}) => {
  await page.route(
    "**/api/public-events/fixture-wednesday-event-access",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          event: {
            id: "event-1",
            title: "Wednesday Commander Night",
            status: "scheduled",
            playgroupName: "Example City Commander League",
            dateLabel: "Wednesday, June 10, 2026",
            timeLabel: "11:00 PM UTC",
            locationName: "Example Tabletop Room",
            rsvpCounts: {
              yes: 3,
              maybe: 1,
              no: 1,
              waitlist: 1,
            },
            guestRsvps: 1,
            namedGuests: 1,
            totalResponses: 6,
            expectedPlayers: 5,
            deckDeclarations: 5,
            pods: 1,
            loggedGames: 1,
          },
        }),
      });
    },
  );

  await page.goto("/invites/events/fixture-wednesday-event-access");

  await expect(
    page.getByRole("heading", { name: "Wednesday Commander Night" }),
  ).toBeVisible();
  await expect(page.getByText("Example City Commander League")).toBeVisible();
  await expect(page.getByText("Example Tabletop Room")).toBeVisible();
  await expect(page.getByText("5 players")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Yes" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Waitlist" })).toBeVisible();

  const publicText = await page.locator("body").innerText();

  expect(publicText).not.toContain("101 Example Tabletop Way");
  expect(publicText).not.toContain("Private fixture RSVP note");
  expect(publicText).not.toContain("nora@example.test");
  expect(publicText).not.toContain("fixture-wednesday-event-access");
  expect(publicText).not.toContain("Example Guest");
});

test("tokenized public event invite submits a guest RSVP and refreshes aggregates", async ({
  page,
}) => {
  let postedRsvp: unknown = null;

  await page.route(
    "**/api/public-events/fixture-wednesday-event-access",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          event: {
            id: "event-1",
            title: "Wednesday Commander Night",
            status: "scheduled",
            playgroupName: "Example City Commander League",
            dateLabel: "Wednesday, June 10, 2026",
            timeLabel: "11:00 PM UTC",
            locationName: "Example Tabletop Room",
            rsvpCounts: {
              yes: 3,
              maybe: 1,
              no: 1,
              waitlist: 1,
            },
            guestRsvps: 1,
            namedGuests: 1,
            totalResponses: 6,
            expectedPlayers: 5,
            deckDeclarations: 5,
            pods: 1,
            loggedGames: 1,
          },
        }),
      });
    },
  );
  await page.route(
    "**/api/public-events/fixture-wednesday-event-access/guest-rsvp",
    async (route) => {
      postedRsvp = route.request().postDataJSON();

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          event: {
            id: "event-1",
            title: "Wednesday Commander Night",
            status: "scheduled",
            playgroupName: "Example City Commander League",
            dateLabel: "Wednesday, June 10, 2026",
            timeLabel: "11:00 PM UTC",
            locationName: "Example Tabletop Room",
            rsvpCounts: {
              yes: 4,
              maybe: 1,
              no: 1,
              waitlist: 1,
            },
            guestRsvps: 2,
            namedGuests: 1,
            totalResponses: 7,
            expectedPlayers: 6,
            deckDeclarations: 5,
            pods: 1,
            loggedGames: 1,
          },
        }),
      });
    },
  );

  await page.goto("/invites/events/fixture-wednesday-event-access");
  await page.getByLabel("Name").fill("Robin Vale");
  await page.getByLabel("Status").selectOption("yes");
  await page.getByRole("button", { name: "RSVP" }).click();

  expect(postedRsvp).toEqual({
    guestName: "Robin Vale",
    status: "yes",
  });
  await expect(page.getByRole("row", { name: "Yes 4" })).toBeVisible();
  await expect(page.getByText("6 players")).toBeVisible();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("");

  const publicText = await page.locator("body").innerText();

  expect(publicText).not.toContain("101 Example Tabletop Way");
  expect(publicText).not.toContain("Private guest RSVP note");
  expect(publicText).not.toContain("nora@example.test");
  expect(publicText).not.toContain("fixture-wednesday-event-access");
  expect(publicText).not.toContain("Example Guest");
  expect(publicText).not.toContain("Robin Vale");
});

test("tokenized public event invite fails closed for missing invites", async ({
  page,
}) => {
  await page.route("**/api/public-events/wrong-token", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Event invite not found" }),
    });
  });

  await page.goto("/invites/events/wrong-token");

  await expect(
    page.getByRole("heading", { name: "Event invite unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("The invite may be expired, mistyped, or not public-safe."),
  ).toBeVisible();
});

test("signup form posts Better Auth email credentials", async ({ page }) => {
  let postedSignup: unknown = null;

  await page.route("**/api/auth/sign-up/email", async (route) => {
    postedSignup = route.request().postDataJSON();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie": "pod-tracker.session_token=fake-session; Path=/",
      },
      body: JSON.stringify({
        user: {
          id: "user-1",
          email: "riley@example.test",
          name: "Riley Chen",
        },
        session: {
          id: "session-1",
        },
      }),
    });
  });

  await page.goto("/signup?next=/life");
  await page.getByLabel("Name").fill("Riley Chen");
  await page.getByLabel("Email").fill("RILEY@EXAMPLE.TEST");
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create Account" }).click();

  expect(postedSignup).toMatchObject({
    email: "riley@example.test",
    password: "correct-horse-battery",
    name: "Riley Chen",
    callbackURL: "/life",
  });
  await expect(
    page.getByRole("heading", { name: "Life Counter" }),
  ).toBeVisible();
});

test("login form posts Better Auth email credentials", async ({ page }) => {
  let postedLogin: unknown = null;

  await page.route("**/api/auth/sign-in/email", async (route) => {
    postedLogin = route.request().postDataJSON();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie": "pod-tracker.session_token=fake-session; Path=/",
      },
      body: JSON.stringify({
        user: {
          id: "user-1",
          email: "riley@example.test",
          name: "Riley Chen",
        },
        session: {
          id: "session-1",
        },
      }),
    });
  });

  await page.goto("/login?next=/life");
  await page.getByLabel("Email").fill("riley@example.test");
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Log In" }).click();

  expect(postedLogin).toMatchObject({
    email: "riley@example.test",
    password: "correct-horse-battery",
    callbackURL: "/life",
  });
  await expect(
    page.getByRole("heading", { name: "Life Counter" }),
  ).toBeVisible();
});

test("authenticated users can create and list a playgroup", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `group-smoke-${suffix}@example.test`;
  const groupName = `Friday Pods ${suffix}`;

  await page.goto("/signup?next=/groups");
  await page.getByLabel("Name").fill("Riley Chen");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL("/groups");
  await expect(
    page.getByRole("heading", { level: 1, name: "Groups" }),
  ).toBeVisible();

  await page.getByLabel("Group Name").fill(groupName);
  await page
    .getByLabel("Description")
    .fill("Bracket-aware pods and rotating hosts.");
  await page.getByRole("button", { name: "Create Group" }).click();

  const groupCard = page.locator("article").filter({ hasText: groupName });

  await expect(
    groupCard.getByRole("heading", { name: groupName }),
  ).toBeVisible();
  await expect(
    groupCard.getByText("Bracket-aware pods and rotating hosts."),
  ).toBeVisible();
  await expect(groupCard.getByText("owner").first()).toBeVisible();
  await expect(groupCard.getByText("Members", { exact: true })).toBeVisible();
  await expect(groupCard.getByText("Member Directory")).toBeVisible();
  await expect(groupCard.getByText("Riley Chen")).toBeVisible();
  await expect(
    groupCard.getByText("Upcoming Events", { exact: true }),
  ).toBeVisible();
});

test("group owners can create, list, and revoke invite links", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `group-invite-smoke-${suffix}@example.test`;
  const groupName = `Invite Pods ${suffix}`;

  await page.goto("/signup?next=/groups");
  await page.getByLabel("Name").fill("Riley Chen");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL("/groups");
  await page.getByLabel("Group Name").fill(groupName);
  await page.getByLabel("Description").fill("Invite management smoke.");
  await page.getByRole("button", { name: "Create Group" }).click();

  let groupCard = page.locator("article").filter({ hasText: groupName });

  await expect(groupCard.getByText("Invite Links")).toBeVisible();
  await expect(groupCard.getByText("No invites created.")).toBeVisible();
  await groupCard.getByRole("button", { name: "Create Invite" }).click();
  await expect(groupCard.getByText("Invite created.")).toBeVisible();
  await expect(
    groupCard.getByRole("link", { name: /\/invites\/groups\// }),
  ).toBeVisible();

  await page.reload();
  groupCard = page.locator("article").filter({ hasText: groupName });

  await expect(groupCard.getByText("Active member invite")).toBeVisible();
  await expect(groupCard.getByText("0 uses")).toBeVisible();
  await expect(
    groupCard.getByRole("button", { name: "Revoke Invite" }),
  ).toBeVisible();

  await groupCard.getByRole("button", { name: "Revoke Invite" }).click();
  await expect(groupCard.getByText("Revoked member invite")).toBeVisible();

  await page.reload();
  groupCard = page.locator("article").filter({ hasText: groupName });

  await expect(groupCard.getByText("Revoked member invite")).toBeVisible();
});

test("group owners can update member roles and remove memberships", async ({
  browser,
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const ownerEmail = `group-owner-manage-${suffix}@example.test`;
  const memberEmail = `group-member-manage-${suffix}@example.test`;
  const groupName = `Managed Pods ${suffix}`;

  await page.goto("/signup?next=/groups");
  await page.getByLabel("Name").fill("Riley Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL("/groups");
  await page.getByLabel("Group Name").fill(groupName);
  await page.getByLabel("Description").fill("Role management smoke.");
  await page.getByRole("button", { name: "Create Group" }).click();

  let groupCard = page.locator("article").filter({ hasText: groupName });

  await groupCard.getByRole("button", { name: "Create Invite" }).click();
  const invitePath = await groupCard
    .getByRole("link", { name: /\/invites\/groups\// })
    .innerText();
  const inviteContext = await browser.newContext();
  const invitePage = await inviteContext.newPage();

  await invitePage.goto(`/signup?next=${encodeURIComponent(invitePath)}`);
  await invitePage.getByLabel("Name").fill("Mina Rules");
  await invitePage.getByLabel("Email").fill(memberEmail);
  await invitePage.getByLabel("Password").fill("correct-horse-battery");
  await invitePage.getByRole("button", { name: "Create Account" }).click();
  await expect(invitePage).toHaveURL(invitePath);
  await invitePage.getByRole("button", { name: "Join Group" }).click();
  await expect(invitePage).toHaveURL("/groups");
  await inviteContext.close();

  await page.reload();
  groupCard = page.locator("article").filter({ hasText: groupName });
  const memberItem = groupCard.locator("li").filter({ hasText: "Mina Rules" });

  await expect(memberItem).toBeVisible();
  await expect(
    memberItem.locator("span").filter({ hasText: "member" }),
  ).toBeVisible();
  await memberItem.getByLabel("Role").selectOption("host");
  await memberItem.getByRole("button", { name: "Save Role" }).click();
  await expect(memberItem.getByText("Member role updated.")).toBeVisible();
  await expect(
    memberItem.locator("span").filter({ hasText: "host" }),
  ).toBeVisible();

  await memberItem.getByRole("button", { name: "Remove Mina Rules" }).click();
  await expect(memberItem).toHaveCount(0);
  await page.reload();
  groupCard = page.locator("article").filter({ hasText: groupName });
  await expect(
    groupCard.locator("li").filter({ hasText: "Mina Rules" }),
  ).toHaveCount(0);
});

test("authenticated group owners can create an event and RSVP", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `event-smoke-${suffix}@example.test`;
  const groupName = `Saturday Hosts ${suffix}`;
  const deckName = `Atraxa Counters ${suffix}`;
  const editedDeckName = `Atraxa Midrange ${suffix}`;
  const postDeclarationDeckName = `Atraxa Updated Later ${suffix}`;
  const eventTitle = `Saturday Commander ${suffix}`;
  const editedEventTitle = `Sunday Commander ${suffix}`;

  await page.goto("/signup?next=/groups");
  await page.getByLabel("Name").fill("Riley Chen");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL("/groups");
  await page.getByLabel("Group Name").fill(groupName);
  await page.getByLabel("Description").fill("Planning event creation.");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

  await page.goto("/decks");
  await expect(
    page.getByRole("heading", { level: 1, name: "Decks" }),
  ).toBeVisible();
  await page.getByLabel("Deck Name").fill(deckName);
  await page
    .getByLabel("Commanders")
    .fill("Atraxa, Grand Unifier\nTekuthal, Inquiry Dominus");
  await page.getByLabel("Colors").fill("wubg");
  await page.getByLabel("Bracket").selectOption("3");
  await page.getByLabel("Power").fill("7");
  await page.getByLabel("Archetype").fill("Counters");
  await page.getByLabel("Tags").fill("midrange, proliferate");
  await page.getByLabel("Visibility").selectOption("playgroup");
  await page
    .locator('select[name="playgroupId"]')
    .selectOption({ label: groupName });
  await page
    .getByLabel("External URL")
    .fill("https://example.test/decks/atraxa");
  await page.getByRole("button", { name: "Create Deck" }).click();

  const deckCard = page.locator("article").filter({ hasText: deckName });

  await expect(deckCard.getByRole("heading", { name: deckName })).toBeVisible();
  await expect(
    deckCard.getByText("Atraxa, Grand Unifier / Tekuthal, Inquiry Dominus"),
  ).toBeVisible();
  await expect(deckCard.getByText("WUBG")).toBeVisible();

  await deckCard.getByText("Edit Deck", { exact: true }).click();
  await deckCard.getByLabel("Edit Deck Name").fill(editedDeckName);
  await deckCard
    .getByLabel("Edit Commanders")
    .fill("Atraxa, Grand Unifier\nTekuthal, Inquiry Dominus");
  await deckCard.getByLabel("Edit Colors").fill("wubg");
  await deckCard.getByLabel("Edit Bracket").selectOption("4");
  await deckCard.getByLabel("Edit Power").fill("8");
  await deckCard.getByLabel("Edit Archetype").fill("Counters midrange");
  await deckCard.getByLabel("Edit Tags").fill("midrange, proliferate, tuned");
  await deckCard.getByLabel("Edit Visibility").selectOption("playgroup");
  await deckCard
    .locator('select[name="playgroupId"]')
    .selectOption({ label: groupName });
  await deckCard
    .getByLabel("Edit External URL")
    .fill("https://example.test/decks/atraxa-edited");
  await deckCard.getByRole("button", { name: "Update Deck" }).click();

  const editedDeckCard = page.locator("article").filter({
    hasText: editedDeckName,
  });

  await expect(editedDeckCard.getByText("Deck updated.")).toBeVisible();
  await expect(
    editedDeckCard.getByRole("heading", { name: editedDeckName }),
  ).toBeVisible();
  await expect(editedDeckCard.getByText("Counters midrange")).toBeVisible();
  await expect(editedDeckCard.getByText("tuned")).toBeVisible();

  await page.goto("/game-night");
  await expect(
    page.getByRole("heading", { level: 1, name: "Game Night" }),
  ).toBeVisible();
  await page
    .locator('select[name="playgroupId"]')
    .selectOption({ label: groupName });
  await page.getByLabel("Event Title").fill(eventTitle);
  await page.getByLabel("Start").fill("2030-06-14T19:00");
  await page.getByLabel("Visibility").selectOption("members");
  await page.getByLabel("Description").fill("Bring bracket 2-3 decks.");
  await page.getByRole("button", { name: "Create Event" }).click();

  const eventCard = page.locator("article").filter({ hasText: eventTitle });

  await expect(
    eventCard.getByRole("heading", { name: eventTitle }),
  ).toBeVisible();
  await expect(eventCard.getByText(groupName)).toBeVisible();
  await expect(
    eventCard.locator("span").filter({ hasText: "Members" }),
  ).toBeVisible();
  await expect(eventCard.getByText("owner")).toBeVisible();

  await eventCard
    .locator('select[name="deckId"]')
    .selectOption({ label: editedDeckName });
  await eventCard.locator('select[name="preference"]').selectOption("2");
  await eventCard.getByRole("button", { name: "Declare Deck" }).click();
  await expect(eventCard.getByText("Deck declared.")).toBeVisible();
  await expect(eventCard.getByText(editedDeckName).first()).toBeVisible();
  await expect(eventCard.getByText("Bracket 4")).toBeVisible();
  await expect(eventCard.getByText("Power 8")).toBeVisible();

  await eventCard.getByLabel("RSVP Status").selectOption("yes");
  await eventCard.getByLabel("Arrival").fill("2030-06-14T19:30");
  await eventCard.getByLabel("Leaving").fill("2030-06-14T23:00");
  await eventCard.getByRole("button", { name: "Save RSVP" }).click();
  await expect(eventCard.getByText("RSVP saved.")).toBeVisible();
  await expect(eventCard.getByText("RSVP: Yes")).toBeVisible();

  await eventCard.getByRole("button", { name: "Generate Draft Pods" }).click();
  await expect(eventCard.getByText("Generated 1 draft pod.")).toBeVisible();
  await expect(eventCard.getByText("Pod 1")).toBeVisible();
  await expect(eventCard.getByText("Riley Chen")).toBeVisible();
  await expect(
    eventCard.getByText(
      `${editedDeckName} - Atraxa, Grand Unifier / Tekuthal, Inquiry Dominus`,
    ),
  ).toBeVisible();

  await page.goto("/decks");
  const declaredDeckCard = page.locator("article").filter({
    hasText: editedDeckName,
  });
  await declaredDeckCard.getByText("Edit Deck", { exact: true }).click();
  await declaredDeckCard
    .getByLabel("Edit Deck Name")
    .fill(postDeclarationDeckName);
  await declaredDeckCard.getByLabel("Edit Bracket").selectOption("2");
  await declaredDeckCard.getByLabel("Edit Power").fill("5");
  await declaredDeckCard.getByRole("button", { name: "Update Deck" }).click();
  await expect(
    page.locator("article").filter({ hasText: postDeclarationDeckName }),
  ).toBeVisible();

  await page.goto("/game-night");
  const eventCardAfterDeckEdit = page
    .locator("article")
    .filter({ hasText: eventTitle });

  await expect(
    eventCardAfterDeckEdit.getByText(editedDeckName).first(),
  ).toBeVisible();
  await expect(
    eventCardAfterDeckEdit.getByText("Bracket 4").first(),
  ).toBeVisible();
  await expect(
    eventCardAfterDeckEdit.getByText("Power 8").first(),
  ).toBeVisible();
  await expect(
    eventCardAfterDeckEdit.getByText(
      `${editedDeckName} - Atraxa, Grand Unifier / Tekuthal, Inquiry Dominus`,
    ),
  ).toBeVisible();
  await expect(
    eventCardAfterDeckEdit.getByText(postDeclarationDeckName),
  ).toHaveCount(0);

  await eventCardAfterDeckEdit
    .getByRole("button", { name: `Undeclare ${editedDeckName}` })
    .click();
  await expect(
    eventCardAfterDeckEdit.getByText("Deck undeclared."),
  ).toBeVisible();
  await expect(
    eventCardAfterDeckEdit.getByText("No decks declared."),
  ).toBeVisible();

  await eventCardAfterDeckEdit.getByLabel("RSVP Status").selectOption("maybe");
  await eventCardAfterDeckEdit.getByLabel("Arrival").fill("2030-06-14T19:30");
  await eventCardAfterDeckEdit.getByLabel("Leaving").fill("2030-06-14T23:00");
  await eventCardAfterDeckEdit
    .getByRole("button", { name: "Save RSVP" })
    .click();

  await expect(eventCardAfterDeckEdit.getByText("RSVP saved.")).toBeVisible();
  await expect(eventCardAfterDeckEdit.getByText("RSVP: Maybe")).toBeVisible();

  await eventCardAfterDeckEdit
    .getByLabel("Edit Event Title")
    .fill(editedEventTitle);
  await eventCardAfterDeckEdit
    .getByLabel("Edit Start")
    .fill("2030-06-15T18:30");
  await eventCardAfterDeckEdit
    .getByLabel("Edit Visibility")
    .selectOption("invite_only");
  await eventCardAfterDeckEdit
    .getByLabel("Edit Description")
    .fill("Shifted to Sunday.");
  await eventCardAfterDeckEdit
    .getByRole("button", { name: "Update Event" })
    .click();

  const editedEventCard = page
    .locator("article")
    .filter({ hasText: editedEventTitle });

  await expect(
    editedEventCard.getByRole("heading", { name: editedEventTitle }),
  ).toBeVisible();
  await expect(
    editedEventCard.locator("span").filter({ hasText: "Invite Only" }),
  ).toBeVisible();
  await expect(editedEventCard.getByText("Event updated.")).toBeVisible();

  await editedEventCard.getByRole("button", { name: "Cancel Event" }).click();
  await expect(editedEventCard.getByText("Cancelled").first()).toBeVisible();

  await editedEventCard.getByRole("button", { name: "Archive Event" }).click();
  await expect(editedEventCard).toHaveCount(0);
});

for (const protectedRoute of ["/game-night", "/groups", "/decks", "/history"]) {
  test(`anonymous users are redirected from ${protectedRoute}`, async ({
    page,
  }) => {
    await page.goto(protectedRoute);

    await expect(page).toHaveURL(
      `/login?next=${encodeURIComponent(protectedRoute)}`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Log In" }),
    ).toBeVisible();
  });
}

test("health and readiness probes return ok", async ({ request }) => {
  await expect((await request.get("/healthz")).ok()).toBeTruthy();
  await expect((await request.get("/readyz")).ok()).toBeTruthy();
});
