"use client";

import { AlertCircle, LibraryBig } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { createDeckAction, type CreateDeckActionState } from "./actions";

export type DeckFormPlaygroup = {
  id: string;
  name: string;
};

function createInitialState(
  playgroups: DeckFormPlaygroup[],
): CreateDeckActionState {
  return {
    message: null,
    fieldErrors: {},
    fields: {
      name: "",
      commanders: "",
      colorIdentity: "",
      bracket: "",
      powerEstimate: "",
      archetype: "",
      tags: "",
      visibility: playgroups.length > 0 ? "playgroup" : "private",
      playgroupId: playgroups[0]?.id ?? "",
      externalUrl: "",
    },
  };
}

export function CreateDeckForm({
  playgroups,
}: {
  playgroups: DeckFormPlaygroup[];
}) {
  const [state, formAction] = useActionState(
    createDeckAction,
    createInitialState(playgroups),
  );

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="text-base font-bold">Create Deck</h2>
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

      <FormField label="Deck Name" error={state.fieldErrors.name}>
        <input
          className={fieldControlClassName}
          defaultValue={state.fields.name}
          maxLength={100}
          name="name"
          required
        />
      </FormField>

      <FormField
        label="Commanders"
        hint="Put partners or background pairs on separate lines."
        error={state.fieldErrors.commanders}
      >
        <textarea
          className={`${fieldControlClassName} min-h-20 resize-y py-2`}
          defaultValue={state.fields.commanders}
          maxLength={260}
          name="commanders"
          required
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          label="Colors"
          hint="WUBRG order is normalized."
          error={state.fieldErrors.colorIdentity}
        >
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.colorIdentity}
            maxLength={5}
            name="colorIdentity"
            placeholder="WUBRG"
          />
        </FormField>

        <FormField label="Bracket" error={state.fieldErrors.bracket}>
          <select
            className={fieldControlClassName}
            defaultValue={state.fields.bracket}
            name="bracket"
          >
            <option value="">Unset</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </FormField>

        <FormField label="Power" error={state.fieldErrors.powerEstimate}>
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.powerEstimate}
            max={10}
            min={1}
            name="powerEstimate"
            type="number"
          />
        </FormField>
      </div>

      <FormField label="Archetype" error={state.fieldErrors.archetype}>
        <input
          className={fieldControlClassName}
          defaultValue={state.fields.archetype}
          maxLength={80}
          name="archetype"
        />
      </FormField>

      <FormField
        label="Tags"
        hint="Comma-separated planning labels."
        error={state.fieldErrors.tags}
      >
        <input
          className={fieldControlClassName}
          defaultValue={state.fields.tags}
          maxLength={280}
          name="tags"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Visibility" error={state.fieldErrors.visibility}>
          <select
            className={fieldControlClassName}
            defaultValue={state.fields.visibility}
            name="visibility"
            required
          >
            <option value="private">Private</option>
            {playgroups.length > 0 ? (
              <option value="playgroup">Playgroup</option>
            ) : null}
            <option value="public">Public</option>
          </select>
        </FormField>

        <FormField label="Playgroup" error={state.fieldErrors.playgroupId}>
          <select
            className={fieldControlClassName}
            defaultValue={state.fields.playgroupId}
            name="playgroupId"
          >
            <option value="">No playgroup</option>
            {playgroups.map((playgroup) => (
              <option key={playgroup.id} value={playgroup.id}>
                {playgroup.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="External URL" error={state.fieldErrors.externalUrl}>
        <input
          className={fieldControlClassName}
          defaultValue={state.fields.externalUrl}
          name="externalUrl"
          placeholder="https://..."
          type="url"
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
      <LibraryBig className="size-4" aria-hidden="true" />
      {pending ? "Creating" : "Create Deck"}
    </Button>
  );
}
