import type { PlaygroupRole } from "@/db/scopes";
import { isPlaygroupMemberDirectoryRole } from "@/db/scopes";

export type ManageablePlaygroupRole = "owner" | "admin" | "host" | "member";

export type ChangeGroupMemberRoleInput = {
  membershipId: string;
  role: ManageablePlaygroupRole;
};

export type RemoveGroupMemberInput = {
  membershipId: string;
};

export type ChangeGroupMemberRoleValidationResult =
  | {
      ok: true;
      input: ChangeGroupMemberRoleInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof ChangeGroupMemberRoleInput, string>>;
      fields: {
        membershipId: string;
        role: string;
      };
    };

export type RemoveGroupMemberValidationResult =
  | {
      ok: true;
      input: RemoveGroupMemberInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof RemoveGroupMemberInput, string>>;
      fields: RemoveGroupMemberInput;
    };

export const manageablePlaygroupRoles = [
  "owner",
  "admin",
  "host",
  "member",
] as const;

export function validateChangeGroupMemberRoleInput(
  rawInput: Partial<
    Record<keyof ChangeGroupMemberRoleInput, FormDataEntryValue | string>
  >,
): ChangeGroupMemberRoleValidationResult {
  const fields = {
    membershipId: normalizeText(rawInput.membershipId),
    role: normalizeText(rawInput.role),
  };
  const fieldErrors: Partial<Record<keyof ChangeGroupMemberRoleInput, string>> =
    {};
  const role = parseManageablePlaygroupRole(fields.role);

  if (!isUuid(fields.membershipId)) {
    fieldErrors.membershipId = "Choose a group member.";
  }

  if (!role) {
    fieldErrors.role = "Choose an allowed role.";
  }

  if (Object.keys(fieldErrors).length > 0 || !role) {
    return {
      ok: false,
      fieldErrors,
      fields,
    };
  }

  return {
    ok: true,
    input: {
      membershipId: fields.membershipId,
      role,
    },
  };
}

export function validateRemoveGroupMemberInput(
  rawInput: Partial<
    Record<keyof RemoveGroupMemberInput, FormDataEntryValue | string>
  >,
): RemoveGroupMemberValidationResult {
  const fields = {
    membershipId: normalizeText(rawInput.membershipId),
  };

  if (!isUuid(fields.membershipId)) {
    return {
      ok: false,
      fieldErrors: {
        membershipId: "Choose a group member.",
      },
      fields,
    };
  }

  return {
    ok: true,
    input: fields,
  };
}

export function isManageablePlaygroupRole(
  role: string | PlaygroupRole,
): role is ManageablePlaygroupRole {
  return isPlaygroupMemberDirectoryRole(role as PlaygroupRole);
}

function parseManageablePlaygroupRole(
  role: string,
): ManageablePlaygroupRole | null {
  return isManageablePlaygroupRole(role) ? role : null;
}

function normalizeText(value: FormDataEntryValue | string | undefined) {
  return String(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
