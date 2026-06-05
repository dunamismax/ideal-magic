"use client";

import { AlertCircle, Archive, Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import type { ViewerDeck } from "@/db/queries/decks";
import {
  retireDeckAction,
  type RetireDeckActionState,
  updateDeckAction,
  type UpdateDeckActionState,
} from "./actions";
import type { DeckFormPlaygroup } from "./create-deck-form";

function createUpdateInitialState(deck: ViewerDeck): UpdateDeckActionState {
  return {
    message: null,
    fieldErrors: {},
    fields: {
      deckId: deck.id,
      name: deck.name,
      commanders: deck.commanders.join("\n"),
      colorIdentity: deck.colorIdentity,
      bracket: deck.bracket ?? "",
      powerEstimate: deck.powerEstimate?.toString() ?? "",
      archetype: deck.archetype,
      tags: deck.tags.join(", "),
      visibility: deck.visibility,
      playgroupId: deck.playgroup?.id ?? "",
      externalUrl: deck.externalUrl ?? "",
    },
  };
}

function createRetireInitialState(deck: ViewerDeck): RetireDeckActionState {
  return {
    message: null,
    fieldErrors: {},
    fields: {
      deckId: deck.id,
    },
  };
}

export function UpdateDeckForm({
  deck,
  playgroups,
}: {
  deck: ViewerDeck;
  playgroups: DeckFormPlaygroup[];
}) {
  const [updateState, updateFormAction] = useActionState(
    updateDeckAction,
    createUpdateInitialState(deck),
  );
  const [retireState, retireFormAction] = useActionState(
    retireDeckAction,
    createRetireInitialState(deck),
  );

  return (
    <details className="mt-4 rounded-panel border border-border bg-background p-3">
      <summary className="cursor-pointer text-sm font-bold text-accent">
        Edit Deck
      </summary>

      <form action={updateFormAction} className="mt-4 grid gap-4">
        <input name="deckId" type="hidden" value={updateState.fields.deckId} />

        {updateState.message ? <Message message={updateState.message} /> : null}

        <FormField label="Edit Deck Name" error={updateState.fieldErrors.name}>
          <input
            className={fieldControlClassName}
            defaultValue={updateState.fields.name}
            maxLength={100}
            name="name"
            required
          />
        </FormField>

        <FormField
          label="Edit Commanders"
          hint="Put partners or background pairs on separate lines."
          error={updateState.fieldErrors.commanders}
        >
          <textarea
            className={`${fieldControlClassName} min-h-20 resize-y py-2`}
            defaultValue={updateState.fields.commanders}
            maxLength={260}
            name="commanders"
            required
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="Edit Colors"
            hint="WUBRG order is normalized."
            error={updateState.fieldErrors.colorIdentity}
          >
            <input
              className={fieldControlClassName}
              defaultValue={updateState.fields.colorIdentity}
              maxLength={5}
              name="colorIdentity"
              placeholder="WUBRG"
            />
          </FormField>

          <FormField
            label="Edit Bracket"
            error={updateState.fieldErrors.bracket}
          >
            <select
              className={fieldControlClassName}
              defaultValue={updateState.fields.bracket}
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

          <FormField
            label="Edit Power"
            error={updateState.fieldErrors.powerEstimate}
          >
            <input
              className={fieldControlClassName}
              defaultValue={updateState.fields.powerEstimate}
              max={10}
              min={1}
              name="powerEstimate"
              type="number"
            />
          </FormField>
        </div>

        <FormField
          label="Edit Archetype"
          error={updateState.fieldErrors.archetype}
        >
          <input
            className={fieldControlClassName}
            defaultValue={updateState.fields.archetype}
            maxLength={80}
            name="archetype"
          />
        </FormField>

        <FormField
          label="Edit Tags"
          hint="Comma-separated planning labels."
          error={updateState.fieldErrors.tags}
        >
          <input
            className={fieldControlClassName}
            defaultValue={updateState.fields.tags}
            maxLength={280}
            name="tags"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Edit Visibility"
            error={updateState.fieldErrors.visibility}
          >
            <select
              className={fieldControlClassName}
              defaultValue={updateState.fields.visibility}
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

          <FormField
            label="Edit Playgroup"
            error={updateState.fieldErrors.playgroupId}
          >
            <select
              className={fieldControlClassName}
              defaultValue={updateState.fields.playgroupId}
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

        <FormField
          label="Edit External URL"
          error={updateState.fieldErrors.externalUrl}
        >
          <input
            className={fieldControlClassName}
            defaultValue={updateState.fields.externalUrl}
            name="externalUrl"
            placeholder="https://..."
            type="url"
          />
        </FormField>

        <UpdateButton />
      </form>

      <form action={retireFormAction} className="mt-3 grid gap-3">
        <input name="deckId" type="hidden" value={retireState.fields.deckId} />

        {retireState.message ? <Message message={retireState.message} /> : null}

        <RetireButton deckName={deck.name} />
      </form>
    </details>
  );
}

function Message({ message }: { message: string }) {
  const isSuccess = message === "Deck updated.";

  return (
    <div
      className={`flex items-start gap-2 rounded-control border p-3 text-sm font-semibold ${
        isSuccess
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function UpdateButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="primary">
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Updating" : "Update Deck"}
    </Button>
  );
}

function RetireButton({ deckName }: { deckName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`Retire ${deckName}`}
      disabled={pending}
      type="submit"
      variant="secondary"
    >
      <Archive className="size-4" aria-hidden="true" />
      {pending ? "Retiring" : "Retire Deck"}
    </Button>
  );
}
