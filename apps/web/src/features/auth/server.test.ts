import { describe, expect, test } from "vitest";

import { getLoginRedirectPath } from "./server";

describe("auth server helpers", () => {
  test("builds a login redirect for safe local paths", () => {
    expect(getLoginRedirectPath("/game-night")).toBe(
      "/login?next=%2Fgame-night",
    );
  });

  test("rejects external or malformed next paths", () => {
    expect(getLoginRedirectPath("https://example.test/account")).toBe(
      "/login?next=%2Faccount",
    );
    expect(getLoginRedirectPath("//example.test/account")).toBe(
      "/login?next=%2Faccount",
    );
    expect(getLoginRedirectPath("account")).toBe("/login?next=%2Faccount");
  });
});
