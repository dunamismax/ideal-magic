import { describe, expect, test } from "vitest";

import {
  canManageEvent,
  canManagePlaygroup,
  canViewPlaygroupMembers,
  canSeeHostAddress,
  isPlaygroupMemberDirectoryRole,
} from "./scopes";

describe("database scope helpers", () => {
  test("limits management to host or admin roles", () => {
    expect(canManagePlaygroup("owner")).toBe(true);
    expect(canManagePlaygroup("admin")).toBe(true);
    expect(canManagePlaygroup("host")).toBe(false);

    expect(canManageEvent("owner")).toBe(true);
    expect(canManageEvent("admin")).toBe(true);
    expect(canManageEvent("host")).toBe(true);
    expect(canManageEvent("viewer")).toBe(false);
  });

  test("keeps host address visibility scoped by role and RSVP state", () => {
    expect(canSeeHostAddress(null, "members", "yes")).toBe(false);
    expect(canSeeHostAddress("guest", "members", "yes")).toBe(false);
    expect(canSeeHostAddress("member", "members")).toBe(true);
    expect(canSeeHostAddress("member", "rsvps", "no")).toBe(false);
    expect(canSeeHostAddress("member", "rsvps", "maybe")).toBe(true);
    expect(canSeeHostAddress("viewer", "public")).toBe(true);
    expect(canSeeHostAddress("owner", "hidden", "yes")).toBe(false);
  });

  test("limits member directory visibility to real playgroup members", () => {
    expect(canViewPlaygroupMembers("owner")).toBe(true);
    expect(canViewPlaygroupMembers("admin")).toBe(true);
    expect(canViewPlaygroupMembers("host")).toBe(true);
    expect(canViewPlaygroupMembers("member")).toBe(true);
    expect(canViewPlaygroupMembers("guest")).toBe(false);
    expect(canViewPlaygroupMembers("viewer")).toBe(false);

    expect(isPlaygroupMemberDirectoryRole("member")).toBe(true);
    expect(isPlaygroupMemberDirectoryRole("guest")).toBe(false);
  });
});
