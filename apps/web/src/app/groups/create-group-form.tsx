"use client";

import { AlertCircle, Plus } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { createGroupAction, type CreateGroupActionState } from "./actions";

const initialCreateGroupActionState: CreateGroupActionState = {
  message: null,
  fieldErrors: {},
  fields: {
    name: "",
    description: "",
  },
};

export function CreateGroupForm() {
  const [state, formAction] = useActionState(
    createGroupAction,
    initialCreateGroupActionState,
  );

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="text-base font-bold">Create Playgroup</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Start with the group name and a short planning note.
        </p>
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

      <FormField label="Group Name" error={state.fieldErrors.name}>
        <input
          className={fieldControlClassName}
          name="name"
          defaultValue={state.fields.name}
          maxLength={80}
          required
        />
      </FormField>

      <FormField
        label="Description"
        hint="Visible to members on the group list."
        error={state.fieldErrors.description}
      >
        <textarea
          className={`${fieldControlClassName} min-h-24 resize-y py-2`}
          name="description"
          defaultValue={state.fields.description}
          maxLength={500}
        />
      </FormField>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="primary">
      <Plus className="size-4" aria-hidden="true" />
      {pending ? "Creating" : "Create Group"}
    </Button>
  );
}
