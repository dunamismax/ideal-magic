"use client";

import { AlertCircle, Ban, CheckCircle2, Link2, Plus } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { ViewerPlaygroupInvite } from "@/db/queries/playgroups";
import {
  createGroupInviteAction,
  type CreateGroupInviteActionState,
  revokeGroupInviteAction,
  type RevokeGroupInviteActionState,
} from "./actions";

type GroupInvitePanelProps = {
  groupId: string;
  groupName: string;
  invites: ViewerPlaygroupInvite[];
};

export function GroupInvitePanel({
  groupId,
  groupName,
  invites,
}: GroupInvitePanelProps) {
  const [createState, createAction] = useActionState(
    createGroupInviteAction,
    createInitialInviteState(groupId),
  );
  const createdInvitePath =
    createState.createdInvite?.playgroupId === groupId
      ? `/invites/groups/${createState.createdInvite.inviteToken}`
      : null;

  return (
    <section
      aria-labelledby={`group-${groupId}-invites`}
      className="mt-4 rounded-control border border-border bg-background p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            className="flex items-center gap-2 text-xs font-bold uppercase text-muted"
            id={`group-${groupId}-invites`}
          >
            <Link2 className="size-4 text-accent" aria-hidden="true" />
            Invite Links
          </h3>
          <p className="mt-1 text-xs font-semibold text-muted">
            {invites.filter((invite) => invite.isActive).length} active for{" "}
            {groupName}
          </p>
        </div>

        <form action={createAction}>
          <input name="playgroupId" type="hidden" value={groupId} />
          <CreateInviteButton />
        </form>
      </div>

      {createState.message ? (
        <ActionMessage
          kind={createState.saved ? "success" : "error"}
          message={createState.message}
        />
      ) : null}

      {createdInvitePath ? (
        <div className="mt-3 rounded-control border border-accent/40 bg-accent/10 p-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-accent">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            New Invite
          </p>
          <a
            className="mt-2 block break-all rounded-control border border-border bg-surface px-3 py-2 text-sm font-bold text-foreground hover:text-accent"
            href={createdInvitePath}
          >
            {createdInvitePath}
          </a>
        </div>
      ) : null}

      {invites.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {invites.map((invite) => (
            <InviteListItem invite={invite} key={invite.id} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-control border border-dashed border-border bg-surface px-3 py-2 text-sm font-semibold text-muted">
          No invites created.
        </p>
      )}
    </section>
  );
}

function InviteListItem({ invite }: { invite: ViewerPlaygroupInvite }) {
  return (
    <li className="flex flex-col gap-3 rounded-control border border-border bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold">
          {invite.isActive ? "Active" : "Revoked"} {invite.role} invite
        </p>
        <p className="text-xs font-semibold text-muted">
          Created {formatInviteDate(invite.createdAt)} · {invite.usedCount} uses
        </p>
      </div>

      {invite.isActive ? (
        <RevokeInviteForm inviteId={invite.id} />
      ) : (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
          <Ban className="size-3.5" aria-hidden="true" />
          Revoked
        </span>
      )}
    </li>
  );
}

function RevokeInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction] = useActionState(
    revokeGroupInviteAction,
    createInitialRevokeState(inviteId),
  );

  return (
    <form action={formAction} className="grid gap-2 sm:justify-items-end">
      <input name="inviteId" type="hidden" value={inviteId} />
      <RevokeInviteButton />
      {state.message ? (
        <p
          className={`text-xs font-bold ${state.saved ? "text-accent" : "text-danger"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function CreateInviteButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="sm" type="submit" variant="primary">
      <Plus className="size-4" aria-hidden="true" />
      {pending ? "Creating" : "Create Invite"}
    </Button>
  );
}

function RevokeInviteButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="sm" type="submit" variant="danger">
      <Ban className="size-4" aria-hidden="true" />
      {pending ? "Revoking" : "Revoke Invite"}
    </Button>
  );
}

function ActionMessage({
  kind,
  message,
}: {
  kind: "success" | "error";
  message: string;
}) {
  const isSuccess = kind === "success";

  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-control border p-3 text-sm font-semibold ${
        isSuccess
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
      role={isSuccess ? "status" : "alert"}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  );
}

function createInitialInviteState(
  groupId: string,
): CreateGroupInviteActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      playgroupId: groupId,
    },
    createdInvite: null,
  };
}

function createInitialRevokeState(
  inviteId: string,
): RevokeGroupInviteActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      inviteId,
    },
  };
}

function formatInviteDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
