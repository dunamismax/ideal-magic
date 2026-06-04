"use client";

import { AlertCircle, CalendarPlus } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { createEventAction, type CreateEventActionState } from "./actions";

export type EventFormPlaygroup = {
  id: string;
  name: string;
};

function createInitialState(
  playgroups: EventFormPlaygroup[],
): CreateEventActionState {
  return {
    message: null,
    fieldErrors: {},
    fields: {
      playgroupId: playgroups[0]?.id ?? "",
      title: "",
      startsAt: "",
      description: "",
      visibility: "members",
    },
  };
}

export function CreateEventForm({
  playgroups,
}: {
  playgroups: EventFormPlaygroup[];
}) {
  const [state, formAction] = useActionState(
    createEventAction,
    createInitialState(playgroups),
  );
  const disabled = playgroups.length === 0;

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="text-base font-bold">Create Event</h2>
      </div>

      {state.message ? (
        <div
          className="flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <FormField label="Playgroup" error={state.fieldErrors.playgroupId}>
        <select
          className={fieldControlClassName}
          defaultValue={state.fields.playgroupId}
          disabled={disabled}
          name="playgroupId"
          required
        >
          {playgroups.length > 0 ? (
            playgroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))
          ) : (
            <option value="">Create a group first</option>
          )}
        </select>
      </FormField>

      <FormField label="Event Title" error={state.fieldErrors.title}>
        <input
          className={fieldControlClassName}
          defaultValue={state.fields.title}
          disabled={disabled}
          maxLength={100}
          name="title"
          required
        />
      </FormField>

      <FormField label="Start" error={state.fieldErrors.startsAt}>
        <input
          className={fieldControlClassName}
          defaultValue={state.fields.startsAt}
          disabled={disabled}
          name="startsAt"
          required
          type="datetime-local"
        />
      </FormField>

      <FormField label="Visibility" error={state.fieldErrors.visibility}>
        <select
          className={fieldControlClassName}
          defaultValue={state.fields.visibility}
          disabled={disabled}
          name="visibility"
          required
        >
          <option value="members">Members</option>
          <option value="invite_only">Invite Only</option>
          <option value="public_safe">Public Safe</option>
        </select>
      </FormField>

      <FormField label="Description" error={state.fieldErrors.description}>
        <textarea
          className={`${fieldControlClassName} min-h-24 resize-y py-2`}
          defaultValue={state.fields.description}
          disabled={disabled}
          maxLength={1000}
          name="description"
        />
      </FormField>

      <SubmitButton disabled={disabled} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit" variant="primary">
      <CalendarPlus className="size-4" aria-hidden="true" />
      {pending ? "Creating" : "Create Event"}
    </Button>
  );
}
