import { describe, expect, test } from "vitest";

import { toSafeAuditMetadata } from "./audit";

describe("audit metadata", () => {
  test("keeps small scoped metadata and strips sensitive values", () => {
    expect(
      toSafeAuditMetadata({
        previousRole: "member",
        newRole: "host",
        alreadyRevoked: false,
        targetUserId: "20000000-0000-4000-8000-000000000001",
        bad_key: "kept because it is not sensitive",
        inviteToken: "raw-invite-token",
        tokenHash: "stored-token-hash",
        hostAddress: "101 Example Tabletop Way",
        notes: "Private note",
        email: "host@example.test",
        phoneNumber: "555-0100",
        rawPayload: { addressLine1: "101 Example Tabletop Way" },
        reference: "host@example.test",
        secretValue: "abcdefghijklmnopqrstuvwxyz123456",
        nested: { role: "admin" },
      }),
    ).toEqual({
      previousRole: "member",
      newRole: "host",
      alreadyRevoked: false,
      targetUserId: "20000000-0000-4000-8000-000000000001",
      bad_key: "kept because it is not sensitive",
    });
  });
});
