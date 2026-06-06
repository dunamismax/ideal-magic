import { describe, expect, test } from "vitest";

import {
  createPlaygroupSlugBase,
  validateArchiveGroupInput,
  validateCreateGroupInput,
  validateUpdateGroupInput,
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

  test("normalizes valid group update input without changing slug data", () => {
    expect(
      validateUpdateGroupInput({
        playgroupId: "20000000-0000-4000-8000-000000000001",
        name: "  Renamed   Commander Crew  ",
        description: "  New planning note. ",
      }),
    ).toEqual({
      ok: true,
      input: {
        playgroupId: "20000000-0000-4000-8000-000000000001",
        name: "Renamed Commander Crew",
        description: "New planning note.",
      },
    });
  });

  test("rejects invalid group update and archive identifiers", () => {
    expect(
      validateUpdateGroupInput({
        playgroupId: "not-a-group",
        name: "",
        description: "x".repeat(501),
      }),
    ).toEqual({
      ok: false,
      fields: {
        playgroupId: "not-a-group",
        name: "",
        description: "x".repeat(501),
      },
      fieldErrors: {
        playgroupId: "Choose a group to edit.",
        name: "Name is required.",
        description: "Use 500 characters or fewer.",
      },
    });

    expect(validateArchiveGroupInput({ playgroupId: "not-a-group" })).toEqual({
      ok: false,
      fields: {
        playgroupId: "not-a-group",
      },
      fieldErrors: {
        playgroupId: "Choose a group to archive.",
      },
    });
  });
});
