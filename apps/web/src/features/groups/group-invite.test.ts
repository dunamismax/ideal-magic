import { describe, expect, test } from "vitest";

import {
  validateCreateGroupInviteInput,
  validateRevokeGroupInviteInput,
} from "./group-invite";

describe("group invite validation", () => {
  test("accepts UUID-backed invite action inputs", () => {
    expect(
      validateCreateGroupInviteInput({
        playgroupId: "20000000-0000-4000-8000-000000000001",
      }),
    ).toEqual({
      ok: true,
      input: {
        playgroupId: "20000000-0000-4000-8000-000000000001",
      },
    });
    expect(
      validateRevokeGroupInviteInput({
        inviteId: "20000000-0000-4000-8000-000000000002",
      }),
    ).toEqual({
      ok: true,
      input: {
        inviteId: "20000000-0000-4000-8000-000000000002",
      },
    });
  });

  test("rejects missing or malformed identifiers", () => {
    expect(
      validateCreateGroupInviteInput({
        playgroupId: "not-a-group",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        playgroupId: "Choose a group.",
      },
      fields: {
        playgroupId: "not-a-group",
      },
    });
    expect(
      validateRevokeGroupInviteInput({
        inviteId: " ",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        inviteId: "Choose an invite.",
      },
      fields: {
        inviteId: "",
      },
    });
  });
});
