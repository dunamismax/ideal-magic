"use client";

import { CheckCircle2, Trophy } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { EventLifeCounterParticipantSummary } from "@/db/queries/event-planning";
import {
  saveEventLifeGameAction,
  type SaveEventLifeGameActionState,
} from "./actions";

type EventLifeGameSaveFormProps = {
  eventId: string;
  eventTitle: string;
  participants: readonly EventLifeCounterParticipantSummary[];
  action?: (
    previousState: SaveEventLifeGameActionState,
    formData: FormData,
  ) => Promise<SaveEventLifeGameActionState>;
};

function createInitialState(input: {
  eventId: string;
}): SaveEventLifeGameActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId: input.eventId,
      resultType: "normal_win",
      winnerParticipantIds: [],
      notes: "",
    },
  };
}

export function EventLifeGameSaveForm({
  eventId,
  eventTitle,
  participants,
  action = saveEventLifeGameAction,
}: EventLifeGameSaveFormProps) {
  const [state, formAction] = useActionState(
    action,
    createInitialState({
      eventId,
    }),
  );

  return (
    <section className="mt-4 grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Trophy className="size-4 text-accent" aria-hidden="true" />
            Save Game
          </h2>
          <p className="text-sm font-semibold text-muted">{eventTitle}</p>
        </div>
      </div>

      <form
        action={formAction}
        className="grid gap-3 lg:grid-cols-[12rem_1fr_1fr_auto] lg:items-start"
      >
        <input name="eventId" type="hidden" value={state.fields.eventId} />
        <select
          aria-label={`Result for ${eventTitle}`}
          className="h-10 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
          defaultValue={state.fields.resultType}
          name="resultType"
        >
          <option value="normal_win">Normal win</option>
          <option value="combat_win">Combat win</option>
          <option value="combo_win">Combo win</option>
          <option value="concession">Concession</option>
          <option value="archenemy_win">Archenemy win</option>
          <option value="team_win">Team win</option>
          <option value="draw">Draw</option>
          <option value="time_called">Time called</option>
          <option value="unfinished">Unfinished</option>
        </select>

        <fieldset className="grid gap-1 rounded-control border border-border bg-background px-3 py-2">
          <legend className="sr-only">Winners for {eventTitle}</legend>
          <span
            className="text-[0.7rem] font-black uppercase text-muted"
            id={`${eventId}-life-winner-participants-label`}
          >
            Winners
          </span>
          <div
            aria-labelledby={`${eventId}-life-winner-participants-label`}
            className="flex flex-wrap gap-2"
            role="group"
          >
            {participants.map((participant, index) => (
              <label
                className="inline-flex items-center gap-1 text-xs font-bold text-foreground"
                key={participant.id}
              >
                <input
                  className="size-4 accent-current"
                  defaultChecked={state.fields.winnerParticipantIds.includes(
                    participant.id,
                  )}
                  name="winnerParticipantIds"
                  type="checkbox"
                  value={participant.id}
                />
                Seat {index + 1}: {participant.participantName}
              </label>
            ))}
          </div>
        </fieldset>

        <input
          aria-label={`Notes for ${eventTitle}`}
          className="h-10 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
          defaultValue={state.fields.notes}
          name="notes"
          placeholder="Notes"
        />

        <SaveEventLifeGameButton eventTitle={eventTitle} />

        {state.message ? (
          <p
            className={
              state.saved
                ? "flex items-center gap-2 text-xs font-bold text-accent lg:col-span-4"
                : "text-xs font-bold text-danger lg:col-span-4"
            }
            role="status"
          >
            {state.saved ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : null}
            <span>{state.message}</span>
          </p>
        ) : null}

        {state.fieldErrors.eventId ||
        state.fieldErrors.resultType ||
        state.fieldErrors.winnerParticipantIds ? (
          <p className="text-xs font-bold text-danger lg:col-span-4">
            {state.fieldErrors.eventId ??
              state.fieldErrors.resultType ??
              state.fieldErrors.winnerParticipantIds}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function SaveEventLifeGameButton({ eventTitle }: { eventTitle: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`Save game for ${eventTitle}`}
      className="w-full justify-center lg:w-auto"
      disabled={pending}
      title={`Save game for ${eventTitle}`}
      type="submit"
      variant="primary"
    >
      <Trophy className="size-4" aria-hidden="true" />
      {pending ? "Saving" : "Save Game"}
    </Button>
  );
}
