import { createHash, randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

const appNetworkRequestTypes = new Set(["document", "fetch", "xhr"]);
const e2eDatabaseUrl =
  process.env.POD_TRACKER_DATABASE_URL ??
  "postgres://pod_tracker:pod_tracker@127.0.0.1:55432/pod_tracker";
const testPassword = "correct-horse-battery";

type TestUser = {
  email: string;
  name: string;
  password?: string;
};

async function signUpVerifyAndLogin(
  page: Page,
  user: TestUser,
  nextPath = "/account",
) {
  await signUpThroughUi(page, user, nextPath);
  await verifyEmailInDatabase(user.email);
  await logInThroughUi(page, user, nextPath);
}

async function signUpThroughUi(
  page: Page,
  user: TestUser,
  nextPath = "/account",
) {
  await page.goto(`/signup?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password ?? testPassword);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(
    page.getByText("Check your email to verify your account."),
  ).toBeVisible();
}

async function logInThroughUi(
  page: Page,
  user: Pick<TestUser, "email" | "password">,
  nextPath = "/account",
) {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password ?? testPassword);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(nextPath);
}

async function verifyEmailInDatabase(email: string) {
  await withE2eSql(async (sql) => {
    const rows = await sql`
      update core.users
      set email_verified = true, updated_at = now()
      where email = ${email.toLowerCase()}
      returning id
    `;

    expect(rows).toHaveLength(1);
  });
}

async function createPublicEventFixture(input: {
  eventTitle: string;
  groupName: string;
  locationName: string;
}) {
  const playgroupId = randomUUID();
  const locationId = randomUUID();
  const eventId = randomUUID();
  const inviteToken = `event-${randomUUID()}`;
  const slug = `e2e-${randomUUID().slice(0, 8)}`;

  await withE2eSql(async (sql) => {
    await sql`
      insert into core.playgroups (id, name, slug, description)
      values (${playgroupId}, ${input.groupName}, ${slug}, 'Playwright public RSVP fixture')
    `;
    await sql`
      insert into core.event_locations (
        id,
        playgroup_id,
        name,
        address_line1,
        city,
        notes
      )
      values (
        ${locationId},
        ${playgroupId},
        ${input.locationName},
        'fixture-address-not-public',
        'Example City',
        'Private fixture note'
      )
    `;
    await sql`
      insert into core.events (
        id,
        playgroup_id,
        title,
        description,
        starts_at,
        location_id,
        visibility,
        invite_token_hash
      )
      values (
        ${eventId},
        ${playgroupId},
        ${input.eventTitle},
        'Public RSVP smoke fixture',
        '2030-06-14 19:00:00+00',
        ${locationId},
        'public_safe',
        ${hashInviteToken(inviteToken)}
      )
    `;
  });

  return {
    eventId,
    inviteToken,
  };
}

async function createOwnedPlaygroupFixture(input: {
  email: string;
  groupName: string;
  description: string;
}) {
  const playgroupId = randomUUID();
  const membershipId = randomUUID();
  const slug = `e2e-${randomUUID().slice(0, 8)}`;

  await withE2eSql(async (sql) => {
    const users = await sql<{ id: string }[]>`
      select id
      from core.users
      where email = ${input.email.toLowerCase()}
      limit 1
    `;
    const userId = users[0]?.id;

    expect(userId).toBeTruthy();

    await sql`
      insert into core.playgroups (
        id,
        name,
        slug,
        description,
        created_by_user_id
      )
      values (
        ${playgroupId},
        ${input.groupName},
        ${slug},
        ${input.description},
        ${userId}
      )
    `;
    await sql`
      insert into core.playgroup_memberships (
        id,
        playgroup_id,
        user_id,
        role,
        display_name
      )
      values (
        ${membershipId},
        ${playgroupId},
        ${userId},
        'owner',
        'Riley Chen'
      )
    `;
  });
}

async function addUserToPlaygroupFixture(input: {
  email: string;
  displayName: string;
  groupName: string;
}) {
  await withE2eSql(async (sql) => {
    const rows = await sql<{ playgroup_id: string; user_id: string }[]>`
      select p.id as playgroup_id, u.id as user_id
      from core.playgroups p
      cross join core.users u
      where p.name = ${input.groupName}
        and u.email = ${input.email.toLowerCase()}
      limit 1
    `;
    const row = rows[0];

    expect(row).toBeTruthy();

    await sql`
      insert into core.playgroup_memberships (
        id,
        playgroup_id,
        user_id,
        role,
        display_name
      )
      values (
        ${randomUUID()},
        ${row?.playgroup_id},
        ${row?.user_id},
        'member',
        ${input.displayName}
      )
      on conflict (playgroup_id, user_id) do update
      set display_name = excluded.display_name,
        role = excluded.role,
        updated_at = now()
    `;
  });
}

async function withE2eSql<T>(
  work: (sql: ReturnType<typeof postgres>) => Promise<T>,
) {
  const sql = postgres(e2eDatabaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

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

test("linked life counter routes require login", async ({ page }) => {
  await page.goto("/events/40000000-0000-4000-8000-000000000001/life");
  await expect(page).toHaveURL(
    /\/login\?next=%2Fevents%2F40000000-0000-4000-8000-000000000001%2Flife$/,
  );

  await page.goto(
    "/events/40000000-0000-4000-8000-000000000001/pods/40000000-0000-4000-8000-000000000002/life",
  );
  await expect(page).toHaveURL(
    /\/login\?next=%2Fevents%2F40000000-0000-4000-8000-000000000001%2Fpods%2F40000000-0000-4000-8000-000000000002%2Flife$/,
  );
});

test("tokenized public event invite shows public-safe planning details", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const { inviteToken } = await createPublicEventFixture({
    eventTitle: `Wednesday Commander Night ${suffix}`,
    groupName: `Example City Commander League ${suffix}`,
    locationName: `Example Tabletop Room ${suffix}`,
  });

  await page.goto(`/invites/events/${inviteToken}`);

  await expect(
    page.getByRole("heading", { name: `Wednesday Commander Night ${suffix}` }),
  ).toBeVisible();
  await expect(
    page.getByText(`Example City Commander League ${suffix}`),
  ).toBeVisible();
  await expect(page.getByText(`Example Tabletop Room ${suffix}`)).toBeVisible();
  await expect(page.getByText("0 players")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Yes" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Waitlist" })).toBeVisible();

  const publicText = await page.locator("body").innerText();

  expect(publicText).not.toContain("fixture-address-not-public");
  expect(publicText).not.toContain("Private fixture note");
  expect(publicText).not.toContain(inviteToken);
  expect(publicText).not.toContain("Example Guest");
});

test("tokenized public event invite submits a guest RSVP and refreshes aggregates", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const { eventId, inviteToken } = await createPublicEventFixture({
    eventTitle: `Wednesday Commander Night ${suffix}`,
    groupName: `Example City Commander League ${suffix}`,
    locationName: `Example Tabletop Room ${suffix}`,
  });

  await page.goto(`/invites/events/${inviteToken}`);
  await page.getByLabel("Name").fill("Robin Vale");
  await page.getByLabel("Status").selectOption("yes");
  await page.getByRole("button", { name: "RSVP" }).click();

  await expect(page.getByRole("row", { name: "Yes 1" })).toBeVisible();
  await expect(page.getByText("1 players")).toBeVisible();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("");

  await withE2eSql(async (sql) => {
    const rows = await sql`
      select guest_name, status
      from core.event_rsvps
      where event_id = ${eventId}
    `;

    expect(rows).toMatchObject([{ guest_name: "Robin Vale", status: "yes" }]);
  });

  const publicText = await page.locator("body").innerText();

  expect(publicText).not.toContain("fixture-address-not-public");
  expect(publicText).not.toContain("Private fixture note");
  expect(publicText).not.toContain(inviteToken);
  expect(publicText).not.toContain("Example Guest");
  expect(publicText).not.toContain("Robin Vale");
});

test("tokenized public event invite fails closed for missing invites", async ({
  page,
}) => {
  await page.goto("/invites/events/wrong-token");

  await expect(
    page.getByRole("heading", { name: "Event invite unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("The invite may be expired, mistyped, or not public-safe."),
  ).toBeVisible();
});

test("signup creates an unverified Better Auth account without signing in", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `signup-smoke-${suffix}@example.test`;

  await page.goto("/signup?next=/life");
  await page.getByLabel("Name").fill("Riley Chen");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(
    page.getByText("Check your email to verify your account."),
  ).toBeVisible();

  await withE2eSql(async (sql) => {
    const rows = await sql`
      select email, name, email_verified
      from core.users
      where email = ${email}
    `;

    expect(rows).toMatchObject([
      {
        email,
        name: "Riley Chen",
        email_verified: false,
      },
    ]);
  });
});

test("verified users can log in and log out through Better Auth", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `login-smoke-${suffix}@example.test`;

  await signUpThroughUi(
    page,
    {
      email,
      name: "Riley Chen",
      password: testPassword,
    },
    "/account",
  );
  await verifyEmailInDatabase(email);
  await logInThroughUi(
    page,
    {
      email,
      password: testPassword,
    },
    "/account",
  );

  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("Session active")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/account");
  await expect(page).toHaveURL("/login?next=%2Faccount");
  await expect(
    page.getByRole("heading", { level: 1, name: "Log In" }),
  ).toBeVisible();
});

test("forgot password form requests a Better Auth reset email", async ({
  page,
}) => {
  let postedResetRequest: unknown = null;

  await page.route("**/api/auth/request-password-reset", async (route) => {
    postedResetRequest = route.request().postDataJSON();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("RILEY@EXAMPLE.TEST");
  await page.getByRole("button", { name: "Send reset link" }).click();

  expect(postedResetRequest).toMatchObject({
    email: "riley@example.test",
    redirectTo: "/reset-password",
  });
  await expect(
    page.getByText(
      "If the account exists, check your email for the reset link.",
    ),
  ).toBeVisible();
});

test("reset password form posts a Better Auth reset token", async ({
  page,
}, testInfo) => {
  const token = `reset-${Date.now()}-${testInfo.workerIndex}`;
  let postedReset: unknown = null;

  await page.route("**/api/auth/reset-password", async (route) => {
    postedReset = route.request().postDataJSON();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await page.getByLabel("New password").fill("fresh-correct-horse-battery");
  await page.getByRole("button", { name: "Update password" }).click();

  expect(postedReset).toMatchObject({
    newPassword: "fresh-correct-horse-battery",
    token,
  });
  await expect(page.getByText("Your password has been updated.")).toBeVisible();
});

test("verification form requests a Better Auth verification email", async ({
  page,
}) => {
  let postedVerification: unknown = null;

  await page.route("**/api/auth/send-verification-email", async (route) => {
    postedVerification = route.request().postDataJSON();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/verify-email");
  await page.getByLabel("Email").fill("RILEY@EXAMPLE.TEST");
  await page.getByRole("button", { name: "Send verification" }).click();

  expect(postedVerification).toMatchObject({
    email: "riley@example.test",
    callbackURL: "/account",
  });
  await expect(
    page.getByText("If verification is available, check your email."),
  ).toBeVisible();
});

test("authenticated users can create and list a playgroup", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `group-smoke-${suffix}@example.test`;
  const groupName = `Friday Pods ${suffix}`;

  await signUpVerifyAndLogin(page, { email, name: "Riley Chen" }, "/groups");

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

test("group owners can edit and archive active playgroups", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `group-edit-smoke-${suffix}@example.test`;
  const groupName = `Editable Pods ${suffix}`;
  const updatedGroupName = `Archived Pods ${suffix}`;

  await signUpVerifyAndLogin(page, { email, name: "Riley Chen" }, "/groups");

  await page.getByLabel("Group Name").fill(groupName);
  await page.getByLabel("Description").fill("Original group note.");
  await page.getByRole("button", { name: "Create Group" }).click();

  let groupCard = page.locator("article").filter({ hasText: groupName });
  await expect(
    groupCard.getByRole("heading", { name: groupName }),
  ).toBeVisible();

  await groupCard.getByLabel("Group Name").fill(updatedGroupName);
  await groupCard.getByLabel("Description").fill("Updated group note.");
  await groupCard.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByText("Group updated.")).toBeVisible();

  await page.reload();
  groupCard = page.locator("article").filter({ hasText: updatedGroupName });
  await expect(
    groupCard.getByRole("heading", { name: updatedGroupName }),
  ).toBeVisible();
  await expect(
    groupCard.getByText("Updated group note.").first(),
  ).toBeVisible();

  await groupCard
    .getByRole("button", { name: `Archive ${updatedGroupName}` })
    .click();
  await expect(
    page.locator("article").filter({ hasText: updatedGroupName }),
  ).toHaveCount(0);
});

test("event managers can manage host locations and attach them to events", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `location-smoke-${suffix}@example.test`;
  const groupName = `Location Pods ${suffix}`;
  const locationName = `Kitchen Table ${suffix}`;
  const updatedLocationName = `Dining Room ${suffix}`;
  const eventTitle = `Location Event ${suffix}`;

  await signUpVerifyAndLogin(page, { email, name: "Riley Chen" }, "/groups");
  await page.getByLabel("Group Name").fill(groupName);
  await page.getByLabel("Description").fill("Host location smoke.");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

  await page.goto("/game-night");

  const locationPanel = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Host Locations" }) })
    .last();

  await locationPanel
    .getByLabel("Playgroup")
    .selectOption({ label: groupName });
  await locationPanel.getByLabel("Location Name").fill(locationName);
  await locationPanel.getByLabel("Address Line 1").fill("303 E2E Fixture Way");
  await locationPanel.getByLabel("City").fill("Playtest City");
  await locationPanel.getByLabel("State").fill("TS");
  await locationPanel.getByLabel("Postal Code").fill("00003");
  await locationPanel.getByLabel("Country").fill("US");
  await locationPanel
    .getByLabel("Location Notes")
    .fill("Private E2E fixture note.");
  await locationPanel.getByRole("button", { name: "Save Location" }).click();
  await expect(locationPanel.getByText("Location saved.")).toBeVisible();

  await page.reload();

  const createEventForm = page
    .locator("form")
    .filter({ hasText: "Create Event" });

  await createEventForm
    .locator('select[name="playgroupId"]')
    .selectOption({ label: groupName });
  await createEventForm.locator('input[name="title"]').fill(eventTitle);
  await createEventForm
    .locator('input[name="startsAt"]')
    .fill("2030-06-14T19:00");
  await createEventForm
    .locator('select[name="visibility"]')
    .selectOption("members");
  await createEventForm.locator('select[name="locationId"]').selectOption({
    label: locationName,
  });
  await createEventForm
    .locator('select[name="addressVisibility"]')
    .selectOption("members");
  await createEventForm.getByRole("button", { name: "Create Event" }).click();

  const eventCard = page.locator("article").filter({ hasText: eventTitle });

  await expect(
    eventCard.getByRole("heading", { name: eventTitle }),
  ).toBeVisible();
  await expect(eventCard.getByText(locationName).first()).toBeVisible();
  await expect(eventCard.getByText("303 E2E Fixture Way")).toBeVisible();
  await expect(eventCard.getByText("Private E2E fixture note.")).toHaveCount(0);
  await expect(eventCard.getByLabel("Edit Host Location")).toBeVisible();
  await expect(eventCard.getByLabel("Edit Address Visibility")).toHaveValue(
    "members",
  );

  await locationPanel
    .locator('input[name="name"]')
    .nth(1)
    .fill(updatedLocationName);
  await locationPanel.getByRole("button", { name: "Update Location" }).click();
  await expect(locationPanel.getByText("Location updated.")).toBeVisible();

  await page.reload();
  await expect(
    page
      .locator("article")
      .filter({ hasText: eventTitle })
      .getByText(updatedLocationName)
      .first(),
  ).toBeVisible();

  await page
    .locator("section")
    .filter({ hasText: "Host Locations" })
    .getByRole("button", { name: "Archive Location" })
    .click();
  await expect(page.getByText("No saved host locations")).toBeVisible();

  await expect(
    page
      .locator("form")
      .filter({ hasText: "Create Event" })
      .getByLabel("Host Location")
      .locator("option", { hasText: updatedLocationName }),
  ).toHaveCount(0);
});

test("group owners can create, list, and revoke invite links", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `group-invite-smoke-${suffix}@example.test`;
  const groupName = `Invite Pods ${suffix}`;

  await signUpVerifyAndLogin(page, { email, name: "Riley Chen" }, "/groups");
  await createOwnedPlaygroupFixture({
    email,
    groupName,
    description: "Invite management smoke.",
  });
  await page.goto("/groups");

  await expect(page).toHaveURL("/groups");

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

  await expect(
    groupCard.getByText("Active member invite").first(),
  ).toBeVisible();
  await expect(groupCard.getByText("0 uses").first()).toBeVisible();
  await expect(
    groupCard.getByRole("button", { name: "Revoke Invite" }).first(),
  ).toBeVisible();

  await groupCard
    .getByRole("button", { name: "Revoke Invite" })
    .first()
    .click();
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

  await signUpVerifyAndLogin(
    page,
    { email: ownerEmail, name: "Riley Owner" },
    "/groups",
  );

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

  await signUpVerifyAndLogin(
    invitePage,
    { email: memberEmail, name: "Mina Rules" },
    invitePath,
  );
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

test("event managers can move and publish pod assignments", async ({
  browser,
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const ownerEmail = `pod-move-owner-${suffix}@example.test`;
  const observerEmail = `pod-observer-${suffix}@example.test`;
  const outsiderEmail = `pod-outsider-${suffix}@example.test`;
  const groupName = `Move Pods ${suffix}`;
  const eventTitle = `Manual Pod Move ${suffix}`;
  const podLifeHrefPattern = /\/events\/[0-9a-f-]+\/pods\/[0-9a-f-]+\/life$/;

  await signUpVerifyAndLogin(
    page,
    { email: ownerEmail, name: "Player A" },
    "/groups",
  );

  await expect(page).toHaveURL("/groups");
  await page.getByLabel("Group Name").fill(groupName);
  await page.getByLabel("Description").fill("Manual pod movement smoke.");
  await page.getByRole("button", { name: "Create Group" }).click();

  const groupCard = page.locator("article").filter({ hasText: groupName });

  await groupCard.getByRole("button", { name: "Create Invite" }).click();
  const invitePath = await groupCard
    .getByRole("link", { name: /\/invites\/groups\// })
    .innerText();

  await page.goto("/game-night");
  await page
    .locator('select[name="playgroupId"]')
    .selectOption({ label: groupName });
  await page.getByLabel("Event Title").fill(eventTitle);
  await page.getByLabel("Start").fill("2030-06-14T19:00");
  await page.getByLabel("Visibility").selectOption("members");
  await page.getByLabel("Description").fill("Seven players make two pods.");
  await page.getByRole("button", { name: "Create Event" }).click();

  let eventCard = page.locator("article").filter({ hasText: eventTitle });

  await expect(
    eventCard.getByRole("heading", { name: eventTitle }),
  ).toBeVisible();
  await eventCard.getByLabel("RSVP Status").selectOption("yes");
  await eventCard.getByRole("button", { name: "Save RSVP" }).click();
  await expect(eventCard.getByText("RSVP saved.")).toBeVisible();

  for (const playerName of [
    "Player B",
    "Player C",
    "Player D",
    "Player E",
    "Player F",
    "Player G",
  ]) {
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberEmail = `${playerName.toLowerCase().replaceAll(" ", "-")}-${suffix}@example.test`;

    await signUpVerifyAndLogin(
      memberPage,
      { email: memberEmail, name: playerName },
      invitePath,
    );
    await addUserToPlaygroupFixture({
      email: memberEmail,
      displayName: playerName,
      groupName,
    });
    await memberPage.goto("/groups");
    await expect(memberPage).toHaveURL("/groups");

    await memberPage.goto("/game-night");
    const memberEventCard = memberPage
      .locator("article")
      .filter({ hasText: eventTitle });

    await expect(
      memberEventCard.getByRole("heading", { name: eventTitle }),
    ).toBeVisible();
    await memberEventCard.getByLabel("RSVP Status").selectOption("yes");
    await memberEventCard.getByRole("button", { name: "Save RSVP" }).click();
    await expect(memberEventCard.getByText("RSVP saved.")).toBeVisible();
    await memberContext.close();
  }

  await page.goto("/game-night");
  eventCard = page.locator("article").filter({ hasText: eventTitle });
  await eventCard.getByRole("button", { name: "Generate Draft Pods" }).click();
  await expect(eventCard.getByText("Generated 2 draft pods.")).toBeVisible();

  const podOne = eventCard.getByLabel("Pod 1 pod assignment");
  const podTwo = eventCard.getByLabel("Pod 2 pod assignment");

  await expect(podOne.locator("li").first()).toBeVisible();
  const movableSeat = podTwo.locator("li").first();
  const movablePlayerName = await movableSeat.locator("p").first().innerText();

  await expect(movableSeat).toBeVisible();
  await expect(
    eventCard.getByRole("link", { name: "Launch Pod 1 life counter" }),
  ).toHaveCount(0);

  let movablePlayerSeat = podTwo
    .locator("li")
    .filter({ hasText: movablePlayerName });

  await movablePlayerSeat
    .getByRole("button", { name: `Lock ${movablePlayerName}` })
    .click();
  await expect(
    movablePlayerSeat.getByText(`Locked ${movablePlayerName}.`),
  ).toBeVisible();
  await expect(movablePlayerSeat.getByText("Locked seat")).toBeVisible();
  await expect(
    movablePlayerSeat.getByLabel(`Move ${movablePlayerName} to pod`),
  ).toHaveCount(0);
  await eventCard.getByRole("button", { name: "Generate Draft Pods" }).click();
  await expect(
    eventCard.getByText("Unlock draft pod seats before regenerating pods."),
  ).toBeVisible();

  await movablePlayerSeat
    .getByRole("button", { name: `Unlock ${movablePlayerName}` })
    .click();
  await expect(
    movablePlayerSeat.getByText(`Unlocked ${movablePlayerName}.`),
  ).toBeVisible();
  await expect(movablePlayerSeat.getByText("Locked seat")).toHaveCount(0);
  await expect(
    movablePlayerSeat.getByLabel(`Move ${movablePlayerName} to pod`),
  ).toBeVisible();

  await movablePlayerSeat
    .getByLabel(`Move ${movablePlayerName} to pod`)
    .selectOption({
      label: "Pod 1",
    });
  await movablePlayerSeat
    .getByLabel(`Move ${movablePlayerName} to seat`)
    .fill("2");
  await movablePlayerSeat
    .getByRole("button", { name: `Move ${movablePlayerName}` })
    .click();
  await expect(
    podOne.locator("li").filter({ hasText: movablePlayerName }),
  ).toBeVisible();

  await page.reload();
  eventCard = page.locator("article").filter({ hasText: eventTitle });
  movablePlayerSeat = eventCard
    .getByLabel("Pod 1 pod assignment")
    .locator("li")
    .filter({ hasText: movablePlayerName });

  await expect(movablePlayerSeat).toBeVisible();
  await expect(movablePlayerSeat.getByText("Locked seat")).toHaveCount(0);
  await expect(
    eventCard
      .getByLabel("Pod 2 pod assignment")
      .locator("li")
      .filter({ hasText: movablePlayerName }),
  ).toHaveCount(0);

  await eventCard.getByRole("button", { name: "Publish Pods" }).click();
  await expect(eventCard.getByText("Pod assignments published.")).toBeVisible();
  await expect(
    eventCard.getByRole("heading", { name: "Published Pods" }),
  ).toBeVisible();
  await expect(
    eventCard.getByRole("button", { name: "Unpublish Pods" }),
  ).toBeVisible();
  await expect(
    eventCard.getByLabel(`Move ${movablePlayerName} to pod`),
  ).toHaveCount(0);
  await expect(
    eventCard.getByRole("link", { name: "Launch Pod 1 life counter" }),
  ).toHaveAttribute("href", podLifeHrefPattern);
  await expect(
    eventCard.getByRole("link", { name: "Launch Pod 2 life counter" }),
  ).toHaveAttribute("href", podLifeHrefPattern);

  await page.reload();
  eventCard = page.locator("article").filter({ hasText: eventTitle });
  await expect(
    eventCard.getByRole("heading", { name: "Published Pods" }),
  ).toBeVisible();
  await expect(
    eventCard
      .getByLabel("Pod 1 pod assignment")
      .locator("li")
      .filter({ hasText: movablePlayerName }),
  ).toBeVisible();
  await expect(
    eventCard.getByRole("link", { name: "Launch Pod 1 life counter" }),
  ).toHaveAttribute("href", podLifeHrefPattern);

  const observerContext = await browser.newContext();
  const observerPage = await observerContext.newPage();

  await signUpVerifyAndLogin(
    observerPage,
    { email: observerEmail, name: "Observer H" },
    invitePath,
  );
  await addUserToPlaygroupFixture({
    email: observerEmail,
    displayName: "Observer H",
    groupName,
  });
  await observerPage.goto("/groups");
  await expect(observerPage).toHaveURL("/groups");
  await observerPage.goto("/game-night");

  const observerEventCard = observerPage
    .locator("article")
    .filter({ hasText: eventTitle });

  await expect(
    observerEventCard.getByRole("heading", { name: "Published Pods" }),
  ).toBeVisible();
  await expect(
    observerEventCard
      .getByLabel("Pod 1 pod assignment")
      .locator("li")
      .filter({ hasText: movablePlayerName }),
  ).toBeVisible();
  await expect(
    observerEventCard.getByRole("button", { name: "Unpublish Pods" }),
  ).toHaveCount(0);
  await expect(
    observerEventCard.getByRole("button", { name: "Publish Pods" }),
  ).toHaveCount(0);
  await expect(
    observerEventCard.getByRole("link", {
      name: "Launch Pod 1 life counter",
    }),
  ).toHaveAttribute("href", podLifeHrefPattern);
  await observerContext.close();

  const outsiderContext = await browser.newContext();
  const outsiderPage = await outsiderContext.newPage();

  await signUpVerifyAndLogin(
    outsiderPage,
    { email: outsiderEmail, name: "Outsider" },
    "/game-night",
  );
  await expect(outsiderPage).toHaveURL("/game-night");
  await expect(outsiderPage.getByText(eventTitle)).toHaveCount(0);
  await outsiderContext.close();

  await eventCard.getByRole("button", { name: "Unpublish Pods" }).click();
  await expect(
    eventCard.getByText("Pod assignments returned to draft."),
  ).toBeVisible();
  await expect(
    eventCard.getByRole("heading", { name: "Draft Pods" }),
  ).toBeVisible();
  await expect(
    eventCard.getByLabel(`Move ${movablePlayerName} to pod`),
  ).toBeVisible();
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

  await signUpVerifyAndLogin(page, { email, name: "Riley Chen" }, "/groups");

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
  await expect(eventCard.getByRole("heading", { name: "Pod 1" })).toBeVisible();
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
