"use client";

import { AlertCircle, LibraryBig, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import type { EventDeckDeclaration, ViewerDeck } from "@/db/queries/decks";
import {
  declareDeckAction,
  type DeckDeclarationActionState,
  undeclareDeckAction,
  type UndeclareDeckActionState,
} from "./actions";

function createInitialDeclareState(
  eventId: string,
  decks: ViewerDeck[],
): DeckDeclarationActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId,
      deckId: decks[0]?.id ?? "",
      preference: "1",
    },
  };
}

const initialUndeclareState: UndeclareDeckActionState = {
  message: null,
  saved: false,
  fieldErrors: {},
  fields: {
    declarationId: "",
  },
};

export function EventDeckDeclarationForm({
  eventId,
  decks,
  declarations,
}: {
  eventId: string;
  decks: ViewerDeck[];
  declarations: EventDeckDeclaration[];
}) {
  const [declareState, declareFormAction] = useActionState(
    declareDeckAction,
    createInitialDeclareState(eventId, decks),
  );
  const [undeclareState, undeclareFormAction] = useActionState(
    undeclareDeckAction,
    initialUndeclareState,
  );
  const declaredDeckIds = new Set(
    declarations.map((declaration) => declaration.deckId),
  );
  const availableDecks = decks.filter((deck) => !declaredDeckIds.has(deck.id));
  const disabled = availableDecks.length === 0;

  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-bold uppercase text-muted">
          Deck Declarations
        </h3>
        <span className="text-sm font-black text-foreground">
          {declarations.length}
        </span>
      </div>

      {declarations.length > 0 ? (
        <ul className="grid gap-2">
          {declarations.map((declaration) => (
            <li
              className="grid gap-3 rounded-control bg-background p-3 sm:grid-cols-[1fr_auto] sm:items-center"
              key={declaration.id}
            >
              <div>
                <p className="font-bold">{declaration.deckNameSnapshot}</p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {declaration.commanderSnapshot.join(" / ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {declaration.colorIdentitySnapshot ? (
                    <Badge value={declaration.colorIdentitySnapshot} />
                  ) : null}
                  {declaration.bracketSnapshot ? (
                    <Badge value={`Bracket ${declaration.bracketSnapshot}`} />
                  ) : null}
                  {declaration.powerEstimateSnapshot ? (
                    <Badge
                      value={`Power ${declaration.powerEstimateSnapshot}`}
                    />
                  ) : null}
                  {declaration.archetypeSnapshot ? (
                    <Badge value={declaration.archetypeSnapshot} />
                  ) : null}
                </div>
              </div>
              <form action={undeclareFormAction}>
                <input
                  name="declarationId"
                  type="hidden"
                  value={declaration.id}
                />
                <UndeclareButton deckName={declaration.deckNameSnapshot} />
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-control bg-background p-3 text-sm font-semibold text-muted">
          No decks declared.
        </p>
      )}

      {undeclareState.message ? (
        <StatusMessage
          danger={!undeclareState.saved}
          message={undeclareState.message}
        />
      ) : null}

      <form
        action={declareFormAction}
        className="grid gap-3 rounded-control bg-background p-3"
      >
        <input name="eventId" type="hidden" value={eventId} />

        {declareState.message ? (
          <StatusMessage
            danger={!declareState.saved}
            message={declareState.message}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
          <FormField label="Deck" error={declareState.fieldErrors.deckId}>
            <select
              className={fieldControlClassName}
              defaultValue={declareState.fields.deckId}
              disabled={disabled}
              name="deckId"
              required
            >
              {availableDecks.length > 0 ? (
                availableDecks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))
              ) : (
                <option value="">No undeclared decks</option>
              )}
            </select>
          </FormField>

          <FormField
            label="Preference"
            error={declareState.fieldErrors.preference}
          >
            <select
              className={fieldControlClassName}
              defaultValue={declareState.fields.preference}
              disabled={disabled}
              name="preference"
              required
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </FormField>

          <DeclareButton disabled={disabled} />
        </div>
      </form>
    </div>
  );
}

function DeclareButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit" variant="primary">
      <LibraryBig className="size-4" aria-hidden="true" />
      {pending ? "Declaring" : "Declare Deck"}
    </Button>
  );
}

function UndeclareButton({ deckName }: { deckName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`Undeclare ${deckName}`}
      disabled={pending}
      type="submit"
      variant="ghost"
    >
      <Trash2 className="size-4" aria-hidden="true" />
      {pending ? "Removing" : "Undeclare"}
    </Button>
  );
}

function StatusMessage({
  danger,
  message,
}: {
  danger: boolean;
  message: string;
}) {
  return (
    <div
      className={
        danger
          ? "flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
          : "rounded-control border border-border bg-surface p-3 text-sm font-semibold text-foreground"
      }
      role={danger ? "alert" : "status"}
    >
      {danger ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{message}</span>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-control border border-border bg-surface px-2 py-1 text-xs font-bold uppercase text-muted">
      {value}
    </span>
  );
}
