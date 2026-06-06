"use client";

import { AlertCircle, Archive, CheckCircle2, Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import type { ViewerPlaygroupListItem } from "@/db/queries/playgroups";
import {
  archiveGroupAction,
  type ArchiveGroupActionState,
  updateGroupAction,
  type UpdateGroupActionState,
} from "./actions";

type GroupManagementPanelProps = {
  group: ViewerPlaygroupListItem;
};

export function GroupManagementPanel({ group }: GroupManagementPanelProps) {
  const [updateState, updateAction] = useActionState(
    updateGroupAction,
    createInitialUpdateState(group),
  );
  const [archiveState, archiveAction] = useActionState(
    archiveGroupAction,
    createInitialArchiveState(group),
  );

  return (
    <section
      aria-labelledby={`group-${group.id}-settings`}
      className="mt-4 rounded-control border border-border bg-background p-3"
    >
      <h3
        className="flex items-center gap-2 text-xs font-bold uppercase text-muted"
        id={`group-${group.id}-settings`}
      >
        <Save className="size-4 text-accent" aria-hidden="true" />
        Group Settings
      </h3>

      <form action={updateAction} className="mt-3 grid gap-3">
        <input name="playgroupId" type="hidden" value={group.id} />
        <StatusMessage
          message={updateState.message}
          saved={updateState.saved}
        />

        <FormField label="Group Name" error={updateState.fieldErrors.name}>
          <input
            className={fieldControlClassName}
            defaultValue={updateState.fields.name}
            maxLength={80}
            name="name"
            required
          />
        </FormField>

        <FormField
          label="Description"
          error={updateState.fieldErrors.description}
        >
          <textarea
            className={`${fieldControlClassName} min-h-20 resize-y py-2`}
            defaultValue={updateState.fields.description}
            maxLength={500}
            name="description"
          />
        </FormField>

        {updateState.fieldErrors.playgroupId ? (
          <p className="text-sm font-semibold text-danger">
            {updateState.fieldErrors.playgroupId}
          </p>
        ) : null}

        <SaveGroupButton />
      </form>

      {group.role === "owner" ? (
        <form
          action={archiveAction}
          className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3"
        >
          <input name="playgroupId" type="hidden" value={group.id} />
          <ArchiveGroupButton groupName={group.name} />
          <StatusMessage
            message={archiveState.message}
            saved={archiveState.saved}
          />
          {archiveState.fieldErrors.playgroupId ? (
            <p className="text-sm font-semibold text-danger">
              {archiveState.fieldErrors.playgroupId}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

function SaveGroupButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="sm" type="submit" variant="secondary">
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Saving" : "Save Group"}
    </Button>
  );
}

function ArchiveGroupButton({ groupName }: { groupName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`Archive ${groupName}`}
      disabled={pending}
      size="sm"
      type="submit"
      variant="danger"
    >
      <Archive className="size-4" aria-hidden="true" />
      {pending ? "Archiving" : "Archive Group"}
    </Button>
  );
}

function StatusMessage({
  saved,
  message,
}: {
  saved: boolean;
  message: string | null;
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={`flex items-center gap-1.5 text-sm font-bold ${
        saved ? "text-accent" : "text-danger"
      }`}
      role={saved ? "status" : "alert"}
    >
      {saved ? (
        <CheckCircle2 className="size-4" aria-hidden="true" />
      ) : (
        <AlertCircle className="size-4" aria-hidden="true" />
      )}
      <span>{message}</span>
    </p>
  );
}

function createInitialUpdateState(
  group: ViewerPlaygroupListItem,
): UpdateGroupActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      playgroupId: group.id,
      name: group.name,
      description: group.description,
    },
  };
}

function createInitialArchiveState(
  group: ViewerPlaygroupListItem,
): ArchiveGroupActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      playgroupId: group.id,
    },
  };
}
