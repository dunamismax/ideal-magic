import { describe, expect, test } from "vitest";

import {
  createPlaygroupSlugBase,
  validateCreateGroupInput,
} from "./group-form";

describe("group form validation", () => {
  test("normalizes valid group input and creates a stable slug base", () => {
    expect(
      validateCreateGroupInput({
        name: "  Thursday   Commander Crew  ",
        description: "  Low salt.  Plenty of snacks. ",
      }),
    ).toEqual({
      ok: true,
      input: {
        name: "Thursday Commander Crew",
        description: "Low salt. Plenty of snacks.",
        slugBase: "thursday-commander-crew",
      },
    });
  });

  test("rejects blank and oversized group input", () => {
    expect(
      validateCreateGroupInput({
        name: " ",
        description: "x".repeat(501),
      }),
    ).toEqual({
      ok: false,
      fields: {
        name: "",
        description: "x".repeat(501),
      },
      fieldErrors: {
        name: "Name is required.",
        description: "Use 500 characters or fewer.",
      },
    });
  });

  test("slugifies punctuation and diacritics without creating empty slugs", () => {
    expect(createPlaygroupSlugBase("Riku's Café Table!!")).toBe(
      "riku-s-cafe-table",
    );
    expect(createPlaygroupSlugBase("!!!")).toBe("playgroup");
  });
});
