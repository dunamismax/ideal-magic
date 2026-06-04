import { describe, expect, test } from "vitest";

import {
  validateChangeGroupMemberRoleInput,
  validateRemoveGroupMemberInput,
} from "./group-member-management";

describe("group member management validation", () => {
  test("accepts UUID-backed role and removal action inputs", () => {
    expect(
      validateChangeGroupMemberRoleInput({
        membershipId: "20000000-0000-4000-8000-000000000001",
        role: "host",
      }),
    ).toEqual({
      ok: true,
      input: {
        membershipId: "20000000-0000-4000-8000-000000000001",
        role: "host",
      },
    });
    expect(
      validateRemoveGroupMemberInput({
        membershipId: "20000000-0000-4000-8000-000000000002",
      }),
    ).toEqual({
      ok: true,
      input: {
        membershipId: "20000000-0000-4000-8000-000000000002",
      },
    });
  });

  test("rejects missing identifiers and unmanaged roles", () => {
    expect(
      validateChangeGroupMemberRoleInput({
        membershipId: "not-a-membership",
        role: "guest",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        membershipId: "Choose a group member.",
        role: "Choose an allowed role.",
      },
      fields: {
        membershipId: "not-a-membership",
        role: "guest",
      },
    });
    expect(
      validateRemoveGroupMemberInput({
        membershipId: " ",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        membershipId: "Choose a group member.",
      },
      fields: {
        membershipId: "",
      },
    });
  });
});
