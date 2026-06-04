"use client";

import { Save, UserMinus } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { PlaygroupRole } from "@/db/scopes";
import type { ViewerPlaygroupMember } from "@/db/queries/playgroups";
import {
  type ChangeGroupMemberRoleActionState,
  changeGroupMemberRoleAction,
  type RemoveGroupMemberActionState,
  removeGroupMemberAction,
} from "./actions";

type GroupMemberManagementPanelProps = {
  member: ViewerPlaygroupMember;
  viewerRole: PlaygroupRole;
};

const ownerRoleOptions = ["owner", "admin", "host", "member"] as const;
const adminRoleOptions = ["host", "member"] as const;

export function GroupMemberManagementPanel({
  member,
  viewerRole,
}: GroupMemberManagementPanelProps) {
  if (!member.canChangeRole && !member.canRemove) {
    return null;
  }

  const roleOptions =
    viewerRole === "owner" ? ownerRoleOptions : adminRoleOptions;

  return (
    <div className="mt-3 grid gap-2 border-t border-border pt-3">
      {member.canChangeRole ? (
        <RoleChangeForm member={member} roleOptions={roleOptions} />
      ) : null}
      {member.canRemove ? <RemoveMemberForm member={member} /> : null}
    </div>
  );
}

function RoleChangeForm({
  member,
  roleOptions,
}: {
  member: ViewerPlaygroupMember;
  roleOptions: readonly ViewerPlaygroupMember["role"][];
}) {
  const [state, formAction] = useActionState(
    changeGroupMemberRoleAction,
    createInitialChangeRoleState(member),
  );

  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input name="membershipId" type="hidden" value={member.id} />
      <label className="grid gap-1 text-xs font-bold uppercase text-muted">
        Role
        <select
          className="h-9 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
          defaultValue={member.role}
          name="role"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <SaveRoleButton />
      {state.message ? (
        <ActionMessage saved={state.saved} message={state.message} />
      ) : null}
    </form>
  );
}

function RemoveMemberForm({ member }: { member: ViewerPlaygroupMember }) {
  const [state, formAction] = useActionState(
    removeGroupMemberAction,
    createInitialRemoveState(member),
  );

  return (
    <form action={formAction} className="grid gap-2 sm:justify-items-start">
      <input name="membershipId" type="hidden" value={member.id} />
      <RemoveMemberButton memberName={member.displayName} />
      {state.message ? (
        <ActionMessage saved={state.saved} message={state.message} />
      ) : null}
    </form>
  );
}

function SaveRoleButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="sm" type="submit" variant="secondary">
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Saving" : "Save Role"}
    </Button>
  );
}

function RemoveMemberButton({ memberName }: { memberName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`Remove ${memberName}`}
      disabled={pending}
      size="sm"
      type="submit"
      variant="danger"
    >
      <UserMinus className="size-4" aria-hidden="true" />
      {pending ? "Removing" : "Remove"}
    </Button>
  );
}

function ActionMessage({
  saved,
  message,
}: {
  saved: boolean;
  message: string;
}) {
  return (
    <p
      className={`text-xs font-bold ${saved ? "text-accent" : "text-danger"}`}
      role={saved ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

function createInitialChangeRoleState(
  member: ViewerPlaygroupMember,
): ChangeGroupMemberRoleActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      membershipId: member.id,
      role: member.role,
    },
  };
}

function createInitialRemoveState(
  member: ViewerPlaygroupMember,
): RemoveGroupMemberActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      membershipId: member.id,
    },
  };
}
